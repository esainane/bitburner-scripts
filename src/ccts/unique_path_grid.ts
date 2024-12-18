import { NS } from '@ns'
import { CCTSolver } from './interface';

export const contracts = new Map<string, CCTSolver>([
  ["Unique Paths in a Grid I", unique_grid_paths_1]
]);

function pascals_triangle(row: number, column: number) {
  // (row n, column k) is (row n, column (k - 1)) * (n + 1 - k) / k
  // indices are 0-based
  /*
  pascals_triangle(0, 0) = 1
  pascals_triangle(1, 0) = 1
  pascals_triangle(1, 1) = 1
  pascals_triangle(2, 0) = 1
  pascals_triangle(2, 1) = 2
  pascals_triangle(2, 2) = 1
  pascals_triangle(3, 0) = 1
  pascals_triangle(3, 1) = 3
  pascals_triangle(3, 2) = 3
  pascals_triangle(3, 3) = 1
  pascals_triangle(4, 0) = 1
  pascals_triangle(4, 1) = 4
  pascals_triangle(4, 2) = 6
  pascals_triangle(4, 3) = 4
  pascals_triangle(4, 4) = 1
  pascals_triangle(5, 0) = 1
  pascals_triangle(5, 1) = 5
  pascals_triangle(5, 2) = 10
  pascals_triangle(5, 3) = 10
  pascals_triangle(5, 4) = 5
  pascals_triangle(5, 5) = 1
  pascals_triangle(6, 0) = 1
  pascals_triangle(6, 1) = 6
  pascals_triangle(6, 2) = 15
  pascals_triangle(6, 3) = 20
  pascals_triangle(6, 4) = 15
  pascals_triangle(6, 5) = 6
  pascals_triangle(6, 6) = 1
  */
  let acc = 1
  for (let cell=1; cell <= column; ++cell) {
    acc *= (row + 1 - cell) / cell
  }
  return acc
}

export function unique_grid_paths_1(data: unknown) {
  /*
  You are in a grid with 2 rows and 9 columns, and you are positioned in the top-left corner of that grid.
  You are trying to reach the bottom-right corner of the grid, but you can only move down or right on each step.
  Determine how many unique paths there are from start to finish.

  NOTE: The data returned for this contract is an array with the number of rows and columns:
  [2,9]
  */
  // Effectively, pascal's triangle, tilted diagonally
  /*
  01 01 01 01 01 01
  01 02 03 04 05 06
  01 03 06 10 15 21
  01 04 10 20 35 56
  01 05 15 35 70 126
  */
  if (!Array.isArray(data) || data.length !== 2 || typeof data[0] !== 'number' || typeof data[1] !== 'number') {
    throw new Error('Expected [number, number], received ' + JSON.stringify(data));
  }
  const [w, h]: [number, number] = data as [number, number];
  const long = Math.max(w, h) - 1;
  const short = Math.min(w, h) - 1;
  const ways = pascals_triangle(long + short, short);
  return ways;
}

export async function main(ns: NS): Promise<void> {
  //
}
