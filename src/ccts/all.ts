import { autocomplete_func, ccts_main, CCTSolver } from './interface';

export const autocomplete = autocomplete_func;

import { contracts as algo_stock_contracts } from './algo_stock';
import { contracts as caesar_contracts } from './caesar';
import { contracts as sum_contracts } from './sum';
import { contracts as prime_contracts } from './prime';
import { contracts as path_grid_contracts } from './path_grid';

export const contracts = new Map<string, CCTSolver>([
  ...algo_stock_contracts,
  ...caesar_contracts,
  ...sum_contracts,
  ...prime_contracts,
  ...path_grid_contracts,
]);

export const main = ccts_main(contracts);
