import { NS } from '@ns'
import { format_data } from '/lib/colors';

export interface BinarySearchOptions {
  start?: number;
  unbounded?: boolean;
}

/**
 * Simple binary search implementation
 *
 * Supports unbounded upper (but not lower) limit: if configured, hi will be repeatedly doubled until an upper bound is
 * found, or Number.MAX_SAFE_INTEGER is reached
 * Supports implicit search: Uses a callback, rather than an array, to determine the value at a given index
 *
 * @param poll  Callback function that returns the value at a given index
 * @param goal  The value to search for
 * @param lo    The lower bound of the search
 * @param hi    Optional. The upper bound of the search
 * @param start Optional. The starting index of the search
 *
 * @returns The index of the goal value, or -(insertion point + 1) if an exact match is not found
 */
export function binary_search(poll: (param: number) => number, goal: number, lo: number, hi: number, {
  start = lo + Math.floor(hi-lo/2),
  unbounded = false,
}: BinarySearchOptions = {}): number {
  while (unbounded) {
    const value = poll(hi);
    if (value > goal) {
      unbounded = false;
      if (start > hi || start < lo) {
        start = lo + Math.floor((hi-lo)/2);
      }
      break;
    }
    if (hi === Number.MAX_SAFE_INTEGER) {
      return Number.MIN_SAFE_INTEGER;
    }
    lo = hi;
    hi = Math.min((hi === 0 ? 1 : hi * 2), Number.MAX_SAFE_INTEGER);
  }
  let mid: number = start;
  while (lo < hi) {
    const value = poll(mid);
    if (value < goal) {
      lo = mid + 1;
    } else if (value > goal) {
      hi = mid;
    } else {
      return mid;
    }
    mid = lo + Math.floor((hi - lo) / 2);
  }
  return -(lo + 1);
}

export function array_poller(arr: number[]): (param: number) => number {
  return (param: number) => arr[param];
}

export async function main(ns: NS): Promise<void> {
  const test_cases: { input: [((param: number) => number), number, number, number, BinarySearchOptions?], expected: number }[] = [
    { input: [array_poller([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 5, 0, 9], expected: 4, },
    { input: [array_poller([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 0, 0, 9], expected: -1, },
    { input: [array_poller([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 11, 0, 9], expected: -11, },
    { input: [array_poller([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 5, 0, 9, { start: 5 }], expected: 4, },
    { input: [array_poller([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 5, 0, 9, { start: 4 }], expected: 4, },
    { input: [array_poller([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 5, 0, 9, { start: 6 }], expected: 4, },
    { input: [array_poller([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 5, 0, 9, { start: 3 }], expected: 4, },
    { input: [array_poller([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 5, 0, 9, { start: 2 }], expected: 4, },
    { input: [array_poller([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 5, 0, 9, { start: 1 }], expected: 4, },
    { input: [d => d + 4, 13, 0, 0, { unbounded: true }], expected: 9, },
  ];

  let err = false;

  for (const {input, expected} of test_cases) {
    const actual = binary_search(...input);
    if (expected !== actual) {
      ns.tprint('ERROR - ', input, ' expected: ', format_data(expected), '; actual: ', format_data(actual));
      err = true;
    }
  }
  if (!err) {
    ns.tprint('SUCCESS');
  }
}
