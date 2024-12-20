import { NS } from '@ns'
import { autocomplete_func, CCTResult, ccts_main, CCTSolver } from './interface';
import { assert_eq, assert_all_passed } from '/lib/assert';
import { format_data } from '/lib/colors';

export const autocomplete = autocomplete_func;

export const contracts = new Map<string, CCTSolver>([
  ["Total Ways to Sum II", { solve: sum_2, test: test_sum }],
  ["Square Root", { solve: square_root, test: test_square_root }],
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

/**
 * Square Root
 *
 * You are given a ~200 digit BigInt. Find the square root of this number, to the nearest integer.
 * Hint: If you are having trouble, you might consult https://en.wikipedia.org/wiki/Methods_of_computing_square_roots
 *
 * @example 166977220639873568039570212747697522541766349344255286263152426457998392476874484444828630260938953504635502313622596209920494859264293160875210014572038869136508661642709274293951803142683216374897326
 *
 * @param data A very large bigint to compute the square root of.
 */
function square_root(data: unknown): CCTResult {
  if (data?.constructor !== BigInt || typeof data !== 'bigint') {
    throw new Error('Expected bigint, received ' + JSON.stringify(data));
  }
  const input = data as bigint;

  // Use newton's method to approximate the square root
  // https://en.wikipedia.org/wiki/Newton%27s_method
  // x_{n+1} = x_n - f(x_n) / f'(x_n)
  // f(x) = x^2 - n
  // f'(x) = 2x
  // x_{n+1} = x_n - (x_n^2 - n) / 2x_n
  //         = (x_n + n / x_n) / 2
  let x: bigint = input;
  let prev;
  do {
    prev = x;
    x = (x + input / x) / BigInt(2);
  } while (Math.abs(Number(x - prev)) > 0.1);

  // Crude hack: Check if +1 is closer
  const delta = input - x * x;
  const xp1 = x + 1n;
  const bigabs = (n: bigint) => n < 0n ? -n : n;
  if (bigabs(delta) > bigabs(input - xp1 * xp1)) {
    return xp1.toString();
  }
  return x.toString();
}

function test_square_root(ns: NS) {
  // Test cases for square_root
  const testCases = [
    { input: 256n, expected: '16' },
    { input: 1000000n, expected: '1000' },
    { input: 101n, expected: '10' },
    { input: 81800660166970062454717703527782825622247866021467943618761024765678811633900546879352737307740613557052027109340622994226058910791586247767230572060816589827227984240950306598492340686791002075421487n, expected: '9044371739760040538463101859665586209320632691201645374195800217404117808315500465526525364895392173' },
    { input: 166977220639873568039570212747697522541766349344255286263152426457998392476874484444828630260938953504635502313622596209920494859264293160875210014572038869136508661642709274293951803142683216374897326n, expected: '12921966593358518973244403159150053278328954086144076461527385469614386604162118979450485938532803142' },
  ];

  for (const { input, expected } of testCases) {
    const actual = square_root(input);
    assert_eq(ns, expected, actual, `square_root(${format_data(input)})`);
  }

  assert_all_passed(ns);
}
