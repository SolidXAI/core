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
    chunkSize: number
  ): Promise<Readable> {
    const passThrough = new PassThrough(); // Create streaming pipe
    try {
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: passThrough });
      const worksheet = workbook.addWorksheet('Data');

      let chunkIndex = 0;
      let isHeaderWritten = false;

      while (true) {
        const records = await getDataRecords(chunkIndex, chunkSize); // Fetch chunked data
        if (records.length === 0) break; // Stop if no more records

        if (!isHeaderWritten) {
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

      await workbook.commit();

    } catch (error) {
      this.logger.error(`❌ Error writing Excel: ${error.message}`);
      passThrough.destroy(error); // Destroy stream

    } return passThrough; // Return streaming response
  }

}