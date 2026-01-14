import { Injectable, Logger } from '@nestjs/common';

export interface ImageToBase64Result {
    base64: string;
    mediaType: string;
}

@Injectable()
export class ImageEncodingService {
    private readonly logger = new Logger(ImageEncodingService.name);

    /**
     * Fetch an image from a URL and return its Base64 representation.
     *
     * @param url - Public or signed image URL
     * @param mimeTypeOverride - Optional MIME type (image/png, image/jpeg)
     * @param maxSizeBytes - Optional max size guard (default 5MB)
     */
    async imageUrlToBase64(
        url: string,
        mimeTypeOverride?: string,
        maxSizeBytes = 5 * 1024 * 1024, 
    ): Promise<ImageToBase64Result> {
        this.logger.debug(`Fetching image from URL: ${url}`);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                `Failed to fetch image (${response.status} ${response.statusText})`,
            );
        }

        const contentType =
            mimeTypeOverride ||
            response.headers.get('content-type') ||
            'image/jpeg';

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length > maxSizeBytes) {
            throw new Error(
                `Image size ${buffer.length} bytes exceeds limit of ${maxSizeBytes} bytes`,
            );
        }

        return {
            base64: buffer.toString('base64'),
            mediaType: contentType,
        };
    }

    /**
     * Convenience method that returns a data URL
     * (useful for OpenAI Responses API).
     */
    async imageUrlToDataUrl(
        url: string,
        mimeTypeOverride?: string,
        maxSizeBytes?: number,
    ): Promise<string> {
        const { base64, mediaType } = await this.imageUrlToBase64(
            url,
            mimeTypeOverride,
            maxSizeBytes,
        );

        return `data:${mediaType};base64,${base64}`;
    }
}