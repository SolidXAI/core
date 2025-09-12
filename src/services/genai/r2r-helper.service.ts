import { Injectable, Logger } from '@nestjs/common';

import { r2rClient } from 'r2r-js';



@Injectable()
export class R2RHelperService {
    private readonly logger = new Logger(R2RHelperService.name);

    constructor() { }

    async getClient() {
        this.logger.debug(`Attempting to create RAG client with url: ${process.env.GENAI_RAG_SERVER_URL}`);
        const client = new r2rClient(process.env.GENAI_RAG_SERVER_URL);

        // @ts-ignore
        this.logger.debug(`Attempting to login to our RAG server with user ${process.env.GENAI_RAG_SERVER_LOGIN}`)
        await client.users.login({
            email: process.env.GENAI_RAG_SERVER_LOGIN,
            password: process.env.GENAI_RAG_SERVER_PASSWORD
        });

        return client;
    }

    // async checkHealth() {
    //     const client = new r2rClient('http://localhost:7272');

    //     return await client.health();
    // }

}