import { HashingService } from './hashing.service';
export declare class BcryptService implements HashingService {
    hash(data: string | Buffer): Promise<string>;
    compare(data: string | Buffer, encrypted: string): Promise<boolean>;
}
