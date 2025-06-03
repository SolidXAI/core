import { Injectable, Logger } from '@nestjs/common';
import { format, parse } from 'fast-csv';
import { PassThrough, Readable } from 'stream';

export interface CsvReadOptions {
  pageSize?: number; // Number of records per page
  hasHeaderRow?: boolean;
  providedHeaders?: string[]
};
const DEFAULT_PAGE_SIZE = 100; // Default page size if not provided
export interface CsvReadResult {
  headers: string[]; // Headers of the CSV file
  data: Record<string, any>[]; // Data records in the current page
}

@Injectable()
export class CsvService {
  private logger = new Logger(CsvService.name);
  public async createCsvStream(
    getDataRecords: (chunkIndex: number, chunkSize: number) => Promise<any[]> = null,
    chunkSize: number = 100,
    headers: string[] = []
  ): Promise<Readable> {
    // Validations
    // If neither headers nor data records function is provided, throw an error
    if (headers.length === 0 && typeof getDataRecords !== 'function') {
      throw new Error('Either headers or data records function must be provided.');
    }

    // If data records function is provided, chunkSize must be greater than 0
    if (getDataRecords && chunkSize <= 0) {
      throw new Error('Chunk size must be greater than 0 when data records function is provided.');
    }

    const passThrough = new PassThrough(); // ✅ Create a streaming pipe
    const csvStream = headers.length
      ? format({ headers })
      : format({ headers: true });

    csvStream.pipe(passThrough); // ✅ Pipe CSV output to PassThrough stream

    try {
      // 🧠 If no data retrieval logic is provided, just write headers and close
      if (typeof getDataRecords !== 'function') {

        const dummyRow = headers.reduce((acc, header) => {
          acc[header] = '';
          return acc;
        }, {} as Record<string, string>);
        csvStream.write(dummyRow);
        csvStream.end();
        return passThrough;
      }

      // Write the data records in chunks
      let chunkIndex = 0;
      while (true) {
        const records = await getDataRecords(chunkIndex, chunkSize); // ✅ Fetch chunked data
        if (records.length === 0) break; // ✅ Stop if no more records

        for (const record of records) {
          csvStream.write(record); // ✅ Write each record to the CSV stream
        }

        chunkIndex++; // ✅ Fetch next chunk
        this.logger.debug(`✅ Chunk ${chunkIndex} written to CSV`);
      }

      csvStream.end(); // ✅ Ensure CSV stream is finalized
    } catch (error) {
      this.logger.error(`❌ Error writing CSV: ${error.message}`);
      passThrough.destroy(error); // ✅ Properly destroy stream on error
      throw error;
    }

    return passThrough; // ✅ Return the streaming response
  }

  public async  *readCsvInPagesFromStream(
    stream: Readable,
    options?: CsvReadOptions
  ): AsyncGenerator<CsvReadResult> {
    const { pageSize = DEFAULT_PAGE_SIZE, hasHeaderRow = true, providedHeaders = [] } = options || {};
    let headers: string[] = [];
    let page: Record<string, any>[] = [];
    let isFirstRow = true;
    let hasYieldedData = false;

    // Create parser
    const parser = parse({ headers: hasHeaderRow, renameHeaders: false, trim: true });

    // Pipe the input stream into the parser
    const parsingStream = stream.pipe(parser);

    for await (const row of parsingStream) {
      if (isFirstRow && !hasHeaderRow) {
        isFirstRow = false;

        if (providedHeaders.length) {
          headers = providedHeaders;
        } else {
          // If no header row and no provided headers, generate index-based headers
          headers = Object.keys(row).length > 0 ? Object.keys(row).map((_, i) => i.toString()) : [];
        }
      }

      // If hasHeaderRow = true, fast-csv already assigns keys as headers, so capture once
      if (hasHeaderRow && isFirstRow) {
        headers = Object.keys(row);
        isFirstRow = false;
      }

      // When headers are not set yet (edge case), set them now
      if (!headers.length) {
        headers = providedHeaders.length ? providedHeaders : Object.keys(row);
      }

      // Map row fields to headers - if keys mismatch, fallback to index-based mapping
      const record: Record<string, any> = {};
      for (let i = 0; i < headers.length; i++) {
        // For safety, access by header name or fallback by index
        const key = headers[i];
        const value = row[key] ?? Object.values(row)[i] ?? null;
        record[key] = value;
      }

      // Skip empty rows
      if (Object.values(record).every(v => v === null || v === '')) continue;

      page.push(record);

      if (page.length === pageSize) {
        yield { headers, data: page };
        hasYieldedData = true;
        page = [];
      }
    }

    if (page.length > 0) {
      yield { headers, data: page };
      hasYieldedData = true;
    }

    // If only headers present but no data, yield headers with empty data array
    if (!hasYieldedData && headers.length > 0) {
      yield { headers, data: [] };
    }
  }

}
