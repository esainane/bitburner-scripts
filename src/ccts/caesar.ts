import { NS } from '@ns'
import { autocomplete_func, ccts_main, CCTSolver } from './interface';
import { assert_eq, assert_all_passed } from '/lib/assert';

export const autocomplete = autocomplete_func;

export const contracts = new Map<string, CCTSolver>([
  ["Encryption I: Caesar Cipher", { solve: caesar_cipher_1, test: test_caesar_cipher_1 }],
]);

export const main = ccts_main(contracts);

function caesar_cipher_1(data: unknown) {
  if (!Array.isArray(data) || data.length !== 2 || typeof data[0] !== 'string' || typeof data[1] !== 'number') {
    throw new Error('Expected [string, number], received ' + JSON.stringify(data));
  }
  // First element is plaintext, second element is left shift value.
  const [plaintext, left_shift]: [string, number] = data as [string, number];
  let cipher = '';
  const base = 'A'.charCodeAt(0);
  const upper = 'Z'.charCodeAt(0);
  for (const char of plaintext) {
    const val = char.charCodeAt(0);
    if (base <= val && val <= upper) {
      cipher += String.fromCharCode(((val - left_shift - base + 26) % 26) + base);
    } else {
      cipher += char;
    }
  }
  return cipher;
}

function test_caesar_cipher_1(ns: NS) {
  // Test cases for caesar_cipher_1
  const testCases = [
    { input: ['ABC', 1], expected: 'ZAB' },
    { input: ['XYZ', 1], expected: 'WXY' },
    { input: ['HELLO', 3], expected: 'EBIIL' },
    { input: ['HELLO', 26], expected: 'HELLO' },
    { input: ['HELLO', 27], expected: 'GDKKN' },
  ];

  for (const { input, expected } of testCases) {
    const actual = caesar_cipher_1(input);
    assert_eq(ns, expected, actual, `caesar_cipher_1(${JSON.stringify(input)})`);
  }

  assert_all_passed(ns);
}
