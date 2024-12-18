import { NS } from '@ns'
import { CCTSolver } from './interface';

export const contracts = new Map<string, CCTSolver>([
  ["Encryption I: Caesar Cipher", caesar_cipher_1]
]);

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

export async function main(ns: NS): Promise<void> {
  //
}
