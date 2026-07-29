export type MediaCategory = 'image' | 'audio' | 'video' | 'file' | 'pdf';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'heic', 'heif'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'webm'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'mpeg', 'mpg', '3gp', '3g2', 'webm', 'ogg'];
const DOCUMENT_EXTENSIONS = ['txt', 'md', 'csv', 'json', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', '7z'];
const PDF_EXTENSION = 'pdf';

/**
 * Extensions that must never be accepted as media uploads, regardless of declared mimetype or
 * admin-configured mediaTypes allowlist. Checked before any other resolution so a spoofed
 * Content-Type (e.g. application/octet-stream on an .html file) can't bypass this.
 */
export const DANGEROUS_EXTENSIONS = new Set([
    'html', 'htm', 'xhtml', 'svg', 'xml',
    'js', 'mjs', 'php', 'phtml', 'jsp', 'asp', 'aspx',
    'exe', 'sh', 'bat', 'cmd', 'ps1', 'jar', 'dll',
]);

/**
 * Mimetypes that are never safe to accept, regardless of extension. These render as active
 * content in a browser (svg can carry <script>), so they are rejected even when the filename
 * looks harmless. Kept alongside DANGEROUS_EXTENSIONS so upload paths check both.
 */
export const DANGEROUS_MIME_TYPES = new Set([
    'image/svg+xml', 'text/html', 'application/xhtml+xml',
]);

export function getLowercaseFileExtension(fileName?: string | null): string | undefined {
    if (!fileName) {
        return undefined;
    }

    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex < 0 || lastDotIndex === fileName.length - 1) {
        return undefined;
    }

    return fileName.slice(lastDotIndex + 1).toLowerCase();
}

/** Minimal shape of an uploaded file, so this module stays free of framework imports. */
export interface UploadedFileLike {
    mimetype?: string;
    originalname?: string;
    filename?: string;
}

/** originalname is the client-supplied name; filename is multer's on-disk name. */
export function getUploadedFileName(file?: UploadedFileLike | null): string {
    return file?.originalname ?? file?.filename ?? '';
}

/**
 * Single predicate for "must never be stored". Shared by every upload entry point
 * (MediaFieldCrudManager, chatter attachments) so the rules can't drift between them.
 * Extension is checked before mimetype so a spoofed Content-Type (e.g.
 * application/octet-stream on an .html file) can't bypass it.
 */
export function isDangerousMediaFile(file?: UploadedFileLike | null): boolean {
    const ext = getLowercaseFileExtension(getUploadedFileName(file));
    if (ext && DANGEROUS_EXTENSIONS.has(ext)) {
        return true;
    }

    return DANGEROUS_MIME_TYPES.has((file?.mimetype || '').toLowerCase().trim());
}

/**
 * Single source of truth for extension -> coarse media category. Shared by upload-time
 * validation (MediaFieldCrudManager) and serve-time header hardening (ServeStaticModule), so
 * both agree on which extensions belong to which category and neither drifts out of sync.
 * webm/ogg are shared between AUDIO_EXTENSIONS and VIDEO_EXTENSIONS - last one wins here, they
 * default to 'video' since that's the more common upload case.
 */
export const EXT_TO_MEDIA_TYPE: Record<string, MediaCategory> = {
    ...Object.fromEntries(IMAGE_EXTENSIONS.map((ext) => [ext, 'image' as const])),
    ...Object.fromEntries(AUDIO_EXTENSIONS.map((ext) => [ext, 'audio' as const])),
    ...Object.fromEntries(VIDEO_EXTENSIONS.map((ext) => [ext, 'video' as const])),
    ...Object.fromEntries(DOCUMENT_EXTENSIONS.map((ext) => [ext, 'file' as const])),
    [PDF_EXTENSION]: 'pdf',
};

/**
 * Extensions safe to serve inline with their natural Content-Type; everything else served from
 * media-files-storage is forced to application/octet-stream + Content-Disposition: attachment.
 */
export const INLINE_SAFE_EXTENSIONS = new Set<string>([
    ...IMAGE_EXTENSIONS,
    ...AUDIO_EXTENSIONS,
    ...VIDEO_EXTENSIONS,
    PDF_EXTENSION,
]);
