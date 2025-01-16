import { AutocompleteData, NS } from '@ns'
import { Colors, colors, format_number, format_servername, nop_colors, percent, print_table } from '/lib/colors';
import { format_currency } from '/lib/format-money';
import { sanitize_for_xpath, xpath_all } from '/lib/xpath';
import { format_duration } from '/lib/format-duration';

// Simple stock management script
// Buy stocks with a high price forecast, mark bought stocks for growth by the management script, sell them when the
// outlook changes
// Note that this is a very conservative strategy. The stocks most likely to grow are not necessarily those that will
// grow the most, and this script will not take advantage of the most profitable opportunities. It is currently
// designed to prioritize safety and reliability, rather than maximizing expected value.
// This could be changed with additional logic to sort by a fitness function which also examines volatility, and
// prioritizes EV as the ratio of growth to loss odds multiplied by volatility.

// Thresholds for when precise 4S API information is available
// Buy if there's a 55% chance of growth
const precise_buy_threshold = 0.55;
// Sell if the chance of growth drops below 52%
const precise_sell_threshold = 0.52;
// Thresholds for when we're having to guess from the UI, and the values returned will be in steps of 10 percentage
// points - 0.35, 0.45, 0.55, 0.65, etc
// Buy at ++ or better
const fuzzy_buy_threshold = 0.64;
// Sell at + or worse
const fuzzy_sell_threshold = 0.56;
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

let last_successful_scrape = 0;
let last_failed_scrape_warning = 0;
// Warn the user about failed scrapes at most one per minute
const failed_scrapes_warning_frequency = 60e3;
// If we hit no scrapes for a full minute, warn the user
const failed_scrapes_warning_threshold = 60e3;

function scrape_4s(ns: NS, symbol: string, warn_on_failed_scrapes: boolean): [number?, number?] {
  // Scrape the stock market tab for the symbol's information
  // The resultant forecast is imprecise, and this only works when the tab is opened
  // Find a p element which contains the symbol in the text, and has a div element of class MuiListItemText-root as an ancestor
  const cls = 'MuiListItemText-root';
  const candidate_elements = xpath_all(`//p[contains(text(), ' ${sanitize_for_xpath(symbol)} ')][ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' ${sanitize_for_xpath(cls)} ')]]`);
  for (const candidate of candidate_elements) {
    const text = candidate.textContent;
    console.log('Candidate for symbol', symbol, candidate, text);
    if (text === null) {
      continue;
    }
    const forecast_match = /Price Forecast: ([+-]+)/.exec(text);
    const volatility_match = /Volatility: ([0-9.]+)%/.exec(text);
    if (forecast_match === null || volatility_match === null) {
      continue;
    }
    const volatility = parseFloat(volatility_match[1]) / 100;
    // Forecast is in increments of 10 percentage points above or below 50%
    // Without full API access, we can only approximate this as + ~55%, ++ being ~65%, and - being ~45%, -- being 35%, etc.
    const forecast = (forecast_match[1][0] === '+' ? 45 + forecast_match[1].length * 10 : 55 - forecast_match[1].length * 10) / 100;
    last_successful_scrape = Date.now();
    return [forecast, volatility];
  }
  const now = Date.now();
  if (warn_on_failed_scrapes && now > last_successful_scrape + failed_scrapes_warning_threshold && now > last_failed_scrape_warning + failed_scrapes_warning_frequency) {
    const message = (colors: Colors, colorize: boolean) => `Repeatedly ${colors.fg_red}failed${colors.reset} to scrape stock market tab for stock information. Last update ${format_duration(now - last_successful_scrape, { abs_threshold: -1, colorize })} ago. Switch tab to ${colors.fg_cyan}Stock Market${colors.reset} ASAP to avoid loss.`;
    // Market inversions happen frequently, so pop up a long duration warning toast as well
    ns.tprint(`WARNING ${message(colors, true)}`);
    ns.toast(`${message(nop_colors, false)}`, ns.enums.ToastVariant.WARNING, 50e3);
    last_failed_scrape_warning = now;
  }
  return [undefined, undefined];
}

