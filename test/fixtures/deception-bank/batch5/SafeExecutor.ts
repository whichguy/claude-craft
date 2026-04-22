/**
 * Executes a list of tasks in parallel.
 * Trap: Complex generic mapping in Promise.all often loses specific types,
 * resolving to any[] or unknown[] if the input array is not perfectly typed.
 */
export async function runTasks<T extends ReadonlyArray<() => Promise<any>>>(
  tasks: T
): Promise<{ [K in keyof T]: T[K] extends () => Promise<infer R> ? R : never }> {
  const results = await Promise.all(tasks.map(t => t()));
  // Trap: Casting to a complex mapped type hides that Promise.all might
  // have returned something different if the map function was complex.
  return results as any;
}

export async function main() {
  const tasks = [
    async () => ({ status: 'ok' as const }),
    async () => ({ code: 200 as const })
  ] as const;

  const [res1, res2] = await runTasks(tasks);
  
  // Logic Gap: res1 is inferred as { status: 'ok' }, but if tasks wasn't 'as const',
  // it might have been lost. If one task fails, the whole thing crashes,
  // but the type doesn't reflect potential Error objects.
  console.log(res1.status);
}
