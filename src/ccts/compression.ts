import { NS } from '@ns'
import { autocomplete_func, ccts_main, CCTSolver } from './interface';
import { assert_eq, assert_all_passed } from '/lib/assert';
import { range } from '../lib/range';

export const autocomplete = autocomplete_func;

export const contracts = new Map<string, CCTSolver>([
  ['Compression I: RLE Compression', { solve: compression_1, test: test_compression_1 }],
  ['Compression II: LZ Decompression', { solve: compression_2, test: test_compression_2 }],
  ["Compression III: LZ Compression", { solve: compression_3, test: test_compression_3 }],
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
}

/**
 * Compression III: LZ Compression
 *
 * Lempel-Ziv (LZ) compression is a data compression technique which encodes data using references to earlier parts of
 * the data. In this variant of LZ, data is encoded in two types of chunk. Each chunk begins with a length L, encoded
 * as a single ASCII digit from 1 to 9, followed by the chunk data, which is either:
 *
 * 1. Exactly L characters, which are to be copied directly into the uncompressed data.
 * 2. A reference to an earlier part of the uncompressed data. To do this, the length is followed by a second ASCII
 *    digit X: each of the L output characters is a copy of the character X places before it in the uncompressed data.
 * For both chunk types, a length of 0 instead means the chunk ends immediately, and the next character is the start of
 * a new chunk. The two chunk types alternate, starting with type 1, and the final chunk may be of either type.
 *
 * @example (some have other possible encodings of minimal length):
 *   abracadabra     ->  7abracad47
 *   mississippi     ->  4miss433ppi
 *   aAAaAAaAaAA     ->  3aAA53035
 *   2718281828      ->  627182844
 *   abcdefghijk     ->  9abcdefghi02jk
 *   aaaaaaaaaaaa    ->  3aaa91
 *   aaaaaaaaaaaaa   ->  1a91031
 *   aaaaaaaaaaaaaa  ->  1a91041
 *
 * @param data You are given the following input string. Encode it using Lempel-Ziv encoding with the minimum possible output length
 */
function compression_3(data: unknown) {
  if (typeof(data) !== 'string') {
    throw new Error('Expected string, received ' + JSON.stringify(data));
  }

  const input = data as string;

  //log=console.log

  // DP state is a 2D array of strings where dp[j][k] is the best encoding of input up to the last characcter, and:
  //  - j is 0 if the encoding ended on a literal fragment, and 1-9 if it ended on a reference fragment looking behind
  //    at distance j
  //  - k is the length of that final fragment
  // Conceptually, the state is 3D, where i is the position in the input, but we only need to keep the last state
  // and the state we're currently building
  // (I started writing this as a 3D DP state, but it wasn't actually necessary)

  type entry = string | null;
  type kblock = [entry, entry, entry, entry, entry, entry, entry, entry, entry, entry];
  type DPState = [kblock, kblock, kblock, kblock, kblock, kblock, kblock, kblock, kblock, kblock];
  const new_state = () => [...new Array(10).keys().map(()=>new Array(10).fill(null))] as DPState;

  let state = new_state();

  let best_this_iteration: string | null = '';
  const add_candidate = (j: number, k: number, candidate: string) => {
    //log(`add_candidate(${j}, ${k}, '${candidate}')`);
    if (j < 0 || j >= state.length) return;
    if (k < 0 || k >= state[j].length) return;
    if (state[j][k] === null || candidate.length < state[j][k].length) {
      state[j][k] = candidate;
      if (best_this_iteration === null || candidate.length < best_this_iteration.length) {
        best_this_iteration = candidate;
      }
    }
  }

  let last = state;

  const lookup = (j: number, k: number) => {
    if (j < 0 || j >= last.length) return null;
    if (k < 0 || k >= last[j].length) return null;
    return last[j][k];
  }

  // Starting state: dp[0][0] = ''; such that a literal will start extending this fragment
  add_candidate(0, 0, '');

  let i = 0; // dp.length

  //log('Compressing: ', input);

  for (const c of input) {
    //log('Adding character ', c);
    last = state;
    state = new_state();
    best_this_iteration = null;
    //log('Attempting backreference based fragments');
    // See if we can encode this character in a backreference
    for (const lookbehind_distance of range(1, Math.min(i, 9) + 1)) {
      // If this character appears this far behind in the input, we can encode it as a backreference
      if (c != input[i - lookbehind_distance]) {
        continue;
      }
      //log('Attempting to extend a lookbehind based candidate with lookbehind length ', lookbehind_distance);
      // See if we can extend an existing backreference looking behind lookbehind_distance
      // Deliberately exclude 9 as we want a backreference to be extendable
      for (const fragment_length of range(1, 9)) {
        const best = lookup(lookbehind_distance, fragment_length);
        if (best === null) {
          // No such existing backreference fragment exists
          continue;
        }
        //log(`Extending from lookup(${lookbehind_distance}, ${fragment_length}) = '${lookup(lookbehind_distance, fragment_length)}'`);
        // Extend it, dropping the replacing the length,lookbehind_distance pair with a pair with a length one longer
        const encoding = `${best.slice(0, best.length - 2)}${fragment_length + 1}${lookbehind_distance}`;
        add_candidate(lookbehind_distance, fragment_length + 1, encoding);
      }

      //log('Attempting to create a new backreference with lookbehind length ', lookbehind_distance);
      // See if we can start a new backreference
      for (const literal_fragment_length of range(0, 10)) {
        const best = lookup(0, literal_fragment_length);
        if (!best) {
          continue;
        }
        // Start a new reference fragment of length 1 after a literal
        const encoding = `${best}1${lookbehind_distance}`;
        add_candidate(lookbehind_distance, 1, encoding);
      }
    }

    // Add a literal of length 0 after the best backreference terminated fragment for this character, if it exists
    // The cases where this might be needed are varied enough that we can do this proactively here, and it only creates
    // a single entry
    if (best_this_iteration !== null) {
      //log('Adding a 0 literal length fragment candidate after the best backreference terminated fragment');
      add_candidate(0, 0, `${best_this_iteration}0`);
    }

    //log('Attempting literal based fragments');
    // Add candidates for literals of each length

    // Then see if we can extend an existing literal fragment
    // Include 9; we'll create 0 length backreference fragment only if we have a literal which gets this long,
    // as we want to avoid needlessly creating empty backreferences
    for (const fragment_length of range(0, 10)) {
      const best = lookup(0, fragment_length);
      if (best === null) {
        // No such existing literal fragment exists
        continue;
      }
      // Extend it
      if (fragment_length < 9) {
        const length_index = best.length - 1 - fragment_length;
        //log('Length index: ', length_index);
        // Update the length character in the encoding, and append the new character as a literal
        const encoding = `${best.slice(0, Math.max(0, length_index))}${fragment_length + 1}${best.slice(length_index + 1)}${c}`;
        add_candidate(0, fragment_length + 1, encoding);
      } else {
        // Start a new literal fragment after an empty backreference fragment
        add_candidate(0, 1, `${best}01${c}`);
      }
    }

    i += 1;
  }

  if (!best_this_iteration) {
    throw new Error("best_this_iterator was null after processing the entire input, this shouldn't happen!");
  }

  return best_this_iteration;
}

function test_compression_3(ns: NS) {
  // Test cases for compression_3
  const testCases = [
    { input: 'ab', expected: '2ab' },
    { input: 'abracadabra', expected: '7abracad47' },
    { input: 'mississippi', expected: '4miss433ppi' },
    { input: 'aAAaAAaAaAA', expected: '3aAA53035' },
    { input: '2718281828', expected: '627182844' },
    { input: 'abcdefghijk', expected: '9abcdefghi02jk' },
    { input: 'aaaaaaaaaa', expected: '1a91' },
    { input: 'aaaaaaaaaaa', expected: '2aa91' },
    { input: 'aaaaaaaaaaaa', expected: '3aaa91' },
    { input: 'aaaaaaaaaaaaa', expected: '1a91031' },
    { input: 'aaaaaaaaaaaaaa', expected: '1a91041' },
  ];

  for (const { input, expected } of testCases) {
    const actual = compression_3(input);
    assert_eq(ns, expected, actual, `compression_3(${JSON.stringify(input)})`);
  }

  assert_all_passed(ns);
}
