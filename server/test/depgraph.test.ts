/**
 * DepCruiseGraph against a real (temp) directory: edges come back as
 * repo-relative POSIX paths on every platform, so they match `symbols.path`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DepCruiseGraph } from '../src/adapters/depgraph/index.js';

const root = mkdtempSync(join(tmpdir(), 'depgraph-'));

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('DepCruiseGraph.buildEdges', () => {
  it('returns POSIX repo-relative edges for nested files', async () => {
    mkdirSync(join(root, 'src', 'lib'), { recursive: true });
    writeFileSync(join(root, 'src', 'lib', 'util.ts'), 'export const util = 1;\n');
    writeFileSync(
      join(root, 'src', 'main.ts'),
      "import { util } from './lib/util';\nexport const main = util;\n",
    );

    const edges = await new DepCruiseGraph().buildEdges(root, ['src/main.ts', 'src/lib/util.ts']);

    expect(edges).toEqual([{ from: 'src/main.ts', to: 'src/lib/util.ts' }]);
  });
});
