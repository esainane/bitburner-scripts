export async function main(ns: NS): Promise<void> {
  const spec = Number(ns.args[0])
  const currencyFormat = Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format;
  ns.tprint(`${2**spec}GB:`, currencyFormat(ns.getPurchasedServerCost(2**spec)));
  if (ns.args[1] == '-f') {
    ns.purchaseServer(`s-${ns.getPurchasedServers().length}-${spec}`, 2**spec);
  }
}