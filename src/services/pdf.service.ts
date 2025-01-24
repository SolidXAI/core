import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

@Injectable()
export class PdfService {
  async generatePdf(html: string): Promise<Uint8Array> {
    // Launch a new browser instance
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
  
    // Set the HTML content
    await page.setContent(html);
  
    // Generate the PDF and store it in a buffer
    const pdfBuffer = await page.pdf({ format: 'A4' });
  
    // Close the browser
    await browser.close();
  
    // Convert the Uint8Array to a Buffer
    // const buffer = Buffer.from(pdfBuffer);
  
    // Return the generated PDF as a buffer
    // return buffer;
    return pdfBuffer
  }
}
