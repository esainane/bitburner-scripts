import { NS } from '@ns'
import { CCTSolver } from './interface';

export const contracts = new Map<string, CCTSolver>([
  ["Algorithmic Stock Trader II", algo_stock_2],
  // TODO: Finish implementation
  //["Algorithmic Stock Trader III", algo_stock_3]
]);

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

function algo_stock_3(data: unknown) {
  if (!Array.isArray(data)) {
    throw new Error('Expected array of prices, received ' + JSON.stringify(data));
  }
  const prices: number[] = data;
  // Determine maximum potential profit from holding up to one share at a time for up to two runs
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

export async function main(ns: NS): Promise<void> {
  //
}
