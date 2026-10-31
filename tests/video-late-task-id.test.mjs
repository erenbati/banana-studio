import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const output = await build({
  entryPoints: ['src/lib/gallery/lateVideoTaskId.ts'],
  absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
  bundle: true, write: false, format: 'esm', platform: 'node',
});
const { findLateVideoTaskId } = await import(
  'data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64')
);

const pending = () => ({ id: 'video-1', mediaType: 'video', status: 'processing', taskId: undefined });

test('a provider task ID saved after page reload becomes discoverable without submitting again', async () => {
  let live = pending();
  let saved = pending();
  let reads = 0;
  const lookup = () => findLateVideoTaskId(live.id, new Set(), () => live, async () => { reads++; return saved; });
  assert.equal(await lookup(), null);
  saved = { ...saved, taskId: 'bs_fal_existing' };
  assert.equal((await lookup())?.taskId, 'bs_fal_existing');
  assert.equal(reads, 2);
});

test('concurrent checks do not read the same saved video twice', async () => {
  const live = pending();
  const checking = new Set();
  let finish;
  const reading = () => new Promise(resolve => { finish = resolve; });
  const first = findLateVideoTaskId(live.id, checking, () => live, reading);
  let duplicateReads = 0;
  const duplicate = await findLateVideoTaskId(live.id, checking, () => live, async () => { duplicateReads++; return null; });
  assert.equal(duplicate, null);
  assert.equal(duplicateReads, 0);
  finish({ ...live, taskId: 'saved-task' });
  assert.equal((await first)?.taskId, 'saved-task');
  assert.equal(checking.size, 0);
});

test('a row that disappeared or finished while reading cannot restart polling', async () => {
  let live = pending();
  const lookup = findLateVideoTaskId(live.id, new Set(), () => live, async () => {
    live = { ...live, status: 'failed' };
    return { ...pending(), taskId: 'old-task' };
  });
  assert.equal(await lookup, null);
  assert.equal(await findLateVideoTaskId(live.id, new Set(), () => live, async () => ({ ...pending(), taskId: 'old-task' })), null);
});
