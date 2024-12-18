import { NS } from '@ns'

export function assert_eq<T>(ns: NS, expected: T, actual: T, context?: string): void {
  if (expected !== actual) {
    const msg = `Assertion failed${context ? ` (${context})` : ''}: expected ${expected}, but got ${actual}`;
    ns.tprint(`ERROR ${msg}`);
    throw new Error(msg);
  }
}

export function assert_all_passed(ns: NS) {
  ns.tprint('SUCCESS All tests passed');
}
