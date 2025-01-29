import { HttpService } from "@nestjs/axios";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import commonConfig from "src/config/common.config";
import { CreateShortUrlDto } from "src/dtos/create-short-url.dto";

interface TinyUrlRequest {
    url: string;
    domain: string;
    description: string;
    tags: string;
}

interface TinyUrlResponse {
    data: TinyUrlResponseData;
    code: number;
    errors: string[];
}

interface TinyUrlResponseData {
    domain: string;
    alias: string;
    deleted: boolean;
    archived: boolean;
    analytics: {
        enabled: boolean;
        public: boolean;
    };
    tags: string[];
    created_at: string;
    expires_at: string;
    tiny_url: string;
    url: string;
}

@Injectable()
export class TinyUrlService {
    constructor(
        @Inject(commonConfig.KEY)
        private readonly commonConfiguration: ConfigType<typeof commonConfig>,
        private readonly httpService: HttpService,
    ) { }
    protected readonly logger = new Logger(TinyUrlService.name);
    async shortenUrl(shortUrlDto: CreateShortUrlDto): Promise<string> {
        if (!this.commonConfiguration.shortUrl.enabled) {
            return shortUrlDto.url;
        }
        const shortUrlApiUrl = `${this.commonConfiguration.shortUrl.apiUrl}/create?api_token=${this.commonConfiguration.shortUrl.apiKey}`;
        const body = this.createTinyUrlRequest(shortUrlDto)
        const response = await this.httpService.axiosRef.post(shortUrlApiUrl, body);
        const tinyUrlResponse = response.data as TinyUrlResponse;
        const tinyUrl = tinyUrlResponse.data.tiny_url;
        this.logger.debug(`Shortening URL ${shortUrlDto.url} to ${tinyUrl}`);
        return tinyUrl;
    }

    private createTinyUrlRequest(shortUrlDto: CreateShortUrlDto): TinyUrlRequest {
        return { url: shortUrlDto.url, domain: shortUrlDto.domain, description: shortUrlDto.description, tags: shortUrlDto.tags.join(',') };
    }
}