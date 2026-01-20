import { HttpService } from "@nestjs/axios";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { CreateShortUrlDto } from "src/dtos/create-short-url.dto";
import { SettingService } from "../setting.service";

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
        private readonly httpService: HttpService,
        private readonly settingService: SettingService
    ) { }
    protected readonly logger = new Logger(TinyUrlService.name);
    async shortenUrl(shortUrlDto: CreateShortUrlDto): Promise<string> {
        const shotyUrlEnable = await this.settingService.getConfigValue("tinyUrl", "tinyUrlEnabled")
        const shotyUrlapiUrl = await this.settingService.getConfigValue("tinyUrl", "tinyUrlApiUrl")
        const shotyUrlApiKey = await this.settingService.getConfigValue("tinyUrl", "tinyUrlApiKey")
        if (!shotyUrlEnable) {
            return shortUrlDto.url;
        }
        const shortUrlApiUrl = `${shotyUrlapiUrl}/create?api_token=${shotyUrlApiKey}`;
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