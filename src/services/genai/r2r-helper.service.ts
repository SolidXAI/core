import { Injectable, Logger } from '@nestjs/common';

import { r2rClient } from 'r2r-js';
import { SettingService } from '../setting.service';



@Injectable()
export class R2RHelperService {
    private readonly logger = new Logger(R2RHelperService.name);

    constructor(private readonly settingService: SettingService) { }

    async getClient() {
        const ragServerUrl = this.settingService.getConfigValue('ragServerUrl');
        this.logger.debug(`Attempting to create RAG client with url: ${ragServerUrl}`);
        const client = new r2rClient(ragServerUrl);

        const ragServerLogin = this.settingService.getConfigValue('ragServerLogin');
        // @ts-ignore
        this.logger.debug(`Attempting to login to our RAG server with user ${ragServerLogin}`)
        await client.users.login({
            email: ragServerLogin,
            password: this.settingService.getConfigValue('ragServerPassword')
        });

        return client;
    }

    // async checkHealth() {
    //     const client = new r2rClient('http://localhost:7272');

    //     return await client.health();
    // }

}