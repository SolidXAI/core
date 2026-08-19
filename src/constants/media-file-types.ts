export type MediaCategory = 'image' | 'audio' | 'video' | 'file' | 'pdf';

export const MEDIA_CATEGORIES = ['image', 'audio', 'video', 'file', 'pdf'] as const;

export type MediaFileTypeDefinition = {
    mediaType: MediaCategory;
    mimeType: string;
    extension: string;
};

// Single source of truth for every supported media extension, its canonical MIME type,
// and the coarse media category used across validation and UI metadata.
export const MEDIA_FILE_TYPES: MediaFileTypeDefinition[] = [
    { mediaType: 'image', mimeType: 'image/png', extension: 'png' },
    { mediaType: 'image', mimeType: 'image/jpeg', extension: 'jpg' },
    { mediaType: 'image', mimeType: 'image/jpg', extension: 'jpg' },
    { mediaType: 'image', mimeType: 'image/jpeg', extension: 'jpeg' },
    { mediaType: 'image', mimeType: 'image/webp', extension: 'webp' },
    { mediaType: 'image', mimeType: 'image/gif', extension: 'gif' },
    { mediaType: 'image', mimeType: 'image/bmp', extension: 'bmp' },
    { mediaType: 'image', mimeType: 'image/tiff', extension: 'tiff' },
    { mediaType: 'image', mimeType: 'image/heic', extension: 'heic' },
    { mediaType: 'image', mimeType: 'image/heif', extension: 'heif' },

    { mediaType: 'audio', mimeType: 'audio/mpeg', extension: 'mp3' },
    { mediaType: 'audio', mimeType: 'audio/mp3', extension: 'mp3' },
    { mediaType: 'audio', mimeType: 'audio/wav', extension: 'wav' },
    { mediaType: 'audio', mimeType: 'audio/x-wav', extension: 'wav' },
    { mediaType: 'audio', mimeType: 'audio/ogg', extension: 'ogg' },
    { mediaType: 'audio', mimeType: 'audio/aac', extension: 'aac' },
    { mediaType: 'audio', mimeType: 'audio/mp4', extension: 'm4a' },
    { mediaType: 'audio', mimeType: 'audio/x-m4a', extension: 'm4a' },
    { mediaType: 'audio', mimeType: 'audio/flac', extension: 'flac' },
    { mediaType: 'audio', mimeType: 'audio/webm', extension: 'webm' },

    { mediaType: 'video', mimeType: 'video/mp4', extension: 'mp4' },
    { mediaType: 'video', mimeType: 'video/quicktime', extension: 'mov' },
    { mediaType: 'video', mimeType: 'video/x-msvideo', extension: 'avi' },
    { mediaType: 'video', mimeType: 'video/x-matroska', extension: 'mkv' },
    { mediaType: 'video', mimeType: 'video/mpeg', extension: 'mpeg' },
    { mediaType: 'video', mimeType: 'video/mpeg', extension: 'mpg' },
    { mediaType: 'video', mimeType: 'video/3gpp', extension: '3gp' },
    { mediaType: 'video', mimeType: 'video/3gpp2', extension: '3g2' },
    { mediaType: 'video', mimeType: 'video/webm', extension: 'webm' },
    { mediaType: 'video', mimeType: 'video/ogg', extension: 'ogg' },

    { mediaType: 'file', mimeType: 'text/plain', extension: 'txt' },
    { mediaType: 'file', mimeType: 'text/markdown', extension: 'md' },
    { mediaType: 'file', mimeType: 'text/csv', extension: 'csv' },
    { mediaType: 'file', mimeType: 'application/json', extension: 'json' },
    { mediaType: 'file', mimeType: 'application/msword', extension: 'doc' },
    { mediaType: 'file', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx' },
    { mediaType: 'file', mimeType: 'application/vnd.ms-excel', extension: 'xls' },
    { mediaType: 'file', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' },
    { mediaType: 'file', mimeType: 'application/vnd.ms-powerpoint', extension: 'ppt' },
    { mediaType: 'file', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extension: 'pptx' },
    { mediaType: 'file', mimeType: 'application/zip', extension: 'zip' },
    { mediaType: 'file', mimeType: 'application/x-zip-compressed', extension: 'zip' },
    { mediaType: 'file', mimeType: 'application/x-rar-compressed', extension: 'rar' },
    { mediaType: 'file', mimeType: 'application/x-7z-compressed', extension: '7z' },

    { mediaType: 'pdf', mimeType: 'application/pdf', extension: 'pdf' },
];

const createMediaTypeBuckets = (): Record<MediaCategory, string[]> => ({
    image: [],
    audio: [],
    video: [],
    file: [],
    pdf: [],
});

export const MEDIA_TYPE_TO_EXTENSIONS: Record<MediaCategory, string[]> = MEDIA_FILE_TYPES.reduce((acc, fileType) => {
    if (!acc[fileType.mediaType].includes(fileType.extension)) {
        acc[fileType.mediaType].push(fileType.extension);
    }
    return acc;
}, createMediaTypeBuckets());

export const IMAGE_EXTENSIONS = MEDIA_TYPE_TO_EXTENSIONS.image;
export const AUDIO_EXTENSIONS = MEDIA_TYPE_TO_EXTENSIONS.audio;
export const VIDEO_EXTENSIONS = MEDIA_TYPE_TO_EXTENSIONS.video;
export const DOCUMENT_EXTENSIONS = MEDIA_TYPE_TO_EXTENSIONS.file;
export const PDF_EXTENSION = 'pdf';

export const EXTENSION_TO_MIME_TYPE: Record<string, string> = MEDIA_FILE_TYPES.reduce((acc, fileType) => {
    if (!(fileType.extension in acc)) {
        acc[fileType.extension] = fileType.mimeType;
    }
    return acc;
}, {} as Record<string, string>);

export const MIME_TO_MEDIA_TYPE: Record<string, MediaCategory> = MEDIA_FILE_TYPES.reduce((acc, fileType) => {
    if (!(fileType.mimeType in acc)) {
        acc[fileType.mimeType] = fileType.mediaType;
    }
    return acc;
}, {} as Record<string, MediaCategory>);

/**
 * Extensions that must never be accepted as media uploads, regardless of declared mimetype or
 * admin-configured mediaTypes allowlist. Checked before any other resolution so a spoofed
 * Content-Type (e.g. application/octet-stream on an .html file) can't bypass this.
 */
export const DANGEROUS_EXTENSIONS = new Set([
    'html', 'htm', 'xhtml', 'svg', 'xml',
    'js', 'mjs', 'php', 'phtml', 'jsp', 'asp', 'aspx',
    'exe', 'sh', 'bat', 'cmd', 'ps1', 'jar', 'dll',
    'msi', 'msix', 'msp', 'com', 'scr', 'vbs', 'vbe', 'wsf', 'wsh', 'hta', 'cpl', 'pif', 'reg',
]);


/**
 * Mimetypes that are never safe to accept, regardless of extension. These render as active
 * content in a browser (svg can carry <script>), so they are rejected even when the filename
 * looks harmless. Kept alongside DANGEROUS_EXTENSIONS so upload paths check both.
 */
export const DANGEROUS_MIME_TYPES = new Set([
    'image/svg+xml', 'text/html', 'application/xhtml+xml',
]);

/**
 * Percent-decodes a filename, repeating a bounded number of times so a double-encoded payload
 * (`%252e` -> `%2e` -> `.`) survives a single pass through a proxy/framework that already
 * decoded once. Malformed escape sequences are left as-is rather than thrown, since this runs
 * on attacker-controlled input and a literal `%` in a filename (`100%done.pdf`) is legal.
 */
function decodePercentEncodingSafely(name: string): string {
    let decoded = name;
    for (let i = 0; i < 3; i++) {
        let next: string;
        try {
            next = decodeURIComponent(decoded);
        } catch {
            return decoded;
        }
        if (next === decoded) {
            return decoded;
        }
        decoded = next;
    }
    return decoded;
}

/**
 * Reduces a client-supplied name to the name that will actually be resolved on disk, so
 * extension checks can't be dodged by decorating it. Each step defends a known bypass:
 *
 *  - `evil.exe%2e`         -> percent-encoding a trailing dot (or anything else) hides the real
 *                             extension from naive string matching; decode before inspecting it.
 *  - `../../evil.exe`      -> only the final path segment is the file name.
 *  - `evil.exe\0.png`      -> a NUL truncates the name at the syscall/filesystem layer, so
 *                             anything after it is invisible to the OS but visible to naive
 *                             validation.
 *  - `evil.exe::$DATA`     -> NTFS alternate data stream suffix; the file on disk is evil.exe.
 *  - `evil.exe.` / `.exe ` -> Windows silently strips trailing dots and spaces when resolving
 *                             a path, so these land on disk as evil.exe.
 */
export function normalizeUploadedFileName(fileName?: string | null): string {
    if (!fileName) {
        return '';
    }

    let name = decodePercentEncodingSafely(String(fileName));
    name = name.split(/[/\\]/).pop() ?? '';

    const nulIndex = name.indexOf('\0');
    if (nulIndex >= 0) {
        name = name.slice(0, nulIndex);
    }

    const streamIndex = name.indexOf(':');
    if (streamIndex >= 0) {
        name = name.slice(0, streamIndex);
    }

    return name.replace(/[\s.]+$/, '');
}

/**
 * The effective extension - what the OS/browser will treat the file as. Used for media
 * category resolution and inline-safety decisions. Always normalizes first, so
 * `evil.exe.` resolves to `exe` rather than to nothing.
 */
export function getLowercaseFileExtension(fileName?: string | null): string | undefined {
    const name = normalizeUploadedFileName(fileName);

    const lastDotIndex = name.lastIndexOf('.');
    if (lastDotIndex < 0 || lastDotIndex === name.length - 1) {
        return undefined;
    }

    return name.slice(lastDotIndex + 1).toLowerCase();
}

/**
 * Every dot-delimited segment after the stem, lowercased. The danger check uses this rather
 * than only the effective extension so a dangerous type buried in a double extension
 * (`evil.exe.png`, `shell.php.jpg`) is still caught - several servers and browsers resolve
 * such names by an earlier segment than the last one.
 *
 * The stem is skipped so an innocuous file that merely starts with a keyword (`exe.png`)
 * isn't rejected.
 */
export function getLowercaseFileExtensionSegments(fileName?: string | null): string[] {
    const segments = normalizeUploadedFileName(fileName).toLowerCase().split('.');
    return segments.slice(1).filter(segment => segment.length > 0);
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
 * Extensions are checked before mimetype so a spoofed Content-Type (e.g.
 * application/octet-stream, or image/png, on an .html file) can't bypass it.
 */
export function isDangerousMediaFile(file?: UploadedFileLike | null): boolean {
    const segments = getLowercaseFileExtensionSegments(getUploadedFileName(file));
    if (segments.some(segment => DANGEROUS_EXTENSIONS.has(segment))) {
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
    ...Object.fromEntries(MEDIA_FILE_TYPES.map((fileType) => [fileType.extension, fileType.mediaType])),
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
