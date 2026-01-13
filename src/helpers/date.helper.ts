import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export function parseFlexibleDate(value: any): Date | null {
  if (!value) return null;

  // Already a valid Date (ExcelJS often gives this)
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  // Excel serial number
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + value * 86400000);
    return isNaN(d.getTime()) ? null : d;
  }

  let str = value.toString().trim();

  // STRIP "(British Summer Time)" or any "(...)" suffix
  str = str.replace(/\s*\(.*\)$/, '');

  const formats = [
    // strict business formats
    'DD-MM-YYYY',

    // common alternates
    'YYYY-MM-DD',
    'DD/MM/YYYY',
    'MM/DD/YYYY',
    'D-M-YYYY',
    'YYYY/MM/DD',

    // JS Date.toString() (without timezone name)
    // (handle single-digit day + different offset shapes)
    'ddd MMM D YYYY HH:mm:ss [GMT]ZZ', // GMT+0100
    'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ',
    'ddd MMM D YYYY HH:mm:ss [GMT]Z',  // GMT+01:00
    'ddd MMM DD YYYY HH:mm:ss [GMT]Z',

    // ISO variants
    'YYYY-MM-DD HH:mm:ss',
    'YYYY-MM-DDTHH:mm:ss',
    'YYYY-MM-DDTHH:mm:ss.SSS',
    'YYYY-MM-DDTHH:mm:ssZ',
  ];

  const parsed = dayjs(str, formats, true); // strict
  if (parsed.isValid()) {
    return parsed.toDate();
  }

  // Fallback: native Date can parse this JS format very reliably
  const native = new Date(str);
  if (!isNaN(native.getTime())) {
    return native;
  }

  return null;
}