import { Injectable, Provider } from '@nestjs/common';
import * as path from 'path';
import { DEFAULT_MEDIA_FILE_STORAGE_DIR } from '../settings/default-settings-provider.service';

export const FILE_STORAGE_PATH_BUILDER = Symbol('FILE_STORAGE_PATH_BUILDER');

export interface IStoragePathBuilder {
  build(fileName: string): string;
}

@Injectable()
export class DiskStoragePathBuilder implements IStoragePathBuilder {
  private readonly base: string;

  constructor() {
    this.base = process.env.AB_MEDIA_FILE_STORAGE_DIR || DEFAULT_MEDIA_FILE_STORAGE_DIR;
  }

  build(fileName: string): string {
    if (path.isAbsolute(fileName) || fileName.startsWith(`${this.base}/`)) {
      return fileName;
    }
    return `${this.base}/${fileName}`;
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
