import { NS } from '@ns'
import { autocomplete_func, CCTResult, ccts_main, CCTSolver } from './interface';
import { assert_eq, assert_all_passed, assert_set_eq } from '/lib/assert';
import { format_data } from '/lib/colors';

export const autocomplete = autocomplete_func;

export const contracts = new Map<string, CCTSolver>([
  ["Find All Valid Math Expressions", { solve: find_math_expressions, test: test_find_math_expressions }],
  ["Generate IP Addresses", { solve: generate_ips, test: test_generate_ips }],
  ["Total Ways to Sum", { solve: sum, test: test_sum }],
  ["Total Ways to Sum II", { solve: sum_2, test: test_sum_2 }],
  ["Square Root", { solve: square_root, test: test_square_root }],
]);

export const main = ccts_main(contracts);

/**
 * Find All Valid Math Expressions
 *
 * You are given the following string which contains only digits between 0 and 9.
 *
 * You are also given a target number of -86. Return all possible ways you can add the +(add), -(subtract), and *(multiply) operators to the string such that it evaluates to the target number. (Normal order of operations applies.)
 *
 * The provided answer should be an array of strings containing the valid expressions. The data provided by this problem is an array with two elements. The first element is the string of digits, while the second element is the target number:
 *
 * @example ["3224124", -86]
 *
 * NOTE: The order of evaluation expects script operator precedence.
 * NOTE: Numbers in the expression cannot have leading 0's. In other words, "1+01" is not a valid expression.
 *
 * @example Input: digits = "123", target = 6
 *          Output: ["1+2+3", "1*2*3"]
 * @example Input: digits = "105", target = 5
 *          Output: ["1*0+5", "10-5"]
 */
function find_math_expressions(data: unknown) {
  if (!Array.isArray(data) || data.length !== 2 || typeof data[0] !== 'string' || typeof data[1] !== 'number') {
    throw new Error('Expected [string, number], received ' + JSON.stringify(data));
  }
  const [digits, target] = data as [string, number];
  if (!digits.split('').every((c) => ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(c))) {
    throw new Error('Expected digits is string of digits, received ' + JSON.stringify(digits));
  }

  // Track both the current accumulated value and the multiplied accumulated value
  // The multipled accumulated value gets reset whenever we do a non-multiplication
  const dfs = (s: string, acc: number, mult_acc: number, root=false): Array<string> => {
    if (s.length === 0) {
      if (acc == target) {
        return [''];
      }
      return [];
    }
    let result: Array<string> = [];
    for (const i of s.startsWith('0') ? [0] : Array(s.length).keys()) {
      const number = parseInt(s.slice(0, 1 + i));
      const tail = s.slice(1 + i);
      if (root) {
        result = [
          ...result,
          ...dfs(tail, number, number).map(d=>`${number}${d}`),
        ];
      } else {
        // Construct result strings lazily, rather than 4**(s.length-1) times
        result = [
          ...result,
          ...dfs(tail, acc + number, number).map(d=>`+${number}${d}`),
          ...dfs(tail, acc - number, -number).map(d=>`-${number}${d}`),
          // acc includes one instance of mult_acc already, so we only need to add number - 1 more
          ...dfs(tail, acc + mult_acc * (number - 1), mult_acc * number).map(d=>`*${number}${d}`),
        ];
      }
    }
    return result;
  };

  return dfs(digits, 0, 0, true);
}

function test_find_math_expressions(ns: NS) {
  // Test cases for find_math_expressions
  const testCases = [
    { input: ['123', 6], expected: ['1+2+3', '1*2*3'] },
    { input: ['105', 5], expected: ['1*0+5', '10-5'] },
  ];

  for (const { input, expected } of testCases) {
    const actual = find_math_expressions(input);
    assert_set_eq(ns, new Set(expected), new Set(actual), `find_math_expressions(${JSON.stringify(input)})`);
  }
}

/**
 * Generate IP Addresses
 *
 * Given the following string containing only digits, return an array with all possible valid IP address combinations
 * that can be created from the string
 *
 * Note that an octet cannot begin with a '0' unless the number itself is exactly '0'. For example, '192.168.010.1' is not a valid IP.
 *
 * @example 187212159172
 *
 * @param data string
 */
function generate_ips(data: unknown) {
  if (typeof data !== 'string') {
    throw new Error('Expected string, received ' + JSON.stringify(data));
  }
  const num = data as string;

  const valid_octet = (o: string) => o.length > 0 && parseInt(o) <= 255 && (o.length === 1 || o[0] !== '0');

  const result: Array<string> = [];
  const dfs = (s: string, frags: string[], piece: number) => {
    for (const i of Array(3).keys()) {
      const octet = s.slice(0, 1 + i);
      if (valid_octet(octet)) {
        const tail = s.slice(1 + i);
        if (piece === 3 && valid_octet(tail)) {
          result.push([...frags, octet, tail].join('.'));
        } else {
          dfs(tail, [...frags, octet], piece + 1);
        }
      }
    }
  };

  dfs(num, [], 1);

  return result;
}

function test_generate_ips(ns: NS) {
  // Test cases for generate_ips
  const testCases = [
    { input: '187212159172', expected: [
      '187.212.159.172',
    ]},
    { input: '2552552550', expected: [
      '255.255.255.0',
      '255.255.25.50'
    ]},
  ];

  for (const { input, expected } of testCases) {
    const actual = generate_ips(input);
    assert_set_eq(ns, new Set(expected), new Set(actual), `generate_ips(${JSON.stringify(input)})`);
  }
}

/**
 * Total Ways to Sum
 *
 * It is possible write four as a sum in exactly four different ways
 *   3 + 1
 *   2 + 2
 *   2 + 1 + 1
 *   1 + 1 + 1 + 1
 *
 * @example How many different distinct ways can the number 49 be written as a sum of at least two positive integers?
 *
 * @param data number
 */
function sum(data: unknown) {
  if (typeof data !== 'number') {
    throw new Error('Expected number, received ' + JSON.stringify(data));
  }
  const num = data as number;

  // Use dynamic programming to solve this problem
  // There's probably a nice formula for this, but I already did sum_2 first
  const dp = Array(num + 1).fill(0);
  dp[0] = 1;
  for (let i = 1; i < num; i++) {
    for (let j = i; j <= num; j++) {
      dp[j] += dp[j - i];
    }
  }

  return dp[num];
}

function test_sum(ns: NS) {
  // Test cases for sum
  const testCases = [
    { input: 4, expected: 4 },
    { input: 49, expected: 173524 },
    { input: 62, expected: 1300155 },
  ];

  for (const { input, expected } of testCases) {
    const actual = sum(input);
    assert_eq(ns, expected, actual, `sum(${JSON.stringify(input)})`);
  }

  assert_all_passed(ns);
}

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

function test_sum_2(ns: NS) {
  // Test cases for sum_2
  const testCases = [
    { input: [39, [1, 3, 4, 5, 7, 8, 9, 11, 12]], expected: 2451 },
    { input: [82,[1,2,6,7,8,10,12,13,14,15,16,17]], expected: 142809 },
  ];

  for (const { input, expected } of testCases) {
    const actual = sum_2(input);
    assert_eq(ns, expected, actual, `sum_2(${JSON.stringify(input)})`);
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
