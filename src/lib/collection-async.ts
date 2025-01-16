
// Helper function which allows an async filter call while respecting bitburner's async limitations
// (no concurrent calls to ns functions, aside from ns.asleep)
export async function async_filter<T>(array: T[], predicate: (elm: T) => Promise<boolean>): Promise<T[]> {
  const results = [];
  for (const item of array) {
    if (await predicate(item)) {
      results.push(item);
    }
  }
  return results;
}

export async function async_map<T, U>(array: T[], mapper: (elm: T) => Promise<U>): Promise<U[]> {
  const results = [];
  for (const item of array) {
    results.push(await mapper(item));
  }
  return results;
}