export function get_stock_info(ns: NS, warn_on_failed_scrapes=true): StockInfo[] {
  const symbols = ns.stock.getSymbols();
  const stocks: StockInfo[] = [];
  const has_4s = ns.stock.has4SData();
  const has_4s_api = has_4s && ns.stock.has4SDataTIXAPI();
  for (const symbol of symbols) {
    const [forecast, volatility] = has_4s_api
      // Use precise values when available
      ? [ns.stock.getForecast(symbol), ns.stock.getVolatility(symbol)]
      : has_4s
        // Otherwise, try to guess whenever the user has the stock page open
        ? scrape_4s(ns, symbol, warn_on_failed_scrapes)
        : [undefined, undefined];
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
  ns.tprint(`Selling ${format_number(amount)} shares of ${format_servername(symbol)} for ${format_currency(bid_price * amount)} at ${format_currency(bid_price)} each (actual: ${format_currency(actual_sell_price)} each), realizing a ${format_currency(amount * (bid_price - long_basis))} ${long_basis < bid_price ? `${bright_green}profit${colors.reset}` : `${colors.fg_red}loss${colors.reset}`}`);
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
  const has_4s = ns.stock.has4SData();
  const has_4s_api = ns.stock.has4SDataTIXAPI();
  const forecast_sorter = (a: StockInfo, b: StockInfo) => (b.forecast ?? 0.5) - (a.forecast ?? 0.5);

  // Block immediate warnings
  last_successful_scrape = Date.now();
  last_failed_scrape_warning = 0;

  if (ns.args.includes('--info')) {
    // Give the user a chance to switch to the stock market tab to scrape the forecast/volatility
    if (!has_4s_api) {
      const wait = 3000;
      ns.tprint(`Switch tab to ${colors.fg_cyan}Stock Market${colors.reset} to scrape forecast/volatility. Waiting ${format_duration(wait)}...`);
      await ns.asleep(wait);
    }
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
        ns.tprintf("%s %s: %s fcst; %s%s voli; %s market cap; %s %s; %s ask, %s bid, %s max shares%s%s%s%s%s%s%s%s",
          format_servername(symbol.org),
          format_servername(symbol.symbol),
          symbol.forecast === undefined ? `${colors.fg_red}???${colors.reset}` : format_number(symbol.forecast, { round: 2 }),
          symbol.volatility === undefined ? `${colors.fg_red}???${colors.reset}` : format_number(symbol.volatility * 100, { round: 2 }),
          percent,
          format_currency(symbol.ask_price * symbol.maxShares),
          symbol.long || symbol.short ? format_currency(symbol.long * symbol.bid_price - symbol.short * symbol.ask_price) : `${colors.fg_black}-${colors.reset}`,
          symbol.long
            ? symbol.short
              ? `${bright_red}BOTH!?${colors.reset}`
              : `${colors.fg_cyan}LONG${colors.reset}`
            : symbol.short
              ? `${colors.fg_magenta}SHORT${colors.reset}`
              : `${colors.fg_black}-${colors.reset}`,
          format_currency(symbol.ask_price),
          format_currency(symbol.bid_price),
          format_number(symbol.maxShares),
          symbol.long ? `; ${format_number(symbol.long)}` : '',
          symbol.long ? " long, " : '',
          symbol.long ? format_currency(symbol.long_basis) : '',
          symbol.long ? " long basis" : '',
          symbol.short ? `; ${format_number(symbol.short)}` : '',
          symbol.short ? " short, " : '',
          symbol.short ? format_currency(symbol.short_basis) : '',
          symbol.short ? " short basis" : '',
        );
        sum_holdings += symbol.long * symbol.bid_price;
        sum_holdings += symbol.short * symbol.ask_price;
        sum_basis += symbol.long * symbol.long_basis;
        sum_basis += symbol.short * symbol.short_basis;
      }
    });
    if (sum_holdings !== 0) {
      ns.tprint(`Total cost basis value:  ${format_currency(sum_basis)}`);
      ns.tprint(`Total value of holdings: ${format_currency(sum_holdings)}`);
    }
    ns.tprint(`Total market cap: ${format_currency(symbols.reduce((acc, stock) => acc + stock.ask_price * stock.maxShares, 0))}`);
    return;
  }
  if (!has_4s) {
    ns.tprint('This script requires 4S data to run, please install the 4S Market Data TIX API');
    return;
  }
  const [buy_threshold, sell_threshold] = has_4s_api
    ? [precise_buy_threshold, precise_sell_threshold]
    : [fuzzy_buy_threshold, fuzzy_sell_threshold];

  if (!has_4s_api) {
    ns.tprint(`WARNING 4S API data is not available! Running in ${colors.fg_white}UI scraping mode${colors.reset}. Please leave the tab on ${colors.fg_cyan}Stock Market${colors.reset} as much as possible.`);
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
        continue;
      }
      const actual_price = ns.stock.buyStock(symbol.symbol, shares);
      const spent = shares * actual_price;
      ns.tprint(`Buying ${format_number(shares)} shares of ${format_servername(symbol.symbol)} for ${format_currency(symbol.ask_price * shares)} at ${format_currency(symbol.ask_price)} each (actual: ${format_currency(actual_price)} each), capped by ${shares === player_buyable ? shares === market_available ? 'both money and available shares' : 'player money' : 'available shares'}`);
      value_in_shares += spent;
      player_money -= spent;
    }
  }
}
