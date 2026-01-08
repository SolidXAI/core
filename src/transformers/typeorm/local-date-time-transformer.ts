import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const SOLIDX_TZ = process.env.SOLIDX_TIMEZONE || "Asia/Kolkata";

export const LocalDateTimeTransformer = {
    // DB → Entity
    from(value: Date | string | null): Date | null {
        if (!value) return null;

        // SQL Server driver may give Date or string
        const d = dayjs(value);

        // Interpret DB value as SOLIDX_TZ wall time,
        // then convert to a real UTC instant
        return d.tz(SOLIDX_TZ, true).utc().toDate();
    },

    // Entity → DB
    to(value: Date | null): Date | null {
        if (!value) return null;

        // Convert the instant back into SOLIDX_TZ wall time
        return dayjs(value).tz(SOLIDX_TZ).toDate();
    },
};
