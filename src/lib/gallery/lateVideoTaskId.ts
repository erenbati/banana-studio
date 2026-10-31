export interface WaitingVideo { id: string; mediaType: string; status?: string; taskId?: string | null }

/** Only looks up an already-submitted task; this function never dispatches paid work. */
export async function findLateVideoTaskId<T extends WaitingVideo>(
  id: string, checking: Set<string>, current: () => T | undefined,
  read: () => Promise<T | null>,
): Promise<T | null> {
  if (checking.has(id)) return null;
  const before = current();
  if (!before || before.id !== id || before.mediaType !== 'video'
      || before.status !== 'processing' || before.taskId) return null;
  checking.add(id);
  try {
    const saved = await read();
    const live = current();
    if (!live || live.id !== id || live.status !== 'processing' || live.taskId
        || !saved || saved.id !== id || saved.status !== 'processing' || !saved.taskId) return null;
    return saved;
  } finally {
    checking.delete(id);
  }
}
