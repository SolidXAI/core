import { Inject, Injectable, Scope } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { REQUEST_USER_KEY } from "src/constants";
import { ActiveUserData } from "src/interfaces/active-user-data.interface";

@Injectable({scope: Scope.REQUEST})
export class RequestContextService {
    constructor(@Inject(REQUEST) private readonly request: Request) {
    }

    // This method i.e getActiveUser() will fetch the user from the request object in the context
    getActiveUser() {
        return this.request[REQUEST_USER_KEY] as ActiveUserData| undefined;
    }

}