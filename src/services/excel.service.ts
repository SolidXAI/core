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

        await workbook.commit();
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

}