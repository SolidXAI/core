export type MediaCategory = 'image' | 'audio' | 'video' | 'file' | 'pdf';

export const MEDIA_CATEGORIES = ['image', 'audio', 'video', 'file', 'pdf'] as const;

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'heic', 'heif'];
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'webm'];
export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'mpeg', 'mpg', '3gp', '3g2', 'webm', 'ogg'];
export const DOCUMENT_EXTENSIONS = ['txt', 'md', 'csv', 'json', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', '7z'];
export const PDF_EXTENSION = 'pdf';

export const MEDIA_TYPE_TO_EXTENSIONS: Record<MediaCategory, string[]> = {
    image: IMAGE_EXTENSIONS,
    audio: AUDIO_EXTENSIONS,
    video: VIDEO_EXTENSIONS,
    file: DOCUMENT_EXTENSIONS,
    pdf: [PDF_EXTENSION],
};

export const EXTENSION_TO_MIME_TYPE: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
    tiff: "image/tiff",
    heic: "image/heic",
    heif: "image/heif",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    aac: "audio/aac",
    m4a: "audio/mp4",
    flac: "audio/flac",
    webm: "video/webm",
    mp4: "video/mp4",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    mpeg: "video/mpeg",
    mpg: "video/mpeg",
    "3gp": "video/3gpp",
    "3g2": "video/3gpp2",
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    json: "application/json",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    "7z": "application/x-7z-compressed",
};

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
