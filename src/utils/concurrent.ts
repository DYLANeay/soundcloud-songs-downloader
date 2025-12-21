/**
 * Run async tasks with limited concurrency
 *
 * Instead of:
 *   await Promise.all(items.map(fn))  // All at once - too aggressive
 *
 * Or:
 *   for (item of items) await fn(item)  // One at a time - too slow
 *
 * We do:
 *   await runConcurrent(items, fn, 3)  // 3 at a time - balanced
 */

export async function runConcurrent<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let currentIndex = 0;

  // Worker function - keeps grabbing next item until none left
  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];
      if (item !== undefined) {
        results[index] = await fn(item, index);
      }
    }
  }

  // Start N workers in parallel
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
