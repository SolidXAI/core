import { Provider } from '@nestjs/common';
import { FILE_SERVICE, IFileService } from './file-service.interface';
import { DiskFileService } from './disk-file.service';
import { S3FileService } from './s3-file.service';

/**
 * Factory provider for IFileService.
 *
 * Selects the appropriate file service implementation based on
 * the DEFAULT_FILE_SERVICE environment variable.
 *
 * Values:
 * - 'disk' (default): Uses DiskFileService for local filesystem operations
 * - 's3': Uses S3FileService for AWS S3 operations
 */
export const FileServiceFactory: Provider = {
  provide: FILE_SERVICE,
  useFactory: (diskFileService: DiskFileService, s3FileService: S3FileService): IFileService => {
    const defaultService = process.env.DEFAULT_FILE_SERVICE ?? 'disk';

    switch (defaultService.toLowerCase()) {
      case 's3':
        return s3FileService;
      case 'disk':
      default:
        return diskFileService;
    }
  },
  inject: [DiskFileService, S3FileService],
};
