import { NS } from '@ns'
import { autocomplete_func, ccts_main, CCTSolver } from './interface';
import { assert_eq, assert_all_passed } from '/lib/assert';

export const autocomplete = autocomplete_func;

export const contracts = new Map<string, CCTSolver>([
  ["Encryption I: Caesar Cipher", { solve: encryption_1, test: test_encryption_1 }],
  ['Encryption II: Vigenère Cipher', { solve: encryption_2, test: test_encryption_2 }]
]);

export const main = ccts_main(contracts);

/**
 * Encryption I: Caesar Cipher
 *
 * Caesar cipher is one of the simplest encryption technique.
 * It is a type of substitution cipher in which each letter in the plaintext
 * is replaced by a letter some fixed number of positions down the alphabet.
 * For example, with a left shift of 3, D would be replaced by A,
 * E would become B, and A would become X (because of rotation).
 * @param data You are given an array with two elements.
 *             The first element is the plaintext, the second element is the left shift value.
 */
function encryption_1(data: unknown) {
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

function test_encryption_1(ns: NS) {
  // Test cases for caesar_cipher_1
  const testCases = [
    { input: ['ABC', 1], expected: 'ZAB' },
    { input: ['XYZ', 1], expected: 'WXY' },
    { input: ['HELLO', 3], expected: 'EBIIL' },
    { input: ['HELLO', 26], expected: 'HELLO' },
    { input: ['HELLO', 27], expected: 'GDKKN' },
  ];

  for (const { input, expected } of testCases) {
    const actual = encryption_1(input);
    assert_eq(ns, expected, actual, `caesar_cipher_1(${JSON.stringify(input)})`);
  }

  assert_all_passed(ns);
}

/**
 * Encryption II: Vigenère Cipher
 *
 * Vigenère cipher is a type of polyalphabetic substitution. It uses  the Vigenère square to encrypt and decrypt plaintext with a keyword.
 *
 * Vigenère square:
 *        A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
 *      +----------------------------------------------------
 *    A | A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
 *    B | B C D E F G H I J K L M N O P Q R S T U V W X Y Z A
 *    C | C D E F G H I J K L M N O P Q R S T U V W X Y Z A B
 *    D | D E F G H I J K L M N O P Q R S T U V W X Y Z A B C
 *    E | E F G H I J K L M N O P Q R S T U V W X Y Z A B C D
 *               ...
 *    Y | Y Z A B C D E F G H I J K L M N O P Q R S T U V W X
 *    Z | Z A B C D E F G H I J K L M N O P Q R S T U V W X Y
 *
 * For encryption each letter of the plaintext is paired with the corresponding letter of a repeating keyword.
 * For example, the plaintext DASHBOARD is encrypted with the keyword LINUX:
 *  Plaintext: DASHBOARD
 *  Keyword:   LINUXLINU
 * So, the first letter D is paired with the first letter of the key L. Therefore, row D and column L of the
 * Vigenère square are used to get the first cipher letter O. This must be repeated for the whole ciphertext.
 *
 * @param data You are given an array with two elements:
 *             ["FLASHSHIFTFRAMEMOUSEPRINT", "COMPRESS"]
 *             The first element is the plaintext, the second element is the keyword.
 *
 * @return Return the ciphertext as uppercase string.
 */
function encryption_2(data: unknown) {
  if (!Array.isArray(data) || data.length !== 2 || typeof data[0] !== 'string' || typeof data[1] !== 'string') {
    throw new Error('Expected [string, string], received ' + JSON.stringify(data));
  }
  // First element is plaintext, second element is keyword.
  const [plaintext, keyword] = data as [string, string];
  const base = 'A'.charCodeAt(0);
  const upper = 'Z'.charCodeAt(0);
  let cipher = '';
  for (let i = 0; i < plaintext.length; i++) {
    const val = plaintext.charCodeAt(i);
    if (base <= val && val <= upper) {
      const shift = keyword.charCodeAt(i % keyword.length) - base;
      cipher += String.fromCharCode(((val + shift - base + 26) % 26) + base);
    } else {
      cipher += plaintext[i];
    }
  }
  return cipher;
}

function test_encryption_2(ns: NS) {
  // Test cases for vigenere_cipher
  const testCases = [
    { input: ['DASHBOARD', 'LINUX'], expected: 'OIFBYZIEX' },
    { input: ['FLASHSHIFTFRAMEMOUSEPRINT', 'COMPRESS'], expected: 'HZMHYWZAHHRGRQWEQIETGVAFV' },
  ];

  for (const { input, expected } of testCases) {
    const actual = encryption_2(input);
    assert_eq(ns, expected, actual, `vigenere_cipher(${JSON.stringify(input)})`);
  }
}
