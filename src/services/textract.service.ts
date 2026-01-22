// src/services/textract.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import {
    TextractClient,
    StartDocumentTextDetectionCommand,
    GetDocumentTextDetectionCommand,
    StartDocumentAnalysisCommand,
    GetDocumentAnalysisCommand,
    Block as TextractBlock,
} from '@aws-sdk/client-textract';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'node:fs';
import { AwsS3Config } from 'src/interfaces';

@Injectable()
export class TextractService {
    private readonly logger = new Logger(TextractService.name);
    private readonly textractClient: TextractClient;
    private readonly s3Client: S3Client;

    constructor(
    ) {
        const awsS3Credentials = {
            S3_AWS_ACCESS_KEY: process.env.S3_AWS_ACCESS_KEY,
            S3_AWS_SECRET_KEY: process.env.S3_AWS_SECRET_KEY,
            S3_AWS_REGION_NAME: process.env.S3_AWS_REGION_NAME
        }
        if (!this.isValidS3Config(awsS3Credentials)) { return }
        this.s3Client = new S3Client({
            region: process.env.S3_AWS_REGION_NAME,
            credentials: {
                accessKeyId: process.env.S3_AWS_ACCESS_KEY,
                secretAccessKey: process.env.S3_AWS_SECRET_KEY,
            },
        });

        this.textractClient = new TextractClient({
            region: process.env.S3_AWS_REGION_NAME,
            credentials: {
                accessKeyId: process.env.S3_AWS_ACCESS_KEY,
                secretAccessKey: process.env.S3_AWS_SECRET_KEY,
            },
        });
    }

    private isValidS3Config(config: AwsS3Config): boolean {
        return !!config.S3_AWS_ACCESS_KEY && !!config.S3_AWS_SECRET_KEY && !!config.S3_AWS_REGION_NAME;
    }

    async uploadToS3(localPath: string, bucket: string, key: string) {
        const body = fs.createReadStream(localPath);
        await this.s3Client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: 'application/pdf',
        }));
    }

    async startTextDetection(bucket: string, key: string): Promise<string> {
        const res = await this.textractClient.send(new StartDocumentTextDetectionCommand({
            DocumentLocation: { S3Object: { Bucket: bucket, Name: key } },
        }));
        if (!res.JobId) throw new Error('Failed to start Textract job');
        return res.JobId;
    }

    /**
     * Polls Textract until SUCCEEDED and returns page chunks (with pagination handled).
     * Returns an array where each item corresponds to one GetDocumentTextDetection response page.
     */
    async getAllPages(jobId: string) {
        // poll
        let status = 'IN_PROGRESS';
        while (status === 'IN_PROGRESS') {
            await this.sleep(3000);
            const head = await this.textractClient.send(new GetDocumentTextDetectionCommand({ JobId: jobId, MaxResults: 1 }));
            status = head.JobStatus || 'IN_PROGRESS';
            if (status === 'FAILED') throw new Error('Textract job failed');
            if (status === 'SUCCEEDED') break;
        }

        // paginate
        const pages: any[] = [];
        let nextToken: string | undefined = undefined;
        do {
            const res = await this.textractClient.send(new GetDocumentTextDetectionCommand({
                JobId: jobId,
                NextToken: nextToken,
            }));
            pages.push(res);
            nextToken = res.NextToken;
        } while (nextToken);

        return pages;
    }

    private sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
    // New set of methods used for document analysis, not just text detection
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
    /**
     * Start async DocumentAnalysis (better for specs: TABLES + FORMS).
     */
    async startDocumentAnalysis(bucket: string, key: string, featureTypes: ('TABLES' | 'FORMS')[] = ['TABLES', 'FORMS']): Promise<string> {
        const res = await this.textractClient.send(new StartDocumentAnalysisCommand({
            DocumentLocation: { S3Object: { Bucket: bucket, Name: key } },
            FeatureTypes: featureTypes,
        }));
        if (!res.JobId) throw new Error('Failed to start Textract analysis job');
        return res.JobId;
    }

    /**
     * Wait for analysis job to finish, then fetch ALL pages (handles NextToken).
     * Returns a flat array of Blocks from all result pages.
     */
    async getAllAnalysisBlocks(jobId: string): Promise<TextractBlock[]> {
        // poll
        let status = 'IN_PROGRESS';
        while (status === 'IN_PROGRESS') {
            await this.sleep(3000);
            const head = await this.textractClient.send(new GetDocumentAnalysisCommand({ JobId: jobId, MaxResults: 1 }));
            status = head.JobStatus || 'IN_PROGRESS';
            if (status === 'FAILED') throw new Error('Textract analysis job failed');
            if (status === 'SUCCEEDED') break;
        }

        // paginate + collect blocks
        const blocks: TextractBlock[] = [];
        let nextToken: string | undefined = undefined;
        do {
            const res = await this.textractClient.send(new GetDocumentAnalysisCommand({
                JobId: jobId,
                NextToken: nextToken,
            }));
            if (res.Blocks?.length) blocks.push(...res.Blocks);
            nextToken = res.NextToken;
        } while (nextToken);

        return blocks;
    }

    /**
     * Collate LINE blocks into page-wise plain text,
     * sorted roughly top-to-bottom then left-to-right for better reading order.
     */
    collatePageWiseTextFromBlocks(blocks: TextractBlock[]): Record<string, string> {
        const byPage = new Map<number, TextractBlock[]>();

        for (const b of blocks ?? []) {
            if (b.BlockType === 'LINE' && b.Text) {
                const page = (b as any).Page ?? 1;
                if (!byPage.has(page)) byPage.set(page, []);
                byPage.get(page)!.push(b);
            }
        }

        const pages = Array.from(byPage.keys()).sort((a, b) => a - b);
        const result: Record<string, string> = {};

        for (const p of pages) {
            const lines = byPage.get(p)!;
            lines.sort((a: any, b: any) => {
                const at = a.Geometry?.BoundingBox?.Top ?? 0;
                const bt = b.Geometry?.BoundingBox?.Top ?? 0;
                if (Math.abs(at - bt) > 0.002) return at - bt; // row order
                const al = a.Geometry?.BoundingBox?.Left ?? 0;
                const bl = b.Geometry?.BoundingBox?.Left ?? 0;
                return al - bl; // within row
            });
            result[`page_${p}`] = lines.map((l: any) => l.Text).join('\n');
        }

        return result;
    }

    /**
     * Convenience: Run recommended flow end-to-end on a PDF in S3
     * and get `{ page_1: "...", page_2: "..." }`.
     */
    async analyzePdfInS3ToPageWiseText(bucket: string, key: string): Promise<Record<string, string>> {
        this.logger.debug(`Starting DocumentAnalysis for s3://${bucket}/${key}`);
        const jobId = await this.startDocumentAnalysis(bucket, key, ['TABLES', 'FORMS']);
        const blocks = await this.getAllAnalysisBlocks(jobId);
        const pageWise = this.collatePageWiseTextFromBlocks(blocks);
        this.logger.debug(`Completed DocumentAnalysis for s3://${bucket}/${key} with ${Object.keys(pageWise).length} pages`);
        return pageWise;
    }
}