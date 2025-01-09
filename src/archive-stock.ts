
import { NS } from "@ns"
import { get_stock_info } from "/wse";
import { mkfifo } from "/lib/mkfifo";


/**
 * Stock archiver
 *
 * This tracks stock movements over time, saving history to a file an making the data available to other scripts.
 *
 * Other scripts can either read the data from data_filename directly, or obtain a structured lightweight copy through
 * the ports system.
 *
 * A helper with_history generator is provided to simplify reading the data from the ports system. It can assume flow
 * control and yield the complete updated history every time it is updated:
 *
 * ```typescript
 * import { with_history } from '/archive-stock';
 *
 * export async function main(ns: NS): Promise<void> {
 *   for await (const history of with_history(ns)) {
 *     // Do something with the history
 *   }
 * }
 * ```
 *
 * This allows uninterrupted archival of price movements as other scripts are developed and restarted.
 */

const data_filename = 'data/stock_history.json';
const data_sock = 'data/stock_sock.txt';
export const ring_buffer_size = 225;

export interface SymbolTimeSeries {
  symbol: string;
  // Ring buffers of prices
  ask: number[];
  bid : number[];
}

export interface SymbolHistory {
  // Ring buffer index
  index: number;
  data: Map<string, SymbolTimeSeries>;
}

export async function* with_history(ns: NS): AsyncGenerator<SymbolHistory> {
  while (!ns.fileExists(data_sock)) {
    await ns.asleep(1000);
  }
  const sock_id = parseInt(ns.read(data_sock));
  const handle = ns.getPortHandle(sock_id);

  if (handle.empty()) {
    await handle.nextWrite();
  }
  while (true) {
    yield handle.peek() as SymbolHistory;
    await handle.nextWrite();
  }
}

export function load_history(data: string): SymbolHistory {
  const obj = JSON.parse(data);
  return {
    index: obj.index,
    data: new Map(obj.data),
  }
}

export function save_history(obj: SymbolHistory): string {
  return JSON.stringify({
    index: obj.index,
    data: [...obj.data.entries()],
  });
}

export async function main(ns: NS): Promise<void> {
  // Load prior history if available
  const history: SymbolHistory = ns.fileExists(data_filename)
    ? load_history(ns.read(data_filename))
    : {index: 0, data: new Map()};
  // Reuse a previously allocated port if available, otherwise create a new one
  const sock_id = ns.fileExists(data_sock)
    ? parseInt(ns.read(data_sock))
    : mkfifo(ns);
  // Make sure we reuse this ID going forward
  ns.write(data_sock, String(sock_id), 'w');
  const handle = ns.getPortHandle(sock_id);
  // Make sure history gets saved at exit
  ns.atExit(() => {
    ns.write(data_filename, save_history(history), 'w');
  });
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Each update, fetch all data, and record the last ask and bid price
    handle.clear();
    const symbols = get_stock_info(ns);
    for (const symbol of symbols) {
      let time_series = history.data.get(symbol.symbol);
      if (!time_series) {
        time_series = {symbol: symbol.symbol, ask: Array(ring_buffer_size), bid: Array(ring_buffer_size)};
        history.data.set(symbol.symbol, time_series);
      }
      time_series.ask[history.index] = symbol.ask_price;
      time_series.bid[history.index] = symbol.bid_price;
    }
    handle.write(history);
    await ns.stock.nextUpdate();
    history.index = (history.index + 1) % ring_buffer_size;
  }
}
