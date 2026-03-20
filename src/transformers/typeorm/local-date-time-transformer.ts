import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { ValueTransformer } from "typeorm";

dayjs.extend(utc);
dayjs.extend(timezone);

function dateToUtcComponentString(d: Date): string {
    // Requires MSSQL driver option: useUTC: true
    // so that DB "2026-01-08 10:00:00" -> Date with UTC parts 2026-01-08 10:00:00
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");

    const yyyy = d.getUTCFullYear();
    const mm = pad(d.getUTCMonth() + 1);
    const dd = pad(d.getUTCDate());
    const hh = pad(d.getUTCHours());
    const mi = pad(d.getUTCMinutes());
    const ss = pad(d.getUTCSeconds());
    const ms = pad(d.getUTCMilliseconds(), 3);

    // A "naive" timestamp string representing the DB wall-clock components
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}.${ms}`;
}

function getWallClockConfig(): { tz: string; wallTimeMode: boolean } {
    return {
        tz: process.env.SOLIDX_WALL_TIME_TIMEZONE || process.env.SOLIDX_TIMEZONE || "UTC",
        wallTimeMode: (process.env.SOLIDX_TIME_STORED_AS_WALL_TIME || "").toLowerCase() === "true",
    };
}

/**
 * Returns a dayjs instance positioned at the wall-clock time for the given Date.
 * - Wall-clock mode ON:  dayjs in the configured timezone (components = wall-clock components)
 * - Wall-clock mode OFF: dayjs in UTC
 * Counterpart to serializeDate — use this to format/display a date value correctly.
 */
export function parseDate(date: Date): dayjs.Dayjs {
    const { tz, wallTimeMode } = getWallClockConfig();
    if (!wallTimeMode) return dayjs.utc(date);
    return dayjs(date).tz(tz);
}

/**
 * Converts a Date to a string for storage in plain text columns (e.g. audit values).
 * - Wall-clock mode ON:  "YYYY-MM-DD HH:mm:ss.SSS" in the configured timezone (no Z suffix)
 * - Wall-clock mode OFF: ISO 8601 UTC string with Z suffix
 * The presence/absence of the Z suffix lets consumers distinguish the two cases.
 */
export function serializeDate(date: Date): string {
    const { wallTimeMode } = getWallClockConfig();
    if (!wallTimeMode) return date.toISOString();
    return parseDate(date).format("YYYY-MM-DD HH:mm:ss.SSS");
}

export const LocalDateTimeTransformer: ValueTransformer = {
    // DB -> Entity
    from(value: Date | string | null | undefined): Date | null | undefined {
        // critical... super important to return undefined here
        if (value === undefined) return undefined;
        if (value === null) return null;

        const { tz, wallTimeMode } = getWallClockConfig();

        if (!wallTimeMode) {
            return dayjs(value).toDate();
        }

        const naive = value instanceof Date ? dateToUtcComponentString(value) : String(value);
        return dayjs.tz(naive, tz).utc().toDate();
    },

    // Entity -> DB
    to(value: Date | null | undefined): Date | null | undefined {
        // critical... super important to return undefined here
        if (value === undefined) return undefined;
        if (value === null) return null;

        const wallTimeStr = serializeDate(value);
        return dayjs.utc(wallTimeStr).toDate();
    },

};

