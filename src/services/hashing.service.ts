import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class HashingService {
    abstract hash(data: string | Buffer): Promise<string>;
    abstract compare(data: string | Buffer, hash: string, hashVersion: number): Promise<boolean>;
    abstract needsRehash(hash: string, hashVersion: number): boolean;
    abstract currentVersion(): number;
    abstract name(): string;
}