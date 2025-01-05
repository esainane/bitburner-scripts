import { AutocompleteData, NS } from '@ns'
import { colors, format_number, format_servername, print_table } from '/lib/colors';
import { currency_format } from '/lib/format-money';

// Simple stock management script
// Buy stocks with a high price forecast, mark bought stocks for growth by the management script, sell them when the
// outlook changes

// Buy if there's a 60% chance of growth
const buy_threshold = 0.55;
// Sell if the chance of growth drops below 52%
const sell_threshold = 0.52;
// Keep some money around for other actions/systems
const max_net_worth_in_shares = 0.8;
// Make sure we don't make lots of tiny transactions and get eaten by fees
const minimum_transaction = 1e8;

export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return ['--sell', '--info'];
}

interface StockInfo {
  symbol: string;
  forecast?: number;
  volatility?: number;
  ask_price: number;
  bid_price: number;
  maxShares: number;
  org: string;
  long: number;
  long_basis: number;
  short: number;
  short_basis: number;
}

function get_stock_info(ns: NS): StockInfo[] {
  const symbols = ns.stock.getSymbols();
  const stocks: StockInfo[] = [];
  const has_4s = ns.stock.has4SDataTIXAPI();
  for (const symbol of symbols) {
    const forecast = has_4s ? ns.stock.getForecast(symbol) : undefined;
    const volatility = has_4s ? ns.stock.getVolatility(symbol) : undefined;
    const ask_price = ns.stock.getAskPrice(symbol);
    const bid_price = ns.stock.getBidPrice(symbol);
    const maxShares = ns.stock.getMaxShares(symbol);
    const org = ns.stock.getOrganization(symbol);
    const [ long, long_basis, short, short_basis ] = ns.stock.getPosition(symbol);
    stocks.push({ symbol, forecast, volatility, ask_price, bid_price, maxShares, org, long, long_basis, short, short_basis });
  }
  return stocks;
}

function peek<T>(arr: T[]): T | undefined {
  if (arr.length === 0) {
    return undefined;
  }
  return arr[arr.length - 1];
}

const bright_green = colors.combine(colors.bright, colors.fg_green);
const bright_red = colors.combine(colors.bright, colors.fg_red);

function print_sell(ns: NS, amount: number, symbol: string, bid_price: number, actual_sell_price: number, long_basis: number): void {
  ns.tprint(`Selling ${format_number(amount)} shares of ${format_servername(symbol)} for ${currency_format(bid_price * amount)} at ${currency_format(bid_price)} each (actual: ${currency_format(actual_sell_price)} each), realizing a ${currency_format(amount * (bid_price - long_basis))} ${long_basis < bid_price ? `${bright_green}profit${colors.reset}` : `${colors.fg_red}loss${colors.reset}`}`);
}

