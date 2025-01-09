export declare abstract class HashingService {
    abstract hash(data: string | Buffer): Promise<string>;
    abstract compare(data: string | Buffer, encrypted: string): Promise<boolean>;
}
