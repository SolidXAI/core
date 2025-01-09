import { HttpService } from "@nestjs/axios";
import { Logger } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import commonConfig from "src/config/common.config";
import { CreateShortUrlDto } from "src/dtos/create-short-url.dto";
export declare class TinyUrlService {
    private readonly commonConfiguration;
    private readonly httpService;
    constructor(commonConfiguration: ConfigType<typeof commonConfig>, httpService: HttpService);
    protected readonly logger: Logger;
    shortenUrl(shortUrlDto: CreateShortUrlDto): Promise<string>;
    private createTinyUrlRequest;
}
