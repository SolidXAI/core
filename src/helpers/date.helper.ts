import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat);

export function parseFlexibleDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value;
    }
    if (typeof value === 'number') {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(excelEpoch.getTime() + value * 86400000);
      return isNaN(d.getTime()) ? null : d;
    }
    const str = value.toString().trim();
    const formats = [
      'DD-MM-YYYY',
      'YYYY-MM-DD',
      'DD/MM/YYYY',
      'MM/DD/YYYY',
      'D-M-YYYY',
      'YYYY/MM/DD'
    ];
    const parsed = dayjs(str, formats, true); // true = strict parsing
    if (!parsed.isValid()) {
      return null;
    }
    return parsed.toDate();
  }
  