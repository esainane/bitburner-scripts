import { NS } from '@ns'
import { autocomplete_func, ccts_main, CCTSolver } from './interface';
import { assert_eq, assert_all_passed } from '/lib/assert';
import { range } from '/lib/range';

export const autocomplete = autocomplete_func;

export const contracts = new Map<string, CCTSolver>([
  ["Algorithmic Stock Trader I", { solve: algo_stock_1, test: test_algo_stock_1 }],
  ["Algorithmic Stock Trader II", { solve: algo_stock_2, test: test_algo_stock_2 }],
  ["Algorithmic Stock Trader III", { solve: algo_stock_3, test: test_algo_stock_3 }],
  ["Algorithmic Stock Trader IV", { solve: algo_stock_4, test: test_algo_stock_4 }],
]);

export const main = ccts_main(contracts);

/**
 * Algorithmic Stock Trader I
 * Determine the maximum possible profit you can earn using at most one transaction
 * (i.e. you can only buy and sell the stock once).
 * If no profit can be made then the answer should be 0.
 * Note that you have to buy the stock before you can sell it.
 *
 * @param data You are given the following array of stock prices (which are numbers) where the i-th element represents the stock price on day i.
 */
function algo_stock_1(data: unknown) {
  if (!Array.isArray(data)) {
    throw new Error('Expected array of prices, received ' + JSON.stringify(data));
  }
  const prices: number[] = data;
  // Determine maximum potential profit from holding up to one share at a time
  let profit = 0;
  if (!prices.length) {
    return 0;
  }
  let last: number = prices[0];
  for (const current of prices.slice(1)) {
    if (current > last) {
      profit = Math.max(profit, current - last);
    } else {
      last = current;
    }
  }
  return profit;
}

function test_algo_stock_1(ns: NS) {
  // Test cases for algo_stock_1
  const testCases = [
    { input: [3, 3, 5, 0, 0, 3, 1, 4], expected: 4 },
    { input: [7, 6, 4, 3, 1], expected: 0 },
    { input: [1, 2, 3, 4, 5], expected: 4 },
    { input: [], expected: 0 },
    { input: [1], expected: 0 },
  ];

  for (const { input, expected } of testCases) {
    const actual = algo_stock_1(input);
    assert_eq(ns, expected, actual, `algo_stock_1(${JSON.stringify(input)})`);
  }

  assert_all_passed(ns);
}

/**
 * Algorithmic Stock Trader II
 *
 * Determine the maximum possible profit you can earn using as many transactions as you'd like.
 * A transaction is defined as buying and then selling one share of the stock.
 * Note that you cannot engage in multiple transactions at once.
 * In other words, you must sell the stock before you buy it again.
 *
 * If no profit can be made, then the answer should be 0.
 *
 * @param data You are given the following array of stock prices (which are numbers) where the i-th element represents the stock price on day i.
 */
function algo_stock_2(data: unknown) {
  if (!Array.isArray(data)) {
    throw new Error('Expected array of prices, received ' + JSON.stringify(data));
  }
  const prices: number[] = data;
  // Determine maximum potential profit from holding up to one share at a time
  let profit = 0;
  if (!prices.length) {
    return 0;
  }
  let last: number = prices[0];
  for (const current of prices.slice(1)) {
    if (current > last) {
      profit += current - last;
    }
    last = current;
  }
  return profit;
}

function test_algo_stock_2(ns: NS) {
  // Test cases for algo_stock_2
  const testCases = [
    { input: [1, 2, 3, 4, 5], expected: 4 },
    { input: [7, 1, 5, 3, 6, 4], expected: 7 },
    { input: [7, 6, 4, 3, 1], expected: 0 },
    { input: [], expected: 0 },
    { input: [1], expected: 0 },
  ];

  for (const { input, expected } of testCases) {
    const actual = algo_stock_2(input);
    assert_eq(ns, expected, actual, `algo_stock_2(${JSON.stringify(input)})`);
  }

  assert_all_passed(ns);
}

/**
 * Algorithmic Stock Trader III
 *
 * Determine the maximum possible profit you can earn using at most two transactions.
 * A transaction is defined as buying and then selling one share of the stock.
 * Note that you cannot engage in multiple transactions at once.
 * In other words, you must sell the stock before you buy it again.
 *
 * If no profit can be made, then the answer should be 0.
 * @param data You are given the following array of stock prices (which are numbers) where the i-th element represents the stock price on day i.
 */
