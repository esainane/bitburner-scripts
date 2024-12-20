import { NS } from '@ns'
import { autocomplete_func, ccts_main, CCTSolver } from './interface';
import { assert_eq, assert_all_passed } from '/lib/assert';

export const autocomplete = autocomplete_func;

export const contracts = new Map<string, CCTSolver>([
  ["Array Jumping Game", { solve: array_jumping, test: test_array_jumping }],
  ['Array Jumping Game II', { solve: array_jumping_2, test: test_array_jumping_2 }]
]);

export const main = ccts_main(contracts);

/**
 * Array Jumping Game
 *
 * You are given the following array of integers:
 *
 * 0,0,5,0,7,9,0,3,0,9,3,9,9,2,10,8,6,1,1,3,7
 *
 * Each element in the array represents your MAXIMUM jump length at that position. This means that if you are at
 * position i and your maximum jump length is n, you can jump to any position from i to i+n.
 *
 * Assuming you are initially positioned at the start of the array, determine whether you are able to reach the last
 * index.
 *
 * Your answer should be submitted as 1 or 0, representing true and false respectively.
 * @param data Array of integers
 */
function array_jumping(data: unknown) {
  if (!Array.isArray(data) || typeof(data[0]) !== 'number') {
    throw new Error('Expected [number], received ' + JSON.stringify(data));
  }
  const arr = data as number[];

  const reachable = new Array(arr.length).fill(false);

  reachable[0] = true;
  for (const i of reachable.keys()) {
    if (!reachable[i]) {
      continue;
    }
    for (let j = 1; j <= arr[i] && i + j < arr.length; j++) {
      reachable[i + j] = true;
    }
  }

  return reachable[arr.length - 1] ? 1 : 0;
}

function test_array_jumping(ns: NS) {
  // Test cases for array_jumping
  const testCases = [
    { input: [0,0,5,0,7,9,0,3,0,9,3,9,9,2,10,8,6,1,1,3,7], expected: 0 },
    { input: [6,8,0,6,3,0,10,2,0,2,2,6,4,4,0,5,1], expected: 1 },
    { input: [10,0,10,2,0,8,8,8], expected: 1},
    { input: [2,9,4,1,0,1,0,1,0,0,0,0,3,0,2,10,9], expected: 0 },
  ];

  for (const { input, expected } of testCases) {
    const actual = array_jumping(input);
    assert_eq(ns, expected, actual, `array(${JSON.stringify(input)})`);
  }

  assert_all_passed(ns);
}

/**
 * Array Jumping Game II
 *
 * You are given the following array of integers:
 *
 * 2,5,2,1,1,3
 *
 * Each element in the array represents your MAXIMUM jump length at that position. This means that if you are at
 * position i and your maximum jump length is n, you can jump to any position from i to i+n.
 *
 * Assuming you are initially positioned at the start of the array, determine the minimum number of jumps to reach the
 * end of the array.
 *
 * If it's impossible to reach the end, then the answer should be 0.
 */
function array_jumping_2(data: unknown) {
  if (!Array.isArray(data) || typeof(data[0]) !== 'number') {
    throw new Error('Expected [number], received ' + JSON.stringify(data));
  }
  const arr = data as number[];
  const jumps = new Array(arr.length).fill(Infinity);

  jumps[0] = 0;
  for (const i of jumps.keys()) {
    if (jumps[i] < 0) {
      continue;
    }
    for (let j = 1; j <= arr[i] && i + j < arr.length; j++) {
      jumps[i + j] = Math.min(jumps[i + j], jumps[i] + 1);
    }
  }

  return jumps[arr.length - 1] === Infinity ? 0 : jumps[arr.length - 1];
}

function test_array_jumping_2(ns: NS) {
  // Test cases for array_jumping_2
  const testCases = [
    { input: [2,5,2,1,1,3], expected: 2 },
    { input: [4,4,2,3,1,2,1,2,4,5,4,0,6,1,1,0,3,5,1,0,2,5,2,5,2], expected: 8 },
    { input: [2,2,1,5,3,2,2,2,1,3,5,3,5,0,3,3,1,1,2,1,5], expected: 8 },
    { input: [2,5,3,1,2,2,1,4,2,3], expected: 4 },
  ];

  for (const { input, expected } of testCases) {
    const actual = array_jumping_2(input);
    assert_eq(ns, expected, actual, `array(${JSON.stringify(input)})`);
  }
}
