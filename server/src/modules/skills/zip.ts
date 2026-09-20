import zlib from 'node:zlib';

/**
 * A minimal, PURE ZIP reader built on `node:zlib` — no I/O, no db, no
 * dependency (spec D1).
 *
 * ## The invariant this file exists to enforce
 *
 * Reading an archive's *listing* and reading an entry's *contents* are two
 * separate calls, and only the second one decompresses anything:
 *
 *   - `readCentralDirectory(buf)` returns metadata ONLY. A `ZipEntry` carries
 *     no bytes and holds no reference to the archive, so there is no way to
 *     get at an entry's contents from the listing alone.
 *   - `inflateEntry(buf, entry)` is the ONLY function in this module that
 *     calls into zlib, and it decompresses exactly the one entry it is handed.
 *
 * There is deliberately no `inflateAll`, no `readEntries(): {path, text}[]`
 * and no lazy `entry.text` getter. The caller (`import-parse.ts`) therefore
 * cannot decompress an entry by accident: it has to name one. It names the
 * chosen core entry, once, and nothing else — which is what makes "executable
 * parts of the archive are never processed" a property of the code rather than
 * a promise in the UI.
 */

/** ZIP structure signatures (little-endian, PKWARE APPNOTE 4.3). */
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;

const EOCD_MIN_SIZE = 22;
const CENTRAL_HEADER_SIZE = 46;
const LOCAL_HEADER_SIZE = 30;
/** The EOCD comment length field is 16-bit, so the record starts at most this far from the end. */
const EOCD_MAX_SCAN = EOCD_MIN_SIZE + 0xffff;

const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

/** A malformed or unsupported archive. Mapped to an `AppError` by the caller. */
export class ZipFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipFormatError';
  }
}

/**
 * One central-directory record. Metadata only — deliberately no bytes: see the
 * module comment. `bytes` is the *declared* uncompressed size, which is what
 * the zip-bomb guard reads before anything is decompressed.
 */
export interface ZipEntry {
  path: string;
  bytes: number;
  compressedBytes: number;
  method: number;
  localHeaderOffset: number;
  /** Unix permission bits from the high half of `external attributes`; 0 when absent. */
  unixMode: number;
}

/** Scan backwards for the end-of-central-directory record (its comment is variable-length). */
function findEocd(buf: Buffer): number {
  const start = Math.max(0, buf.length - EOCD_MAX_SCAN);
  for (let i = buf.length - EOCD_MIN_SIZE; i >= start; i -= 1) {
    if (buf.readUInt32LE(i) !== EOCD_SIGNATURE) continue;
    // Guard against the signature appearing inside a comment or payload: the
    // declared comment length must reach exactly the end of the buffer.
    if (i + EOCD_MIN_SIZE + buf.readUInt16LE(i + 20) === buf.length) return i;
  }
  return -1;
}

/**
 * Walk the central directory and return every entry's metadata.
 *
 * Throws `ZipFormatError` when there is no EOCD record — which is also how a
 * `.tar.gz`, a renamed binary or plain garbage is rejected.
 */
export function readCentralDirectory(buf: Buffer): ZipEntry[] {
  if (buf.length < EOCD_MIN_SIZE) {
    throw new ZipFormatError('Not a ZIP archive: too short to hold a central directory.');
  }

  const eocd = findEocd(buf);
  if (eocd < 0) {
    throw new ZipFormatError('Not a ZIP archive: no end-of-central-directory record.');
  }

  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i += 1) {
    if (offset + CENTRAL_HEADER_SIZE > buf.length) {
      throw new ZipFormatError('Corrupt ZIP: central directory runs past the end of the archive.');
    }
    if (buf.readUInt32LE(offset) !== CENTRAL_HEADER_SIGNATURE) {
      throw new ZipFormatError(`Corrupt ZIP: bad central-directory header at offset ${offset}.`);
    }

    const nameLength = buf.readUInt16LE(offset + 28);
    const extraLength = buf.readUInt16LE(offset + 30);
    const commentLength = buf.readUInt16LE(offset + 32);
    const nameStart = offset + CENTRAL_HEADER_SIZE;
    if (nameStart + nameLength > buf.length) {
      throw new ZipFormatError('Corrupt ZIP: entry name runs past the end of the archive.');
    }

    entries.push({
      path: buf.toString('utf8', nameStart, nameStart + nameLength),
      bytes: buf.readUInt32LE(offset + 24),
      compressedBytes: buf.readUInt32LE(offset + 20),
      method: buf.readUInt16LE(offset + 10),
      localHeaderOffset: buf.readUInt32LE(offset + 42),
      // External attributes: unix mode lives in the high 16 bits.
      unixMode: (buf.readUInt32LE(offset + 38) >>> 16) & 0xffff,
    });

    offset = nameStart + nameLength + extraLength + commentLength;
  }

  return entries;
}

/**
 * Decompress ONE entry and return it as UTF-8 text.
 *
 * This is the only function in the module that touches zlib. Call it for the
 * chosen core entry and for nothing else.
 *
 * The local file header at `entry.localHeaderOffset` repeats the name but has
 * its OWN name/extra lengths — writers routinely put an extended-timestamp
 * field in the local header and not in the central record, so the data offset
 * must be computed from the local header's fields, never from the central
 * one's. Sizes, by contrast, are read from the central directory: a local
 * header may legally declare 0/0 and defer to a trailing data descriptor.
 */
export function inflateEntry(buf: Buffer, entry: ZipEntry): string {
  const offset = entry.localHeaderOffset;
  if (offset + LOCAL_HEADER_SIZE > buf.length || buf.readUInt32LE(offset) !== LOCAL_HEADER_SIGNATURE) {
    throw new ZipFormatError(`Corrupt ZIP: no local file header for "${entry.path}".`);
  }

  const nameLength = buf.readUInt16LE(offset + 26);
  const extraLength = buf.readUInt16LE(offset + 28);
  const dataStart = offset + LOCAL_HEADER_SIZE + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedBytes;
  if (dataEnd > buf.length) {
    throw new ZipFormatError(`Corrupt ZIP: "${entry.path}" runs past the end of the archive.`);
  }

  const payload = buf.subarray(dataStart, dataEnd);

  if (entry.method === METHOD_STORED) return payload.toString('utf8');
  if (entry.method === METHOD_DEFLATE) {
    try {
      return zlib.inflateRawSync(payload).toString('utf8');
    } catch {
      throw new ZipFormatError(`Corrupt ZIP: "${entry.path}" is not a valid deflate stream.`);
    }
  }

  throw new ZipFormatError(
    `Unsupported ZIP compression method ${entry.method} for "${entry.path}"; only stored (0) and deflate (8) are read.`,
  );
}