function algo_stock_3(data: unknown) {
  if (!Array.isArray(data)) {
    throw new Error('Expected array of prices, received ' + JSON.stringify(data));
  }
  const prices: number[] = data;
  // Determine maximum potential profit from holding up to one share at a time for up to two runs
  if (!prices.length) {
    return 0;
  }

  const n = prices.length;
  const dp = Array.from({ length: 3 }, () => Array(n).fill(0));

  for (let k = 1; k <= 2; k++) {
    let minPrice = prices[0];
    for (let i = 1; i < n; i++) {
      minPrice = Math.min(minPrice, prices[i] - dp[k - 1][i - 1]);
      dp[k][i] = Math.max(dp[k][i - 1], prices[i] - minPrice);
    }
  }

  return dp[2][n - 1];
}

function test_algo_stock_3(ns: NS) {
  // Test cases for algo_stock_3
  const testCases = [
    { input: [3, 3, 5, 0, 0, 3, 1, 4], expected: 6 },
    { input: [1, 2, 3, 4, 5], expected: 4 },
    { input: [7, 6, 4, 3, 1], expected: 0 },
    { input: [1, 2, 4, 2, 5, 7, 2, 4, 9, 0], expected: 13 },
    { input: [], expected: 0 },
    { input: [1], expected: 0 },
  ];

  for (const { input, expected } of testCases) {
    const actual = algo_stock_3(input);
    assert_eq(ns, expected, actual, `algo_stock_3(${JSON.stringify(input)})`);
  }

  assert_all_passed(ns);
}

/**
 * Algorithmic Stock Trader IV
 *
 * You are given the following array with two elements:
 *
 * [3, [28,133,183,93,82,95,6,73,96,60,165,27,148,119,82,153,187,7,178,138,91,91,41,36,17,59,79,8,91,23,159,37,149,180,150,84,48,77,198,30,155,35]]
 *
 * The first element is an integer k. The second element is an array of stock prices (which are numbers) where the i-th
 * element represents the stock price on day i.
 *
 * Determine the maximum possible profit you can earn using at most k transactions. A transaction is defined as buying
 * and then selling one share of the stock. Note that you cannot engage in multiple transactions at once. In other
 * words, you must sell the stock before you can buy it again.
 *
 * If no profit can be made, then the answer should be 0.
 */
function algo_stock_4(data: unknown) {
  if (!Array.isArray(data) || data.length !== 2 || typeof data[0] !== 'number' || !Array.isArray(data[1]) || !data[1].every(d => typeof d === 'number')) {
    throw new Error('Expected array of prices, received ' + JSON.stringify(data));
  }
  const [k_max, prices] = data as [number, number[]];
  // Determine maximum potential profit from holding up to one share at a time for up to k runs
  if (!prices.length) {
    return 0;
  }

  const n = prices.length;
  const dp = Array.from({ length: k_max + 1 }, () => Array(n).fill(0));

  for (let k = 1; k <= k_max; k++) {
    let minPrice = prices[0];
    for (let i = 1; i < n; i++) {
      minPrice = Math.min(minPrice, prices[i] - dp[k - 1][i - 1]);
      dp[k][i] = Math.max(dp[k][i - 1], prices[i] - minPrice);
    }
  }

  return Math.max(...range(k_max + 1).map(d=>dp[d][n - 1]));
}

function test_algo_stock_4(ns: NS) {
  // Test cases for algo_stock_4
  const testCases = [
    { input: [3, [0, 3, 0, 4, 0, 5, 0, 6]], expected: 15 },
    { input: [6,[90,19,188,149,147,134,165,28,144,67,181,85,102,127,151,189,164,7,48,65,18,94,60,181,5,71,10,154,117,82,175,102,22,158,176,132,83,7,85,132,63,89,21,119,11,68,41,200]], expected: 1021 },
    { input: [10,[81,187,157,20,30,54,160,16,185,92,64,60,10,182,194,11,103,81,56,86,62,116,66,56,6]], expected: 775 },
    { input: [2,[31,109,94,123,12,3,155,12,77,143,198,34,76,173,181,197,93,17,76,6,52,144,36,119,76,34,189,123,53,102,73,169,17,27,69,81,84,187,191,89,170,81,44,110,34,44]], expected: 380 },
  ];

  for (const { input, expected } of testCases) {
    const actual = algo_stock_4(input);
    assert_eq(ns, expected, actual, `algo_stock_4(${JSON.stringify(input)})`);
  }

  assert_all_passed(ns);
}
