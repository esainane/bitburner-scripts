import { NS } from '@ns'
import { autocomplete_func, ccts_main, CCTSolver } from './interface';
import { assert_eq, assert_all_passed } from '/lib/assert';

export const autocomplete = autocomplete_func;

export const contracts = new Map<string, CCTSolver>([
  ['Compression I: RLE Compression', { solve: compression_1, test: test_compression_1 }],
  ['Compression II: LZ Decompression', { solve: compression_2, test: test_compression_2 }],
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

/**
 * Compression II: LZ Decompression
 *
 * Lempel-Ziv (LZ) compression is a data compression technique which encodes data using references to earlier parts of
 * the data. In this variant of LZ, data is encoded in two types of chunk. Each chunk begins with a length L, encoded
 * as a single ASCII digit from 1 to 9, followed by the chunk data, which is either:
 *
 * 1. Exactly L characters, which are to be copied directly into the uncompressed data.
 * 2. A reference to an earlier part of the uncompressed data. To do this, the length is followed by a second ASCII
 * digit X: each of the L output characters is a copy of the character X places before it in the uncompressed data.
 *
 * For both chunk types, a length of 0 instead means the chunk ends immediately, and the next character is the start of
 * a new chunk. The two chunk types alternate, starting with type 1, and the final chunk may be of either type.
 *
 * You are given the following LZ-encoded string:
 *     45B62115xmGGc8424r870463OIP953GXh8928o3954LIZc513Maj6353LhAW
 * Decode it and output the original string.
 *
 * @example decoding '5aaabb450723abb' chunk-by-chunk
 *
 *   5aaabb           ->  aaabb
 *   5aaabb45         ->  aaabbaaab
 *   5aaabb450        ->  aaabbaaab
 *   5aaabb45072      ->  aaabbaaababababa
 *   5aaabb450723abb  ->  aaabbaaababababaabb
 */
function compression_2(data: unknown) {
  if (typeof(data) !== 'string') {
    throw new Error('Expected string, received ' + JSON.stringify(data));
  }

  const input = data as string;

  let decoded_output = '';

  // Decompress the input. Do this character by character, as we can reference characters which we have written out
  // in the same lookbehind chunk.

  let in_literal = false;
  let chunk_remaining = 0;
  for (const c of input) {
    if (chunk_remaining-- <= 0) {
      in_literal = !in_literal;
      chunk_remaining = parseInt(c);
      continue;
    }
    if (in_literal) {
      decoded_output += c;
    } else {
      const lookbehind_distance = parseInt(c);
      do  {
        decoded_output += decoded_output[decoded_output.length - lookbehind_distance];
      } while (chunk_remaining-- > 0);
    }
  }

  // Return the decompressed output

  return decoded_output;
}

function test_compression_2(ns: NS) {
  // Test cases for compression_2
  const testCases = [
    { input: '5aaabb450723abb', expected: 'aaabbaaababababaabb' },
    { input: "4wsIw929gaWovh42b09uMpRkT04m096m4J0AKSj09ilYG4uy6l483ANS23", expected: "wsIwIwIwIwIwIgaWovh42buMpRkT04m6m4J0AKSjilYG4uy6llYG4ANSAN" },
    { input: "8PQVzjVdC956m0OOO6254DGwu612th888rdRrv72C924ITLC", expected: "PQVzjVdCzjVdCzjVdm0OOO60ODGwuuuuuuuthuuuuuuthrdRrv72C2C2C2C2C2ITLC" },
    { input: "8B2PUh0gH159jjOfFrTsY09vnSFEKj4d05v5jTl9196emS5vlKm09IL6vyBMe704327c34", expected: "B2PUh0gHUjjOfFrTsYvnSFEKj4dv5jTllllllllll6emS5vlKmIL6vyBMe7327c327" },
  ];

  for (const { input, expected } of testCases) {
    const actual = compression_2(input);
    assert_eq(ns, expected, actual, `compression_2(${JSON.stringify(input)})`);
}
