import { NS } from '@ns'

// Simple serialization wrapper around JSON.stringify and JSON.parse to handle types which are not natively supported

export function encode_data(data: any): string {
  return JSON.stringify(data, (key: string, value: any) => {
    if (value instanceof Map) {
      return {
        '@@constructor@@': 'Map',
        data: [...value.entries()]
      }
    }
    if (typeof value === 'bigint') {
      return {
        '@@constructor@@': 'BigInt',
        data: value.toString()
      }
    }
    if (typeof value === 'undefined') {
      return {
        '@@constructor@@': 'undefined',
        data: 'undefined'
      }
    }
    return value;
  });
}

export function decode_data(data: string): any {
  return JSON.parse(data, (key: string, value: any) => {
    switch (value['@@constructor@@']) {
      case 'Map':
        return new Map(value.data);
      case 'BigInt':
        return BigInt(value.data);
      case 'undefined':
        return undefined;
      default:
        return value;
    }
  });
}

export async function main(ns: NS): Promise<void> {
  const original = {
    foo: new Map([[1, 2], [3, 4]]),
    bar: BigInt(12345678901234567890n)
  };
  const encoded = encode_data(original);
  console.log('Encoded:', encoded);
  const expected = '{"foo":{"@@constructor@@":"Map","data":[[1,2],[3,4]]},"bar":{"@@constructor@@":"BigInt","data":"12345678901234567890"}}';
  if (encoded !== expected) {
    ns.tprint('ERROR Expected encoded to be', expected, 'but got', encoded);
  }
  const result = decode_data(expected);
  console.log('Result:', result);
}
