import { NS } from '@ns'

export function assert_eq<T>(ns: NS, expected: T, actual: T, context?: string): void {
  if (expected !== actual) {
    const msg = `Assertion failed${context ? ` (${context})` : ''}: expected ${expected}, but got ${actual}`;
    ns.tprint(`ERROR ${msg}`);
    throw new Error(msg);
  }
}

export function assert_set_eq<T>(ns: NS, expected: Set<T>, actual: Set<T>, context?: string): void {
  for (const e of expected) {
    if (!actual.has(e)) {
      const msg = `Assertion failed${context ? ` (${context})` : ''}: expected set to contain ${e}, but it did not. Expected: ${JSON.stringify([...expected])}, Actual: ${JSON.stringify([...actual])}`;
      ns.tprint(`ERROR ${msg}`);
      throw new Error(msg);
    }
  }
  for (const a of actual) {
    if (!expected.has(a)) {
      const msg = `Assertion failed${context ? ` (${context})` : ''}: expected set to not contain ${a}, but it did. Expected: ${JSON.stringify([...expected])}, Actual: ${JSON.stringify([...actual])}`;
      ns.tprint(`ERROR ${msg}`);
      throw new Error(msg);
    }
  }
}

export function assert_arr_eq<T>(ns: NS, expected: T[], actual: T[], context?: string): void {
  const test_arr = (expected: unknown[], actual: unknown[]): boolean =>
    expected.length === actual.length && expected.every((v, i) => v === actual[i] || (Array.isArray(v) && Array.isArray(actual[i]) && test_arr(v, actual[i])));
  for (let i = 0; i < Math.min(expected.length, actual.length); i++) {
    if (expected[i] !== actual[i] && Array.isArray(expected[i]) && Array.isArray(actual[i]) && !test_arr(expected[i] as unknown[], actual[i] as unknown[])) {
      const msg = `Assertion failed${context ? ` (${context})` : ''}: expected ${JSON.stringify(expected[i])} at index ${i}, but got ${JSON.stringify(actual[i])}`;
      ns.tprint(`ERROR ${msg}`);
      throw new Error(msg);
    }
  }
  if (expected.length !== actual.length) {
    const msg = `Assertion failed${context ? ` (${context})` : ''}: expected array length ${expected.length}, but got ${actual.length}`;
    ns.tprint(`ERROR ${msg}`);
    throw new Error(msg);
  }
}

export function assert_all_passed(ns: NS) {
  ns.tprint('SUCCESS All tests passed');
}
