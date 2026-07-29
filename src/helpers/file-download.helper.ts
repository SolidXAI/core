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
 * Single place that stamps the response headers for every streamed file download, so the
 * security headers can't be applied to one endpoint and forgotten on the next.
 */
export function setFileDownloadHeaders(res: Response, options: FileDownloadHeaderOptions): void {
  const disposition = options.disposition ?? "attachment";

  res.setHeader("Content-Disposition", `${disposition}; filename="${options.fileName}"`);
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
