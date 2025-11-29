import dayjs from 'dayjs';


export function parseFlexibleDate(value: string): Date | null {
  if (!value) return null;

  const formats = [
    'DD-MM-YYYY',
    'YYYY-MM-DD',
    'YYYY-MM-DD HH:mm:ss',
    'YYYY-MM-DDTHH:mm:ss',       // ISO without Z
    'YYYY-MM-DDTHH:mm:ss.SSS',   // ISO with millis
    'YYYY-MM-DDTHH:mm:ssZ',      // ISO with timezone
  ];

  const parsed = dayjs(value, formats, true); // true = strict parsing
  if (!parsed.isValid()) {
    return null;
  }
  return parsed.toDate();
}
