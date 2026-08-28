import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { copyFile, constants, mkdir } from 'fs/promises';
import { join } from 'path';

import {
  DEFAULT_MEDIA_FILE_STORAGE_DIR,
} from './settings/default-settings-provider.service';

const DEFAULT_MODULE_ICON = 'solid-core-menu-icon.png';

/**
 * Installs the bundled Solid Core icon into the consuming application's
 * runtime file storage. The browser can then load it through the existing
 * /media-files-storage static route.
 */
@Injectable()
export class ModuleIconAssetService implements OnModuleInit {
  private readonly logger = new Logger(ModuleIconAssetService.name);

  async onModuleInit(): Promise<void> {
    const packageAssetPath = join(
      __dirname,
      '..',
      '..',
      DEFAULT_MEDIA_FILE_STORAGE_DIR,
      DEFAULT_MODULE_ICON,
    );
    // The existing ServeStaticModule exposes the default directory at
    // /media-files-storage, so the bundled asset must be installed there.
    const storageDirectory = DEFAULT_MEDIA_FILE_STORAGE_DIR;
    const runtimeIconPath = join(process.cwd(), storageDirectory, DEFAULT_MODULE_ICON);

    try {
      await mkdir(join(process.cwd(), storageDirectory), { recursive: true });
      await copyFile(packageAssetPath, runtimeIconPath, constants.COPYFILE_EXCL);
      this.logger.log(`Installed bundled module icon at ${runtimeIconPath}`);
    } catch (error: any) {
      if (error?.code === 'EEXIST') {
        return;
      }

      this.logger.warn(`Unable to install bundled module icon: ${error?.message || error}`);
    }
  }
}
