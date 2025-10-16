import dayjs from 'dayjs';


export function parseFlexibleDate(value: string): Date | null {
    if (!value) return null;
    const formats = ['DD-MM-YYYY', 'YYYY-MM-DD'];
    const parsed = dayjs(value, formats, true); // true = strict parsing
    if (!parsed.isValid()) {
      return null;
    }
    return parsed.toDate();
  }
  