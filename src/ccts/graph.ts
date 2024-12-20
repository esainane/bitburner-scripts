import { NS } from '@ns'
import { autocomplete_func, ccts_main, CCTSolver } from './interface';
import { assert_eq, assert_all_passed, assert_arr_eq } from '/lib/assert';

export const autocomplete = autocomplete_func;

export const contracts = new Map<string, CCTSolver>([
  ["Proper 2-Coloring of a Graph", { solve: graph, test: test_graph }],
]);

export const main = ccts_main(contracts);

/**
 * Proper 2-Coloring of a Graph
 *
 * You are given the following data, representing a graph:
 *
 * [11,[[3,8],[4,5],[4,7],[4,8],[4,9],[6,10],[6,7],[0,4],[5,10],[1,6],[3,5],[2,7],[2,5],[3,9],[7,10],[3,7],[2,8],[1,4]]]
 *
 * Note that "graph", as used here, refers to the field of graph theory, and has no relation to statistics or plotting.
 * The first element of the data represents the number of vertices in the graph. Each vertex is a unique number between
 * 0 and 10. The next element of the data represents the edges of the graph. Two vertices u,v in a graph are said to be
 * adjacent if there exists an edge [u,v]. Note that an edge [u,v] is the same as an edge [v,u], as order does not
 * matter. You must construct a 2-coloring of the graph, meaning that you have to assign each vertex in the graph a
 * "color", either 0 or 1, such that no two adjacent vertices have the same color. Submit your answer in the form of an
 * array, where element i represents the color of vertex i. If it is impossible to construct a 2-coloring of the given
 * graph, instead submit an empty array.
 *
 * @example Input: [4, [[0, 2], [0, 3], [1, 2], [1, 3]]]
 *          Output: [0, 0, 1, 1]
 *
 * @example Input: [3, [[0, 1], [0, 2], [1, 2]]]
 *          Output: []
 * @param data [number, [number, number][]]
 */
function graph(data: unknown) {
  if (!Array.isArray(data) || data.length !== 2 || typeof data[0] !== 'number' || !Array.isArray(data[1]) || data[1].some(e => !Array.isArray(e) || e.length !== 2 || e.some(v => typeof v !== 'number'))) {
    throw new Error('Expected [number, [number, number][]], received ' + JSON.stringify(data));
  }
  const [vertex_count, edges] = data as [number, [number, number][]];

  const colors = new Array(vertex_count).fill(-1);

  const adjacent = new Map<number, number[]>(colors.keys().map(v => [v, []]));

  // Initialize the adjacency list
  for (const [u, v] of edges) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    adjacent.get(u)!.push(v);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    adjacent.get(v)!.push(u);
  }

  // Alternate with each step, returning false if a conflict is found
  const dfs = (v: number, color: number): boolean => {
    if (colors[v] !== -1) {
      return colors[v] === color;
    }
    colors[v] = color;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return adjacent.get(v)!.every(u => dfs(u, 1 - color));
  };

  for (const v of colors.keys()) {
    if (colors[v] === -1 && !dfs(v, 0)) {
      return [];
    }
  }

  return colors;
}

function test_graph(ns: NS) {
  // Test cases for graph
  const testCases = [
    { input: [4, [[0, 2], [0, 3], [1, 2], [1, 3]]], expected: [0, 0, 1, 1] },
    { input: [3, [[0, 1], [0, 2], [1, 2]]], expected: [] },
    { input: [11,[[0,10],[0,3],[1,4],[9,10],[3,5],[1,8],[0,4],[0,10],[5,6],[5,7],[3,9],[0,7],[1,7],[6,9],[2,9],[1,6]]], expected: [0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1]},
    { input: [12,[[3,9],[2,9],[2,6],[1,8],[3,11],[8,9],[0,6],[5,10],[6,8],[1,6],[1,7],[0,1],[4,7],[2,4],[5,8],[1,3],[2,5]]], expected: []},
  ];

  for (const { input, expected } of testCases) {
    const actual = graph(input);
    assert_arr_eq(ns, expected, actual, `graph(${JSON.stringify(input)})`);
  }

  assert_all_passed(ns);
}
