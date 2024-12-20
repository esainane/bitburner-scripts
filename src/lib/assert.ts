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

export function assert_all_passed(ns: NS) {
  ns.tprint('SUCCESS All tests passed');
}
