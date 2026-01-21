import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { compare as bcryptCompare, genSalt, hash as bcryptHash } from 'bcrypt';
import { HashingService } from './hashing.service';
import { SettingService } from './setting.service';
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";

@Injectable()
export class BcryptService implements HashingService {
    constructor(
        readonly settingService: SettingService,
    ) { }

    private readonly rounds = 12;

    async hash(data: string | Buffer): Promise<string> {
        const salt = await genSalt(this.rounds);
        const normalized = await this.normalize(data, this.currentVersion());
        return bcryptHash(normalized, salt);
    }

    async compare(
        data: string | Buffer,
        hashed: string,
        hashVersion: number = this.currentVersion()
    ): Promise<boolean> {
        const normalized = await this.normalize(data, hashVersion);
        return bcryptCompare(normalized, hashed);
    }

    needsRehash(_hashed: string, hashVersion: number = this.currentVersion()): boolean {
        return hashVersion < this.currentVersion();
    }

    /** Current hashing policy version (bump when you change rounds/pepper rules) */
    currentVersion(): number {
        return 2;
    }

    /** Name of the hashing scheme */
    name(): string {
        return 'bcrypt';
    }

    /** Normalize input based on version & pepper policy */
    private async normalize(data: string | Buffer, version: number): Promise<string> {
        const pepper = this.settingService.getConfigValue<SolidCoreSetting>('passwordPepper')
        const plain = typeof data === 'string' ? data : data.toString('utf8');
        const usePepper = version >= 2 && pepper.length > 0;
        return usePepper ? plain + pepper : plain;
    }

}