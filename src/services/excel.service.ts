import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { PassThrough, Readable } from 'stream';

export interface ExcelReadOptions {
  pageSize?: number; // Number of records per page
  hasHeaderRow?: boolean; // Whether the first row contains headers
  providedHeaders?: string[]; // Custom headers if hasHeaderRow is false
}

const DEFAULT_PAGE_SIZE = 100; // Default page size if not provided

export interface ExcelReadResult {
  headers: string[]; // Headers of the Excel file
  data: Record<string, any>[]; // Data records in the current page
}

export interface ExcelReadAllResult {
  headers: string[];
  rows: Record<string, any>[];
}

@Injectable()
export class ExcelService {
  private logger = new Logger(ExcelService.name);

  public async createExcelStream(
    getDataRecords: (chunkIndex: number, chunkSize: number) => Promise<any[]>,
    chunkSize: number = 100,
    headers: string[] = []
  ): Promise<Readable> {
    // Validations
    // If neither headers nor data records function is provided, throw an error
    if (headers.length === 0 && typeof getDataRecords !== 'function') {
      throw new Error(ERROR_MESSAGES.MISSING_HEADERS_OR_FUNCTION);
    }

    // If data records function is provided, chunkSize must be greater than 0
    if (getDataRecords && chunkSize <= 0) {
      throw new Error(ERROR_MESSAGES.INVALID_CHUNK_SIZE);
    }

    const passThrough = new PassThrough(); // Create streaming pipe
    try {
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: passThrough });
      const worksheet = workbook.addWorksheet('Data');

      // If headers are provided, use them;
      let isHeaderWritten = false;
      if (headers.length > 0) {
        worksheet.columns = headers.map((header) => ({
          header: header, // Convert header names to uppercase
          key: header,
          width: 20, // Set column width
        }));
        isHeaderWritten = true; // Mark headers as written
      }

      // ✅ If no data loader provided, write only headers and finish
      if (typeof getDataRecords !== 'function') {
        // worksheet.addRow(
        //   headers.reduce((acc, header) => ({ ...acc, [header]: '' }), {})
        // ).commit(); // Write a dummy record with headers

        workbook.commit();
        return passThrough;
      }

      // Write the data records in chunks
      let chunkIndex = 0;
      while (true) {
        const records = await getDataRecords(chunkIndex, chunkSize); // Fetch chunked data
        if (records.length === 0) break; // Stop if no more records

        if (!isHeaderWritten) { // Falback because without columns being set, ExcelJS won't write data correctly
          worksheet.columns = Object.keys(records[0]).map((key) => ({
            header: key.toUpperCase(),
            key: key,
            width: 20,
          }));
          isHeaderWritten = true;
        }

        records.forEach((item) => {
          worksheet.addRow(item).commit(); // Commit each row immediately
        });

        chunkIndex++; // Fetch next chunk
        this.logger.debug(`✅ Chunk ${chunkIndex} written to Excel`);
      }

