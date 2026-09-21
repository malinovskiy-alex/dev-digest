import zlib from 'node:zlib';
import { Buffer } from 'node:buffer';

/**
 * A tiny, test-only ZIP *writer*, the mirror of `src/modules/skills/zip.ts`.
 *
 * It exists so the import tests build their archives in memory: no binary
 * fixtures in git, and — more usefully — the ability to write archives no real
 * zip tool would produce, which is exactly what the guards must survive. It
 * can lie about an entry's uncompressed size (the zip-bomb guard), emit a
 * `../escape.md` path (zip slip), attach a local-header extra field the
 * central record does not have (the classic data-offset bug), carry an EOCD
 * comment (the backwards scan), and store a payload that is not a valid
 * deflate stream (so that inflating it at all would throw).
 */

export interface ZipFileSpec {
  path: string;
  content?: string;
  /** 0 = stored, 8 = deflate. Default 8. */
  method?: 0 | 8;
  /** Overrides the *declared* uncompressed size in the central directory. */
  declaredSize?: number;
  /** Unix permission bits written into `external attributes` (e.g. 0o755). */
  unixMode?: number;
  /** Bytes of extra field on the LOCAL header only — the central record keeps none. */
  localExtraBytes?: number;
  /** Replace the payload with bytes that are not a valid deflate stream. */
  corruptPayload?: boolean;
}

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;

interface Placed {
  spec: ZipFileSpec;
  name: Buffer;
  payload: Buffer;
  method: number;
  declaredSize: number;
  localHeaderOffset: number;
}

/** Build a ZIP archive in memory. */
export function makeZip(files: ZipFileSpec[], comment = ''): Buffer {
  const chunks: Buffer[] = [];
  const placed: Placed[] = [];
  let offset = 0;

  for (const spec of files) {
    const name = Buffer.from(spec.path, 'utf8');
    const raw = Buffer.from(spec.content ?? '', 'utf8');
    const method = spec.method ?? 8;

    let payload: Buffer;
    if (spec.corruptPayload) {
      // 0xff opens a block with the reserved BTYPE 3 — inflateRawSync always throws.
      payload = Buffer.alloc(16, 0xff);
    } else if (method === 0) {
      payload = raw;
    } else {
      payload = zlib.deflateRawSync(raw);
    }

    const extra = Buffer.alloc(spec.localExtraBytes ?? 0);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_HEADER_SIGNATURE, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(0, 14); // crc32 — never verified by the reader
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(extra.length, 28);

    placed.push({
      spec,
      name,
      payload,
      method,
      declaredSize: spec.declaredSize ?? raw.length,
      localHeaderOffset: offset,
    });

    for (const chunk of [local, name, extra, payload]) {
      chunks.push(chunk);
      offset += chunk.length;
    }
  }

  const centralOffset = offset;
  for (const entry of placed) {
    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_HEADER_SIGNATURE, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(entry.method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(0, 16); // crc32
    central.writeUInt32LE(entry.payload.length, 20);
    central.writeUInt32LE(entry.declaredSize, 24);
    central.writeUInt16LE(entry.name.length, 28);
    central.writeUInt16LE(0, 30); // extra length — deliberately NOT the local one
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attributes
    central.writeUInt32LE(((entry.spec.unixMode ?? 0) << 16) >>> 0, 38);
    central.writeUInt32LE(entry.localHeaderOffset, 42);

    for (const chunk of [central, entry.name]) {
      chunks.push(chunk);
      offset += chunk.length;
    }
  }

  const commentBytes = Buffer.from(comment, 'utf8');
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIGNATURE, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // central directory start disk
  eocd.writeUInt16LE(placed.length, 8);
  eocd.writeUInt16LE(placed.length, 10);
  eocd.writeUInt32LE(offset - centralOffset, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(commentBytes.length, 20);
  chunks.push(eocd, commentBytes);

  return Buffer.concat(chunks);
}

/** The same archive, base64-encoded — the shape the import route receives. */
export function makeZipBase64(files: ZipFileSpec[], comment = ''): string {
  return makeZip(files, comment).toString('base64');
}

/** Bytes that are emphatically not a ZIP: no end-of-central-directory record. */
export function makeNonZip(): Buffer {
  return Buffer.from('\x1f\x8b\x08\x00 this is a gzip stream, not a zip archive', 'binary');
}
