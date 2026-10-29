import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageGenerationQueue } from '../src/lib/images/imageGenerationQueue.ts';

test('a throwing queued-stage observer cannot strand the image job before it starts', async () => {
  const queue = createImageGenerationQueue();
  const seen = [];
  const result = await queue.run('user', 'image-1', async ticket => {
    ticket.generating();
    return 'provider accepted';
  }, stage => { seen.push(stage); throw new Error('UI progress component unavailable'); });

  assert.equal(result, 'provider accepted');
  assert.deepEqual(seen, ['queued'], 'a failed observer is detached instead of running again');
  assert.equal(await queue.run('user', 'image-2', async () => 'next image'), 'next image');
});

test('a failing duplicate observer cannot break the other listeners or the shared job', async () => {
  const queue = createImageGenerationQueue();
  const events = [];
  const original = queue.run('user', 'image-1', async ticket => {
    ticket.generating();
    return 42;
  }, stage => events.push('healthy:' + stage));
  const duplicate = queue.run('user', 'image-1', async () => {
    throw new Error('Duplicated paid provider call');
  }, () => { throw new Error('Detached progress listener'); });

  assert.equal(await original, 42);
  assert.equal(await duplicate, 42);
  assert.deepEqual(events, ['healthy:queued', 'healthy:generating']);
});