export async function main(ns: NS): Promise<void> {
  if (ns.args.includes('--sell')) {
    // Sell everything and kill off other instances
    const symbols = get_stock_info(ns);
    for (const symbol of symbols) {
      if (symbol.long > 0) {
        const actual_sell_price = ns.stock.sellStock(symbol.symbol, symbol.long);
        print_sell(ns, symbol.long, symbol.symbol, symbol.bid_price, actual_sell_price, symbol.long_basis);
      }
    }
    ns.scriptKill(ns.getScriptName(), 'home');
    ns.tprint('Why am I still alive?');
    return;
  }
  const has_4s = ns.stock.has4SDataTIXAPI();
  // Only valid to call when has_4s is true
  const forecast_sorter = (a: StockInfo, b: StockInfo) => b.forecast! - a.forecast!;
  if (ns.args.includes('--info')) {
    // Print out a one-time table of the current state of the market
    const symbols = get_stock_info(ns);
    if (has_4s) {
      symbols.sort(forecast_sorter)
    }
    ns.tprint('Stock info:');
    let sum_holdings = 0;
    let sum_basis = 0;
    print_table(ns, (ns: NS) => {
      for (const symbol of symbols) {
        ns.tprintf("%s %s: %s fcst; %s voli; %s market cap; %s %s; %s ask, %s bid, %s max shares%s%s%s%s%s%s%s%s",
          format_servername(symbol.org),
          format_servername(symbol.symbol),
          symbol.forecast === undefined ? `${colors.fg_red}???${colors.reset}` : format_number(symbol.forecast, { round: 2 }),
          symbol.volatility === undefined ? `${colors.fg_red}???${colors.reset}` : format_number(symbol.volatility, { round: 2 }),
          currency_format(symbol.ask_price * symbol.maxShares),
          symbol.long || symbol.short ? currency_format(symbol.long * symbol.bid_price - symbol.short * symbol.ask_price) : `${colors.fg_black}-${colors.reset}`,
          symbol.long
            ? symbol.short
              ? `${bright_red}BOTH!?${colors.reset}`
              : `${colors.fg_cyan}LONG${colors.reset}`
            : symbol.short
              ? `${colors.fg_magenta}SHORT${colors.reset}`
              : `${colors.fg_black}-${colors.reset}`,
          currency_format(symbol.ask_price),
          currency_format(symbol.bid_price),
          format_number(symbol.maxShares),
          symbol.long ? `; ${format_number(symbol.long)}` : '',
          symbol.long ? " long, " : '',
          symbol.long ? currency_format(symbol.long_basis) : '',
          symbol.long ? " long basis" : '',
          symbol.short ? `; ${format_number(symbol.short)}` : '',
          symbol.short ? " short, " : '',
          symbol.short ? currency_format(symbol.short_basis) : '',
          symbol.short ? " short basis" : '',
        );
        sum_holdings += symbol.long * symbol.bid_price;
        sum_holdings += symbol.short * symbol.ask_price;
        sum_basis += symbol.long * symbol.long_basis;
        sum_basis += symbol.short * symbol.short_basis;
      }
    });
    if (sum_holdings !== 0) {
      ns.tprint(`Total cost basis value:  ${currency_format(sum_basis)}`);
      ns.tprint(`Total value of holdings: ${currency_format(sum_holdings)}`);
    }
    ns.tprint(`Total market cap: ${currency_format(symbols.reduce((acc, stock) => acc + stock.ask_price * stock.maxShares, 0))}`);
    return;
  }
  if (!has_4s) {
    ns.tprint('This script requires 4S data to run, please install the 4S Market Data TIX API');
    return;
  }
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await ns.stock.nextUpdate();
    const symbols = get_stock_info(ns);
    let value_in_shares = symbols.reduce((acc, stock) => acc + stock.long * stock.bid_price, 0);
    symbols.sort(forecast_sorter);
    const real_player_money = ns.getPlayer().money;
    // Calculate how much of the raw money available should be available for stock purposes
    let player_money = Math.max(0, (real_player_money + value_in_shares) * max_net_worth_in_shares - value_in_shares);
    // Start by selling off everything which should be sold
    while ((peek(symbols)?.forecast ?? Infinity) < sell_threshold) {
      const symbol = symbols.pop();
      if (symbol === undefined) {
        throw new Error("Popped symbol for sell-off loop was undefined, this shouldn't happen");
      }
      // Can't sell if we don't own anything
      if (symbol.long <= 0) {
        continue;
      }
      const actual_sell_price = ns.stock.sellStock(symbol.symbol, symbol.long);
      print_sell(ns, symbol.long, symbol.symbol, symbol.bid_price, actual_sell_price, symbol.long_basis);
      value_in_shares -= symbol.long * actual_sell_price;
      player_money += symbol.long * actual_sell_price;
    }
    symbols.reverse();
    // Buy everything which can be bought
    while ((peek(symbols)?.forecast ?? -Infinity) > buy_threshold) {
      const symbol = symbols.pop();
      if (symbol === undefined) {
        throw new Error("Popped symbol for buy loop was undefined, this shouldn't happen");
      }
      // Can't buy if we already own everything
      if (symbol.long >= symbol.maxShares) {
        continue;
      }
      const market_available = symbol.maxShares - symbol.long;
      const player_buyable = Math.floor(player_money / symbol.ask_price);
      const shares = Math.min(market_available, player_buyable);
      // Don't buy if the transaction would be too small
      if (shares * symbol.ask_price < minimum_transaction) {
        break;
      }
      const actual_price = ns.stock.buyStock(symbol.symbol, shares);
      const spent = shares * actual_price;
      ns.tprint(`Buying ${format_number(shares)} shares of ${format_servername(symbol.symbol)} for ${currency_format(symbol.ask_price * shares)} at ${currency_format(symbol.ask_price)} each (actual: ${currency_format(actual_price)} each), capped by ${shares === player_buyable ? shares === market_available ? 'both money and available shares' : 'player money' : 'available shares'}`);
      value_in_shares += spent;
      player_money -= spent;
    }
  }
}
