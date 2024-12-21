import { NS } from '@ns'
import { autocomplete_func, ccts_main, CCTSolver } from './interface';
import { assert_eq, assert_all_passed } from '/lib/assert';
import { range } from '/lib/range';

export const autocomplete = autocomplete_func;

export const contracts = new Map<string, CCTSolver>([
  ["HammingCodes: Encoded Binary to Integer", { solve: hamming_decode, test: test_hamming_decode }],
  ["HammingCodes: Integer to Encoded Binary", { solve: hamming_encode, test: test_hamming_encode }],
]);

export const main = ccts_main(contracts);

/**
 * HammingCodes: Encoded Binary to Integer
 *
 * Decode it as an 'extended Hamming code' and convert it to a decimal value.
 * The binary string may include leading zeroes.
 * A parity bit is inserted at position 0 and at every position N where N is a power of 2.
 * Parity bits are used to make the total number of '1' bits in a given set of data even.
 * The parity bit at position 0 considers all bits including parity bits.
 * Each parity bit at position 2^N alternately considers 2^N bits then ignores 2^N bits, starting at position 2^N.
 * The endianness of the parity bits is reversed compared to the endianness of the data bits:
 * Data bits are encoded most significant bit first and the parity bits encoded least significant bit first.
 * The parity bit at position 0 is set last.
 * There is a ~55% chance for an altered bit at a random index.
 * Find the possible altered bit, fix it and extract the decimal value.
 *
 * For more information on the 'rule' of encoding, refer to Wikipedia (https://wikipedia.org/wiki/Hamming_code)
 * or the 3Blue1Brown videos on Hamming Codes. (https://youtube.com/watch?v=X8jsijhllIA)
 *
 * @example '11110000' passes the parity checks and has data bits of 1000, which is 8 in binary.
 * @example '1001101010' fails the parity checks and needs the last bit to be corrected to get '1001101011', after
 *          which the data bits are found to be 10101, which is 21 in binary.
 *
 * @param data You are given the following encoded binary string.
 */
function hamming_decode(data: unknown) {
  if (typeof(data) !== 'string') {
    throw new Error('Expected string, received ' + JSON.stringify(data));
  }
  console.log('--------');
  const bits = data as string;
  const numeric_bits = [...bits].map(d => parseInt(d));

  // Keep track of the error state
  let err = 0;
  for (const [i, bit] of numeric_bits.entries()) {
    if (bit === 1) {
      err ^= i;
    }
  }

  console.log('bit kind', numeric_bits.map((_, i) => (i & (i - 1)) === 0 ? 'p' : 'd').join(''));
  console.log('decoding', numeric_bits.join(''));

  // If there is an error, flip the bit
  if (err !== 0) {
    numeric_bits[err] ^= 1;
    console.log('became: ', numeric_bits.join(''));
  }

  // Fetch the data bits and convert them to a number
  const data_bits = [...numeric_bits].filter((_, i) => (i & (i - 1)) !== 0);
  console.log('data bits: ', data_bits.join(''));
  const value = [...data_bits].reduce((acc, bit) => (acc << 1) | bit, 0);
  console.log('data val:  ', value);
  return value;
}

function test_hamming_decode(ns: NS) {
  // Test cases for hamming_decode
  const testCases = [
    { input: '11110000', expected: 8 },
    { input: '1001101010', expected: 21 },
    // FIXME: This currently breaks. Maybe 32-bit limit on integer shifts somewhere?
    { input: '1100000010000000100000011101011001100110000111001100101000110001', expected: 1011030477361 },
  ];

  for (const { input, expected } of testCases) {
    const actual = hamming_decode(input);
    assert_eq(ns, expected, actual, `hamming(${JSON.stringify(input)})`);
  }

  assert_all_passed(ns);
}

/**
 * HammingCodes: Integer to Encoded Binary
 *
 * You are given the following decimal value:
 * 33707039
 *
 * Convert it to a binary representation and encode it as an 'extended Hamming code'.
 * The number should be converted to a string of '0' and '1' with no leading zeroes.
 * A parity bit is inserted at position 0 and at every position N where N is a power of 2.
 * Parity bits are used to make the total number of '1' bits in a given set of data even.
 * The parity bit at position 0 considers all bits including parity bits.
 * Each parity bit at position 2^N alternately considers 2^N bits then ignores 2^N bits, starting at position 2^N.
 * The endianness of the parity bits is reversed compared to the endianness of the data bits:
 * Data bits are encoded most significant bit first and the parity bits encoded least significant bit first.
 * The parity bit at position 0 is set last.
 *
 * @example 8 in binary is 1000, and encodes to 11110000 (pppdpddd - where p is a parity bit and d is a data bit)
 * @example 21 in binary is 10101, and encodes to 1001101011 (pppdpdddpd)
 *
 * For more information on the 'rule' of encoding, refer to Wikipedia (https://wikipedia.org/wiki/Hamming_code) or the
 * 3Blue1Brown videos on Hamming Codes. (https://youtube.com/watch?v=X8jsijhllIA)
 */
function hamming_encode(data: unknown) {
  if (typeof(data) !== 'number') {
    throw new Error('Expected number, received ' + JSON.stringify(data) + ' ' + typeof data);
  }
  const value = data as number;

  const encoded = [0];
  let parity = 0;
  // Stream the data bits, most significant bits first
  for (const bit_char of value.toString(2)) {
    const bit = bit_char === '1' ? 1 : 0;
    // Insert a parity bit where required
    while ((encoded.length & (encoded.length - 1)) === 0) {
      encoded.push(0);
    }
    if (bit) {
      parity ^= encoded.length;
    }
    encoded.push(bit);
  }

  // Set parity bits, least significant bits first
  for (let i = 1; i < encoded.length; i <<= 1) {
    encoded[i] = parity & 1;
    parity >>= 1;
  }

  // Set the overall parity bit
  encoded[0] = encoded.reduce((a, b) => a + b) & 1;

  return encoded.join('');
}

function test_hamming_encode(ns: NS) {
  // Test cases for hamming_encode
  const testCases = [
    { input: 8, expected: '11110000' },
    { input: 21, expected: '1001101011' },
  ];

  for (const { input, expected } of testCases) {
    const actual = hamming_encode(input);
    assert_eq(ns, expected, actual, `hamming(${JSON.stringify(input)})`);
  }
}
