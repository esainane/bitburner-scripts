import { NS } from '@ns'
import { autocomplete_func, ccts_main, CCTSolver } from './interface';
import { assert_eq, assert_all_passed } from '/lib/assert';

export const autocomplete = autocomplete_func;

export const contracts = new Map<string, CCTSolver>([
  ["Find Largest Prime Factor", { solve: largest_prime, test: test_largest_prime }],
]);

export const main = ccts_main(contracts);

/**
 * Find Largest Prime Factor
 *
 * A prime factor is a factor that is a prime number. What is the largest prime factor of <data>?
 * @param data You are given an array with two elements.
 *             The first element is the plaintext, the second element is the left shift value.
 */
function largest_prime(data: unknown) {
  if (typeof(data) !== 'number') {
    throw new Error('Expected number, received ' + JSON.stringify(data));
  }
  const to_factorize = data as number;
  let current = to_factorize;

  let largest_prime = 1;

  // Special case: 2
  while (current % 2 === 0) {
    largest_prime = 2;
    current /= 2;
  }

  // Naive implementation; a proper sieve could skip more numbers
  let limit = Math.sqrt(to_factorize);
  for (let i = 3; i <= limit; i += 2) {
    while (current % i === 0) {
      largest_prime = i;
      current /= i;
      limit = Math.sqrt(current);
    }
  }

  // Check remaining factor
  if (current > largest_prime) {
    largest_prime = current;
  }

  return largest_prime;
}

function test_largest_prime(ns: NS) {
  // Test cases for largest_prime
  const testCases = [
    { input: 2, expected: 2 },
    { input: 3, expected: 3 },
    { input: 4, expected: 2 },
    { input: 5, expected: 5 },
    { input: 6, expected: 3 },
    { input: 833301272, expected: 2815207 },
    { input: 783586238, expected: 7392323 },
    { input: 439117236, expected: 12197701 },
  ];

  for (const { input, expected } of testCases) {
    const actual = largest_prime(input);
    assert_eq(ns, expected, actual, `largest_prime(${JSON.stringify(input)})`);
  }

  assert_all_passed(ns);
}
