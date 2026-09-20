import type { SkillImportPreview } from "@devdigest/shared";
import { ApiError } from "@/lib/api";
import type { ImportUpload } from "@/lib/hooks/skills";
import { BASE64_CHUNK, IMPORT_ERROR_CODES, type ImportErrorCode } from "./constants";

/** pick -> preview -> confirm. Derived from what the drawer already holds; the
    step is never stored, so it cannot disagree with the data. */
export type ImportStep = "pick" | "preview" | "confirm";

export function importStep(preview: SkillImportPreview | null, confirming: boolean): ImportStep {
  if (!preview) return "pick";
  return confirming ? "confirm" : "preview";
}

/** A `.zip` goes up as base64; everything else is read as text. */
export function isArchiveFile(filename: string): boolean {
  return /\.zip$/i.test(filename);
}

/** Bytes -> base64, in chunks so a 2 MB archive does not blow the spread limit. */
export function bytesToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
  }
  return btoa(binary);
}

/**
 * Read a picked file into the shape the API takes. There is no multipart
 * endpoint and none is needed: `readAsText` for markdown, `readAsArrayBuffer`
 * then base64 for an archive.
 */
export function readUpload(file: File): Promise<ImportUpload> {
  const archive = isArchiveFile(file.name);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      if (archive) {
        resolve({
          kind: "archive",
          filename: file.name,
          base64: bytesToBase64(reader.result as ArrayBuffer),
        });
      } else {
        resolve({ kind: "markdown", filename: file.name, text: String(reader.result) });
      }
    };
    if (archive) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  });
}

/** The API error code behind a failure, when it is one this flow has copy for. */
export function importErrorCode(error: unknown): ImportErrorCode | null {
  if (!(error instanceof ApiError) || !error.code) return null;
  const known: readonly string[] = IMPORT_ERROR_CODES;
  return known.includes(error.code) ? (error.code as ImportErrorCode) : null;
}

/** Human-readable file size for the picker line and the entry table. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
