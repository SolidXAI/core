import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Builds the stored config version name: `<name>_YYYYMMDD_HHmm`, or `v<number>_YYYYMMDD_HHmm` when no
 * name was given. The timestamp uses the deployment's configured timezone, defaulting to UTC.
 */
export function buildAgentConfigVersionName(name: string | undefined, versionNumber: number, now: Date = new Date()): string {
  const timeZone = process.env.SOLIDX_WALL_TIME_TIMEZONE || process.env.SOLIDX_TIMEZONE || 'UTC';
  const baseName = name?.trim() || `v${versionNumber}`;
  return `${baseName}_${dayjs(now).tz(timeZone).format('YYYYMMDD_HHmm')}`;
}
