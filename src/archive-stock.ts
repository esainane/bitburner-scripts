
import { NS } from "@ns"
import { get_stock_info } from "/wse";
import { mkfifo } from "/lib/mkfifo";
import { pubsub, PubSubTag } from "/lib/pubsub";


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

const { with_subscription, publisher } = pubsub<SymbolHistory>(PubSubTag.StockHistory);

export const with_history = with_subscription;

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

export async function main(ns: NS): Promise<void> {
  const { atexit, publish, get_value } = publisher(ns, () => ({index: 0, data: new Map()}));
  const history = get_value();
  // Make sure history gets saved at exit
  ns.atExit(atexit);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Each update, fetch all data, and record the last ask and bid price
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
    publish(history);
    await ns.stock.nextUpdate();
    history.index = (history.index + 1) % ring_buffer_size;
  }
}
