import { Injectable } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { REQUEST_USER_KEY } from "src/constants";

@Injectable()
export class RequestContextService {
    constructor(private readonly cls: ClsService) {
    }

    // This method i.e getActiveUser() will fetch the user from the request object in the context
    getActiveUser() {
        return this.cls.get(REQUEST_USER_KEY);
    }

    getIp(): string | undefined {
        return this.cls.get('ipAddress');
    }

    getUserAgent(): string | undefined {
        return this.cls.get('userAgent');
    }

}