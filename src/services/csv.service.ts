import { PassThrough, Readable } from 'stream';
import { format } from 'fast-csv';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CsvService {
  private logger = new Logger(CsvService.name);
  public async createCsvStream(
    getDataRecords: (chunkIndex: number, chunkSize: number) => Promise<any[]>,
    chunkSize: number
  ): Promise<Readable> {
    const passThrough = new PassThrough(); // ✅ Create a streaming pipe
    const csvStream = format({ headers: true });

    csvStream.pipe(passThrough); // ✅ Pipe CSV output to PassThrough stream

    let chunkIndex = 0;

    try {
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
