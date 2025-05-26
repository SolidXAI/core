import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PassThrough, Readable } from 'stream';


@Injectable()
export class ExcelService {
  private logger = new Logger(ExcelService.name);
  // Sample JSON data
  // const jsonData = [
  //   { id: 1, name: 'John Doe', age: 25, email: 'john@example.com' },
  //   { id: 2, name: 'Jane Doe', age: 28, email: 'jane@example.com' },
  //   { id: 3, name: 'Alice Smith', age: 30, email: 'alice@example.com' }
  // ];

  // public async createExcelFromJson(data: any[], fileName: string) {
  //   const workbook = new ExcelJS.Workbook();
  //   const worksheet = workbook.addWorksheet('Data');

  //   // Define Columns (Header)
  //   worksheet.columns = Object.keys(data[0]).map((key) => ({
  //     header: key.toUpperCase(), // Convert header names to uppercase
  //     key: key,
  //     width: 20, // Set column width
  //   }));

  //   // Add Data Rows
  //   data.forEach((item) => {
  //     worksheet.addRow(item);
  //   });

  //   // Apply basic formatting
  //   worksheet.getRow(1).font = { bold: true }; // Make headers bold

  //   // Save file
  //   await workbook.xlsx.writeFile(fileName);
  //   this.logger.log(`✅ Excel file "${fileName}" created successfully!`);
  //   // console.log(`✅ Excel file "${fileName}" created successfully!`);
  // }

  // public async createExcelStreamFromJson(data: any[]): Promise<Readable> {
  //   const passThrough = new PassThrough(); // Stream to pipe data
  //   const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: passThrough });
  //   const worksheet = workbook.addWorksheet('Data');
  //   worksheet.columns = Object.keys(data[0]).map((key) => ({
  //     header: key.toUpperCase(),
  //     key: key,
  //     width: 20,
  //   }));

  //   data.forEach((item) => {
  //     worksheet.addRow(item);
  //   });

  //   worksheet.getRow(1).font = { bold: true };

  //   await workbook.commit();
  //   return passThrough;
  // }


  public async createExcelStream(
    getDataRecords: (chunkIndex: number, chunkSize: number) => Promise<any[]>,
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

    const passThrough = new PassThrough(); // Create streaming pipe
    try {
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: passThrough });
      const worksheet = workbook.addWorksheet('Data');

      // If headers are provided, use them;
      if (headers.length > 0) {
        worksheet.columns = headers.map((header) => ({
          header: header, // Convert header names to uppercase
          key: header,
          width: 20, // Set column width
        }));
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

        records.forEach((item) => {
          worksheet.addRow(item).commit(); // Commit each row immediately
        });

        chunkIndex++; // Fetch next chunk
        this.logger.debug(`✅ Chunk ${chunkIndex} written to Excel`);
      }

      await workbook.commit();
      // passThrough.end(); // ✅ Properly close the stream
    } catch (error) {
      this.logger.error(`❌ Error writing Excel: ${error.message}`);
      passThrough.destroy(error); // Destroy stream
      throw error;
    }
    return passThrough; // Return streaming response
  }

}