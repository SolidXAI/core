"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TinyUrlService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TinyUrlService = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const common_config_1 = require("../../config/common.config");
let TinyUrlService = TinyUrlService_1 = class TinyUrlService {
    constructor(commonConfiguration, httpService) {
        this.commonConfiguration = commonConfiguration;
        this.httpService = httpService;
        this.logger = new common_1.Logger(TinyUrlService_1.name);
    }
    async shortenUrl(shortUrlDto) {
        if (!this.commonConfiguration.shortUrl.enabled) {
            return shortUrlDto.url;
        }
        const shortUrlApiUrl = `${this.commonConfiguration.shortUrl.apiUrl}/create?api_token=${this.commonConfiguration.shortUrl.apiKey}`;
        const body = this.createTinyUrlRequest(shortUrlDto);
        const response = await this.httpService.axiosRef.post(shortUrlApiUrl, body);
        const tinyUrlResponse = response.data;
        const tinyUrl = tinyUrlResponse.data.tiny_url;
        this.logger.debug(`Shortening URL ${shortUrlDto.url} to ${tinyUrl}`);
        return tinyUrl;
    }
    createTinyUrlRequest(shortUrlDto) {
        return { url: shortUrlDto.url, domain: shortUrlDto.domain, description: shortUrlDto.description, tags: shortUrlDto.tags.join(',') };
    }
};
exports.TinyUrlService = TinyUrlService;
exports.TinyUrlService = TinyUrlService = TinyUrlService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(common_config_1.default.KEY)),
    __metadata("design:paramtypes", [void 0, axios_1.HttpService])
], TinyUrlService);
//# sourceMappingURL=tiny-url.service.js.map