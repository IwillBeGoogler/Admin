/**
 * Runs `fn` over `items` with at most `limit` calls in flight and never
 * rejects: every item ends up in `ok` or `failed` (Promise.allSettled semantics).
 */
export async function runBulk<T>(
  items: readonly T[],
  fn: (item: T) => Promise<unknown>,
  limit = 4,
): Promise<{ ok: T[]; failed: T[] }> {
  const results: PromiseSettledResult<unknown>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await Promise.allSettled([fn(items[i] as T)]).then((r) => r[0] as PromiseSettledResult<unknown>);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  const ok: T[] = [];
  const failed: T[] = [];
  items.forEach((item, i) => {
    (results[i]?.status === "fulfilled" ? ok : failed).push(item);
  });
  return { ok, failed };
}
