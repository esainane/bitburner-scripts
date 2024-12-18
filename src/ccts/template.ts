import { NS } from '@ns'
import { autocomplete_func, ccts_main, CCTSolver } from './interface';
import { assert_eq, assert_all_passed } from '/lib/assert';

export const autocomplete = autocomplete_func;

export const contracts = new Map<string, CCTSolver>([
  ["TITLE_HERE", { solve: PLACEHOLDER, test: test_PLACEHOLDER }],
]);

export const main = ccts_main(contracts);

/**
 * TITLE_HERE
 *
 * DESCRIPTION_HERE
 * @param data PARAM_DESCRIPTION_HERE
 */
function PLACEHOLDER(data: unknown) {
  if (typeof(data) !== 'number') {
    throw new Error('Expected number, received ' + JSON.stringify(data));
  }
  // TODO: Implement PLACEHOLDER

  return 0;
}

function test_PLACEHOLDER(ns: NS) {
  // Test cases for PLACEHOLDER
  const testCases = [
    // TODO: Replace with proper test cases
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
    const actual = PLACEHOLDER(input);
    assert_eq(ns, expected, actual, `PLACEHOLDER(${JSON.stringify(input)})`);
  }

  assert_all_passed(ns);
}
