import { NS } from '@ns'

export const currency_format = Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format;

export async function main(ns: NS): Promise<void> {
  ns.tprint(currency_format(Number(ns.args[0])));
}
