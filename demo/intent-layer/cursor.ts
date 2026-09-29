/** Demo only — exercises the Intent Layer. Not wired into the app. */
import { z } from "zod";

const Cursor = z.object({ id: z.string(), createdAt: z.string().datetime() });
export type Cursor = z.infer<typeof Cursor>;

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    return Cursor.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}

export function clampLimit(limit: number | undefined): number {
  return Math.min(100, Math.max(1, limit ?? 25));
}
