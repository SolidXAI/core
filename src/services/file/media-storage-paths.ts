import * as path from 'path';
import { DEFAULT_MEDIA_FILE_STORAGE_DIR } from '../settings/default-settings-provider.service';

// URL prefix public disk media is served under (ServeStaticModule serveRoot).
// Fixed on purpose: it does not follow the on-disk location, so stored values such as
// menuIconUrl = "media-files-storage/x.png" keep working when the root moves.
export const PUBLIC_MEDIA_URL_PREFIX = 'media-files-storage';

export function getMediaStorageRoot(): string {
  return path.resolve(process.env.AB_MEDIA_FILE_STORAGE_ROOT || process.cwd());
}

export function getMediaStorageDirName(): string {
  return process.env.AB_MEDIA_FILE_STORAGE_DIR || DEFAULT_MEDIA_FILE_STORAGE_DIR;
}

export function getPublicMediaStorageDir(): string {
  return path.join(getMediaStorageRoot(), getMediaStorageDirName());
}

export function getPrivateMediaStorageDir(): string {
  return path.join(getMediaStorageRoot(), `${getMediaStorageDirName()}-private`);
}

// Resolves a stored file name (Media.relativeUri, or a freshly built stored name) to an
// absolute path under the configured root.
export function resolveDiskMediaPath(fileName: string, isPublic = true): string {
  if (path.isAbsolute(fileName)) {
    return fileName;
  }
  const dirName = getMediaStorageDirName();
  // Legacy values that already carry the folder name, e.g. "media-files-storage/x.png".
  if (fileName.startsWith(`${dirName}-private/`)) {
    return path.join(getPrivateMediaStorageDir(), fileName.slice(`${dirName}-private/`.length));
  }
  if (fileName.startsWith(`${dirName}/`)) {
    return path.join(getPublicMediaStorageDir(), fileName.slice(`${dirName}/`.length));
  }
  return path.join(isPublic ? getPublicMediaStorageDir() : getPrivateMediaStorageDir(), fileName);
}

// Maps a disk path inside the public media dir to its URL path ("media-files-storage/…",
// no leading slash). Returns null for anything outside the public dir.
export function toPublicMediaUrlPath(diskPath: string): string | null {
  const relative = path.relative(getPublicMediaStorageDir(), path.resolve(diskPath));
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return null;
  }
  return `${PUBLIC_MEDIA_URL_PREFIX}/${relative.split(path.sep).join('/')}`;
}
