
type CCTSolver =
  (data: any) => string | number | any[];

const known_ccts = new Map<string, CCTSolver>([
  ["Algorithmic Stock Trader II", algo_stock_2],
  ["Encryption I: Caesar Cipher", caesar_cipher_1],
  ["Unique Paths in a Grid I", unique_grid_paths_1]
])

function algo_stock_2(data: any) {
  const prices: number[] = data;
  // Determine maximum potential profit from holding up to one share at a time
  let profit = 0;
  if (!prices.length) {
    return 0;
  }
  let last: number = prices[0];
  for (const current of prices.slice(1)) {
    if (current > last) {
      profit += current - last;
    }
    last = current;
  }
  return profit;
}

function algo_stock_3(data: any) {
  const prices: number[] = data;
  // Determine maximum potential profit from holding up to one share at a time for up to two runs
  let profit = 0;
  if (!prices.length) {
    return 0;
  }
  let last: number = prices[0];
  for (const current of prices.slice(1)) {
    if (current > last) {
      profit += current - last;
    }
    last = current;
  }
  return profit;
}

function caesar_cipher_1(data: any) {
  // First element is plaintext, second element is left shift value.
  const [plaintext, left_shift]: [string, number] = data;
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

function unique_grid_paths_1(data: any) {
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
  const [w, h]: [number, number] = data;
  const long = Math.max(w, h) - 1;
  const short = Math.min(w, h) - 1;
  const ways = pascals_triangle(long + short, short);
  return ways;
}

function print_desc(ns: NS, filename: string, host: string | undefined, cct_type: string, data: any) {
  const desc = ns.codingcontract.getDescription(filename, host);
  ns.tprint(filename, " [", cct_type, "] @ ", host, ": ", data, '.');
  ns.tprint(desc);
}

async function attempt_cct(ns: NS, filename: string, host: string | undefined) {
  const cct_type = ns.codingcontract.getContractType(filename, host);
  const data = ns.codingcontract.getData(filename, host);
  if (ns.args.indexOf('--desc') !== -1) {
    print_desc(ns, filename, host, cct_type, data);
  }
  if (!known_ccts.has(cct_type)) {
    ns.tprint("Warning: Unknown coding contract \"", cct_type, "\" in ", filename, ' @ ', host, '; ignoring.');
    if (ns.args.indexOf('--desc-unknown') !== -1) {
      print_desc(ns, filename, host, cct_type, data);
    }
    return;
  }
  const answer = known_ccts.get(cct_type)!(data);
  const remaining = ns.codingcontract.getNumTriesRemaining(filename, host);
  if (ns.args.indexOf('--live') !== -1) {
    if (remaining < 3 && ns.args.indexOf('--force') === -1) {
      ns.tprint("Warning: Coding contract ", filename, " [", cct_type, "] @ ", host, ' has fewer than 3 tries (', remaining, ') remaining, not continuing without a --force.');
      ns.tprint("Would submit: ", filename, " [", cct_type, "] @ ", host, ": ", data, ' -> ', answer);
      return;
    }
    const result = ns.codingcontract.attempt(answer, filename, host);
    if (!result) {
      ns.tprint('CCT FAIL: ', filename, " [", cct_type, "] @ ", host, ": ", data, ' -> ', answer);
    } else {
      ns.tprint('CCT OK (', result, '): ', filename, " [", cct_type, "] @ ", host, ": ", data, ' -> ', answer)
    }
  } else {
    ns.tprint(filename, " [", cct_type, "] @ ", host, ": ", data, ' -> ', answer);
  }
}


async function find_servers(ns: NS) {
  // Traverse the network
  const seen: Set<string> = new Set();
  const home: Server = ns.getServer('home')
  const to_visit: Array<Server> = [home];
  while (to_visit.length > 0) {
    const s: Server = to_visit.pop()!;
    if (seen.has(s.hostname)) {
      continue;
    }
    seen.add(s.hostname);
    for (const adj_name of ns.scan(s.hostname)) {
      if (seen.has(adj_name)) {
        continue;
      }
      to_visit.push(ns.getServer(adj_name));
    }
  }

  // Work out which servers we can use to run scripts on
  const servers: Array<Server> = [...seen.values()].map(ns.getServer);
  return servers;
}

async function find_all_ccts(ns: NS) {
  const servers = (await find_servers(ns));

  const all_ccts = new Array<[string, string]>();
  for (const s of servers) {
    const files: Array<string> = ns.ls(s.hostname);
    for (const f of files) {
      if (!f.endsWith('.cct')) {
        continue;
      }
      all_ccts.push([f, s.hostname]);
    }
  }

  return all_ccts;
}


export async function main(ns: NS): Promise<void> {
  if (ns.args.length > 1 && !String(ns.args[0]).startsWith('-')) { 
    const filename = String(ns.args[0]);
    const host = String(ns.args[1]);
    await attempt_cct(ns, filename, host);
  } else {
    const all_ccts = await find_all_ccts(ns);
    for (const [filename, host] of all_ccts) {
      await attempt_cct(ns, filename, host);
    }
  }
}