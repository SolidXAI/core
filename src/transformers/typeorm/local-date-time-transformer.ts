import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const SOLIDX_WALL_TIME_TZ = process.env.SOLIDX_WALL_TIME_TIMEZONE || process.env.SOLIDX_TIMEZONE || "UTC";
const SOLIDX_TIME_STORED_AS_WALL_TIME = (process.env.SOLIDX_TIME_STORED_AS_WALL_TIME || "").toLowerCase() === "true";

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

    // A “naive” timestamp string representing the DB wall-clock components
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}.${ms}`;
}

export const LocalDateTimeTransformer = {
    // DB → Entity
    from(value: Date | string | null | undefined): Date | null | undefined {
         // critical... super important to return undefined here 
        if (value === undefined) return undefined;
        if (value === null) return null;

        if (!SOLIDX_TIME_STORED_AS_WALL_TIME) {
            return dayjs(value).toDate();
        }

        const naive = value instanceof Date ? dateToUtcComponentString(value) : String(value);
        return dayjs.tz(naive, SOLIDX_WALL_TIME_TZ).utc().toDate();
    },

    // Entity → DB
    to(value: Date | null | undefined): Date | null | undefined {
         // critical... super important to return undefined here 
        if (value === undefined) return undefined;
        if (value === null) return null;

        if (!SOLIDX_TIME_STORED_AS_WALL_TIME) {
            return dayjs(value).toDate();
        }

        return dayjs(value).tz(SOLIDX_WALL_TIME_TZ).toDate();
    },
};