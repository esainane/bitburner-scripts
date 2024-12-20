import { NS } from '@ns'
import { autocomplete_func, ccts_main, CCTSolver } from './interface';
import { assert_eq, assert_all_passed } from '/lib/assert';

export const autocomplete = autocomplete_func;

export const contracts = new Map<string, CCTSolver>([
  ["Total Ways to Sum II", { solve: sum_2, test: test_sum }],
]);

export const main = ccts_main(contracts);

/**
 * Total Ways to Sum II
 *
 * How many different distinct ways can the number 39 be written as a sum of integers contained in the set:
 * @example [1,3,4,5,7,8,9,11,12]?
 * You may use each integer in the set zero or more times.
 *
 * @param data [total,[members]]
 */
function sum_2(data: unknown) {
  if (!Array.isArray(data) || data.length !== 2 || typeof data[0] !== 'number' || !Array.isArray(data[1])) {
    throw new Error('Expected [total,[members]], received ' + JSON.stringify(data));
  }
  // First element is total, second element is the set of members.
  const [total, members]: [number, number[]] = data as [number, number[]];

  const dp = Array(total + 1).fill(0);
  dp[0] = 1;
  for (const member of members) {
    for (let i = member; i <= total; i++) {
      dp[i] += dp[i - member];
    }
  }
  return dp[total];
}

function test_sum(ns: NS) {
  // Test cases for sum
  const testCases = [
    { input: [39, [1, 3, 4, 5, 7, 8, 9, 11, 12]], expected: 2451 },
    { input: [82,[1,2,6,7,8,10,12,13,14,15,16,17]], expected: 142809 },
  ];

  for (const { input, expected } of testCases) {
    const actual = sum_2(input);
    assert_eq(ns, expected, actual, `sum(${JSON.stringify(input)})`);
  }

  assert_all_passed(ns);
}
