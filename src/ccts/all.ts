import { autocomplete_func, ccts_main, CCTSolver } from './interface';

export const autocomplete = autocomplete_func;

import { contracts as algo_stock_contracts } from './algo_stock';
import { contracts as encryption_contracts } from './encryption';
import { contracts as compression_contracts } from './compression';
import { contracts as misc_contracts } from './misc';
import { contracts as prime_contracts } from './prime';
import { contracts as path_grid_contracts } from './path_grid';

export const contracts = new Map<string, CCTSolver>([
  ...algo_stock_contracts,
  ...compression_contracts,
  ...encryption_contracts,
  ...misc_contracts,
  ...prime_contracts,
  ...path_grid_contracts,
]);

export const main = ccts_main(contracts);
