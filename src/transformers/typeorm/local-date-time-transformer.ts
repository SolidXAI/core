import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const SOLIDX_WALL_TIME_TZ = process.env.SOLIDX_WALL_TIME_TIMEZONE || process.env.SOLIDX_TIMEZONE || "UTC";
const SOLIDX_TIME_STORED_AS_WALL_TIME = (process.env.SOLIDX_TIME_STORED_AS_WALL_TIME || "").toLowerCase() === "true";

export const LocalDateTimeTransformer = {
    // DB → Entity
    from(value: Date | string | null): Date | null {
        if (!value) return null;

        // SQL Server driver may give Date or string
        const d = dayjs(value);

        if (!SOLIDX_TIME_STORED_AS_WALL_TIME) return d.toDate();

        // Interpret DB value as SOLIDX_WALL_TIME_TZ wall time,
        // then convert to a real UTC instant
        return d.tz(SOLIDX_WALL_TIME_TZ, true).utc().toDate();
    },

    // Entity → DB
    to(value: Date | null): Date | null {
        if (!value) return null;

        if (!SOLIDX_TIME_STORED_AS_WALL_TIME) return dayjs(value).toDate();

        // Convert the instant back into SOLIDX_WALL_TIME_TZ wall time
        return dayjs(value).tz(SOLIDX_WALL_TIME_TZ).toDate();
    },
};
