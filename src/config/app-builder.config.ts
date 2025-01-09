import { registerAs } from '@nestjs/config';

const DEFAULT_MEDIA_UPLOAD_DIR = 'media-uploads';
const DEFAULT_MEDIA_FILE_STORAGE_DIR = 'media-files-storage';

export default registerAs('app-builder', () => {
    return {
        moduleMetadataSeederFiles: process.env.AB_MODULE_METADATA_SEEDER_FILES ?? '',
        uploadDir: process.env.AB_MEDIA_UPLOAD_DIR ?? DEFAULT_MEDIA_UPLOAD_DIR,
        fileStorageDir: process.env.AB_MEDIA_FILE_STORAGE_DIR ?? DEFAULT_MEDIA_FILE_STORAGE_DIR,
    };
});
