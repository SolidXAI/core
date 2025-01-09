import { SolidRegistry } from "src/helpers/solid-registry";
export declare class SeedData {
    seeder: string;
}
export declare class TestController {
    private readonly solidRegistry;
    private readonly logger;
    constructor(solidRegistry: SolidRegistry);
    uploadData(files: Array<Express.Multer.File>, body: any): {
        message: string;
        fileNames: string[];
        formData: any;
    };
    uploadFile(file: Express.Multer.File, body: any): {
        filename: string;
    };
    seedData(seedData: any): Promise<{
        message: string;
    }>;
}
