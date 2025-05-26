import { PassThrough, Readable } from 'stream';
import { format } from 'fast-csv';
import { Injectable, Logger } from '@nestjs/common';
import { get } from 'http';

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

}
