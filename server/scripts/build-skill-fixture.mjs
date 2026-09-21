#!/usr/bin/env node
/**
 * Build `fixtures/skills/flake-patterns.zip` from the folder beside it.
 *
 * The archive is committed so the import demo works from a fresh clone, but the
 * SOURCE is committed too — a binary in git that nobody can diff is a binary
 * nobody reviews. Re-run this after editing any file in the folder:
 *
 *   node scripts/build-skill-fixture.mjs
 *
 * Deliberately dependency-free (node:zlib only), for the same reason the
 * importer that reads it is: see specs/L02-skills-in-the-product.md D1.
 *
 * `install.sh` is written with a unix executable mode bit on purpose — the
 * importer classifies it as `executable` and must never decompress it.
 */
import { deflateRawSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'fixtures', 'skills', 'flake-patterns');
const outFile = join(here, '..', 'fixtures', 'skills', 'flake-patterns.zip');

/** [name, unix mode] — mode 0o755 sets the executable bit the importer reads. */
const FILES = [
  ['SKILL.md', 0o644],
  ['README.md', 0o644],
  ['install.sh', 0o755],
];

// CRC-32, table-driven. The zip format requires it per entry; no built-in.
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

const localParts = [];
const centralParts = [];
let offset = 0;

for (const [name, mode] of FILES) {
  const raw = readFileSync(join(srcDir, name));
  const deflated = deflateRawSync(raw);
  // Store the entry only if deflating actually helped — the reader supports
  // both methods, and this exercises method 0 when a file is incompressible.
  const useDeflate = deflated.length < raw.length;
  const data = useDeflate ? deflated : raw;
  const method = useDeflate ? 8 : 0;
  const crc = crc32(raw);
  const nameBuf = Buffer.from(name, 'utf8');

  const local = Buffer.alloc(30 + nameBuf.length);
  local.writeUInt32LE(0x04034b50, 0); // local file header signature
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0, 6); // flags
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(0, 10); // mod time
  local.writeUInt16LE(0x2821, 12); // mod date (2000-01-01, deterministic)
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28); // extra length
  nameBuf.copy(local, 30);

  localParts.push(local, data);

  const central = Buffer.alloc(46 + nameBuf.length);
  central.writeUInt32LE(0x02014b50, 0); // central directory header signature
  central.writeUInt16LE(0x031e, 4); // version made by: unix, so mode is read
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0x2821, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt16LE(0, 30); // extra
  central.writeUInt16LE(0, 32); // comment
  central.writeUInt16LE(0, 34); // disk number
  central.writeUInt16LE(0, 36); // internal attrs
  central.writeUInt32LE(((0o100000 | mode) << 16) >>> 0, 38); // external attrs
  central.writeUInt32LE(offset, 42);
  nameBuf.copy(central, 46);

  centralParts.push(central);
  offset += local.length + data.length;
}

const centralDir = Buffer.concat(centralParts);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0); // end of central directory signature
eocd.writeUInt16LE(0, 4); // this disk
eocd.writeUInt16LE(0, 6); // disk with central dir
eocd.writeUInt16LE(FILES.length, 8);
eocd.writeUInt16LE(FILES.length, 10);
eocd.writeUInt32LE(centralDir.length, 12);
eocd.writeUInt32LE(offset, 16);
eocd.writeUInt16LE(0, 20); // comment length

const zip = Buffer.concat([...localParts, centralDir, eocd]);
writeFileSync(outFile, zip);
console.log(`wrote ${outFile} — ${FILES.length} entries, ${zip.length} bytes`);