      workbook.commit();
      // passThrough.end(); // ✅ Properly close the stream
    } catch (error) {
      this.logger.error(`❌ Error writing Excel: ${error.message}`);
      passThrough.destroy(error); // Destroy stream
      throw error;
    }
    return passThrough; // Return streaming response
  }

  public async *readExcelInPagesFromStream(
    stream: Readable,
    options?: ExcelReadOptions
  ): AsyncGenerator<ExcelReadResult> {
    const { pageSize = DEFAULT_PAGE_SIZE, hasHeaderRow = true, providedHeaders = [] } = options || {};
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(stream, {});

    let headers: string[] = [];
    let page: Record<string, any>[] = [];
    let isFirstRow = true;
    let hasYieldedData = false;

    for await (const worksheet of workbookReader) {
      for await (const row of worksheet) {
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];

        if (isFirstRow) {
          isFirstRow = false;

          if (hasHeaderRow) {
            headers = values.map(v => v?.toString().trim() || '');
            continue;
          } else if (providedHeaders.length) {
            headers = providedHeaders;
          } else {
            headers = values.map((_, idx) => `${idx}`);
          }
        }

        while (values.length < headers.length) values.push(null);
        if (values.length > headers.length) values.length = headers.length;

        const record = headers.reduce((acc, key, i) => {
          acc[key] = values[i] ?? null;
          return acc;
        }, {} as Record<string, any>);

        if (Object.values(record).every(v => v === null || v === '')) continue;

        page.push(record);

        if (page.length === pageSize) {
          yield { headers, data: page };
          hasYieldedData = true;
          page = [];
        }
      }

      // Optional: break if only processing first worksheet
      // break;
    }

    if (page.length > 0) {
      yield { headers, data: page };
      hasYieldedData = true;
    }

    // ✅ Yield headers with empty data if only headers were found
    if (!hasYieldedData && headers.length > 0) {
      yield { headers, data: [] };
    }
  }

  private cleanString(value: any): string {
    return (value === null || value === undefined ? '' : String(value))
      .replace(/\uFEFF/g, '') // BOM
      .replace(/\u00A0/g, ' ') // NBSP
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeCellValue(value: any, sharedStrings?: any[]): any {
    if (value === undefined || value === null) return null;

    // ExcelJS streaming shared string ref: { sharedString: number }
    if (typeof value === 'object' && value && 'sharedString' in value) {
      const idx = (value as any).sharedString;
      const resolved = sharedStrings?.[idx];
      // sharedStrings may store objects or plain strings depending on ExcelJS internals
      if (resolved === undefined || resolved === null) return null;
      if (typeof resolved === 'string') return resolved;
      if (typeof resolved === 'object') {
        if ('text' in resolved && typeof (resolved as any).text === 'string') return (resolved as any).text;
        if ('richText' in resolved && Array.isArray((resolved as any).richText)) {
          return (resolved as any).richText.map((item: any) => item?.text ?? '').join('');
        }
        if ('value' in resolved) return (resolved as any).value;
      }
      return resolved;
    }

    // ExcelJS can return rich objects for styled cells; unwrap to plain text/primitive
    if (typeof value === 'object' && value) {
      // Plain rich cell: { text: '...' }
      if ('text' in value && typeof (value as any).text === 'string') return (value as any).text;

      // Rich text: { richText: [{text:'a'}, ...] }
      if ('richText' in value && Array.isArray((value as any).richText)) {
        return (value as any).richText.map((item: any) => item?.text ?? '').join('');
      }

      // Formula cells: { formula: '...', result: ... }
      if ('result' in value) return (value as any).result;
      if ('formula' in value) return (value as any).formula;

      // Hyperlinks: { text: '...', hyperlink: '...' }
      if ('hyperlink' in value && typeof (value as any).hyperlink === 'string') {
        return (value as any).text ?? (value as any).hyperlink;
      }

      // Sometimes primitive nested under .value
      if ('value' in value) return this.normalizeCellValue((value as any).value, sharedStrings);
    }

    return value;
  }

  public async readExcelFromStreamNonStreaming(
    stream: Readable,
    options?: ExcelReadOptions & { worksheetIndex?: number; maxRows?: number }
  ): Promise<ExcelReadAllResult> {
    const {
      hasHeaderRow = true,
      providedHeaders = [],
      worksheetIndex = 0, // 0-based
      maxRows,
    } = options || {};

    // 1) Read entire stream into a Buffer
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    // 2) Load workbook (non-streaming)
    const workbook = new ExcelJS.Workbook();
    // @ts-ignore
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets?.[worksheetIndex];
    if (!worksheet) {
      return { headers: [], rows: [] };
    }

    // 3) Determine headers
    let headers: string[] = [];

    const firstRow = worksheet.getRow(1);
    const firstRowValues = Array.isArray(firstRow.values) ? (firstRow.values as any[]).slice(1) : [];

    const normalizeNonStreamingCell = (v: any) => {
      // In non-streaming ExcelJS, cell.value can be:
      // - string/number/boolean/date
      // - {richText}, {text}, {hyperlink}, {formula,result}, etc.
      // We'll reuse your normalizeCellValue but without sharedStrings
      return this.normalizeCellValue(v);
    };

    if (hasHeaderRow) {
      headers = firstRowValues.map((v) => this.cleanString(normalizeNonStreamingCell(v)));
    } else if (providedHeaders.length) {
      headers = providedHeaders.map((h) => this.cleanString(h));
    } else {
      headers = firstRowValues.map((_, idx) => `${idx}`);
    }

    // If headers are all blank and hasHeaderRow=true, treat as no headers (avoid mapping everything to "")
    if (hasHeaderRow && headers.length > 0 && headers.every((h) => !h)) {
      this.logger.warn(`ExcelService.readExcelFromStreamNonStreaming: header row appears blank`);
    }

    // 4) Read rows
    const rows: Record<string, any>[] = [];

    const startRowNumber = hasHeaderRow ? 2 : 1;
    const lastRowNumber = worksheet.rowCount || 0;

    for (let r = startRowNumber; r <= lastRowNumber; r++) {
      if (maxRows && rows.length >= maxRows) break;

      const row = worksheet.getRow(r);
      const rawValues = Array.isArray(row.values) ? (row.values as any[]).slice(1) : [];
      const values = rawValues.map((v) => normalizeNonStreamingCell(v));

      // Align row width to header width
      while (values.length < headers.length) values.push(null);
      if (values.length > headers.length) values.length = headers.length;

      const record = headers.reduce((acc, key, i) => {
        acc[key] = values[i] ?? null;
        return acc;
      }, {} as Record<string, any>);

      // Skip fully empty rows
      if (Object.values(record).every((v) => v === null || this.cleanString(v) === '')) continue;

      rows.push(record);
    }

    return { headers, rows };
  }
}