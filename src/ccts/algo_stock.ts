import { NS } from '@ns'
import { autocomplete_func, ccts_main, CCTSolver } from './interface';
import { assert_eq, assert_all_passed } from '/lib/assert';

export const autocomplete = autocomplete_func;

export const contracts = new Map<string, CCTSolver>([
  ["Algorithmic Stock Trader II", { solve: algo_stock_2, test: test_algo_stock_2 }],
  ["Algorithmic Stock Trader III", { solve: algo_stock_3, test: test_algo_stock_3 }],
]);

export const main = ccts_main(contracts);

/**
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

