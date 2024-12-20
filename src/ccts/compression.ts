import { NS } from '@ns'
import { autocomplete_func, ccts_main, CCTSolver } from './interface';
import { assert_eq, assert_all_passed } from '/lib/assert';

export const autocomplete = autocomplete_func;

export const contracts = new Map<string, CCTSolver>([
  ['Compression I: RLE Compression', { solve: compression_1, test: test_compression_1 }],
]);

export const main = ccts_main(contracts);

/**
 * Compression I: RLE Compression
 *
 * Run-length encoding (RLE) is a data compression technique which encodes data as a series of runs of a repeated
 * single character. Runs are encoded as a length, followed by the character itself. Lengths are encoded as a single
 * ASCII digit; runs of 10 characters or more are encoded by splitting them into multiple runs.
 *
 * You are given the following input string:
 * @example aaaaabccc            ->  5a1b3c
 * @example aAaAaA               ->  1a1A1a1A1a1A
 * @example 111112333            ->  511233
 * @example zzzzzzzzzzzzzzzzzzz  ->  9z9z1z  (or 9z8z2z, etc.)
 *
 * Encode it using run-length encoding with the minimum possible output length.
 */
function compression_1(data: unknown) {
  if (typeof(data) !== 'string') {
    throw new Error('Expected string, received ' + JSON.stringify(data));
  }

  const input = data as string;

  let encoded_output = '';
  let i = 0;

  // Compress the input

  const add_run = (input: string, encoded_output: string, i: number): [string, number] => {
    const char = input[i];
    let run_length = 1;
    while (i + run_length < input.length && input[i + run_length] === char) {
      run_length++;
    }
    let to_add = run_length;
    while (to_add > 0) {
      const run = Math.min(to_add, 9);
      encoded_output += run + char;
      to_add -= run;
    }
    return [encoded_output, i + run_length];
  };

  while (i < input.length) {
    [encoded_output, i] = add_run(input, encoded_output, i);
  }

  // Return the compressed output

  return encoded_output;
}

function test_compression_1(ns: NS) {
  // Test cases for compression_1
  const testCases = [
    { input: 'aaaaabccc', expected: '5a1b3c' },
    { input: 'aAaAaA', expected: '1a1A1a1A1a1A' },
    { input: '111112333', expected: '511233' },
    { input: 'zzzzzzzzzzzzzzzzzzz', expected: '9z9z1z' },
  ];

  for (const { input, expected } of testCases) {
    const actual = compression_1(input);
    assert_eq(ns, expected, actual, `compression_1(${JSON.stringify(input)})`);
  }

  assert_all_passed(ns);
}
