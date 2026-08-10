import type { Response } from "express";

export interface FileDownloadHeaderOptions {
  fileName: string;
  mimeType: string;
  /** Defaults to 'attachment'; only pass 'inline' for types known safe to render. */
  disposition?: "inline" | "attachment";
  /** Opt in for assets loaded cross-origin by the UI (e.g. media served to :3000). */
  crossOriginResourcePolicy?: boolean;
}

/**
 * Builds an RFC 6266 Content-Disposition value. The file name is attacker-controlled (it comes
 * from the uploaded originalFileName), so it can't be interpolated raw: a quote would close the
 * quoted-string early and let the rest of the name forge further header parameters. The ASCII
 * fallback is stripped to a safe subset and the real name is carried in the RFC 5987
 * `filename*` parameter, which is also what preserves non-ASCII names correctly.
 */
function buildContentDisposition(disposition: "inline" | "attachment", fileName: string): string {
  const name = (fileName || "file").replace(/[\r\n]/g, "");
  const asciiFallback = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "file";

  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * Single place that stamps the response headers for every streamed file download, so the
 * security headers can't be applied to one endpoint and forgotten on the next.
 */
export function setFileDownloadHeaders(res: Response, options: FileDownloadHeaderOptions): void {
  const disposition = options.disposition ?? "attachment";

  res.setHeader("Content-Disposition", buildContentDisposition(disposition, options.fileName));
  res.setHeader("Content-Type", options.mimeType);
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Type");

  // Prevent the browser from ever content-sniffing a served file into something more
  // dangerous than its declared Content-Type (e.g. rendering a mislabeled upload as HTML
  // and executing embedded script).
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (options.crossOriginResourcePolicy) {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  }
}
