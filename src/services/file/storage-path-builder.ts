import { Injectable, Provider } from '@nestjs/common';
import { resolveDiskMediaPath } from './media-storage-paths';

export const FILE_STORAGE_PATH_BUILDER = Symbol('FILE_STORAGE_PATH_BUILDER');

export interface IStoragePathBuilder {
  build(fileName: string): string;
}

@Injectable()
export class DiskStoragePathBuilder implements IStoragePathBuilder {
  build(fileName: string): string {
    return resolveDiskMediaPath(fileName);
  }
}

@Injectable()
export class S3StoragePathBuilder implements IStoragePathBuilder {
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.S3_DEFAULT_BUCKET ?? '';
  }

  build(fileName: string): string {
    if (fileName.includes(':')) {
      return fileName;
    }
    return `${this.bucket}:${fileName}`;
  }
}

export const StoragePathBuilderFactory: Provider = {
  provide: FILE_STORAGE_PATH_BUILDER,
  useFactory: (disk: DiskStoragePathBuilder, s3: S3StoragePathBuilder): IStoragePathBuilder => {
    const defaultService = process.env.DEFAULT_FILE_SERVICE ?? 'disk';
    switch (defaultService.toLowerCase()) {
      case 's3':
        return s3;
      case 'disk':
      default:
        return disk;
    }
  },
  inject: [DiskStoragePathBuilder, S3StoragePathBuilder],
};
