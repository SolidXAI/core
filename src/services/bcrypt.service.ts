import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { compare as bcryptCompare, genSalt, hash as bcryptHash } from 'bcrypt';
import { iamConfig } from 'src/config/iam.config';
import { HashingService } from './hashing.service';

@Injectable()
export class BcryptService implements HashingService {
    constructor(
        @Inject(iamConfig.KEY)
        private readonly iamConfiguration: ConfigType<typeof iamConfig>,
    ) { }

    private readonly rounds = 12;
    private readonly pepper = this.iamConfiguration.passwordPepper ?? '';

    async hash(data: string | Buffer): Promise<string> {
        const salt = await genSalt(this.rounds);
        const normalized = this.normalize(data, this.currentVersion());
        return bcryptHash(normalized, salt);
    }

    async compare(
        data: string | Buffer,
        hashed: string,
        hashVersion: number = this.currentVersion()
    ): Promise<boolean> {
        const normalized = this.normalize(data, hashVersion);
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
    private normalize(data: string | Buffer, version: number): string {
        const plain = typeof data === 'string' ? data : data.toString('utf8');
        const usePepper = version >= 2 && this.pepper.length > 0;
        return usePepper ? plain + this.pepper : plain;
    }

}