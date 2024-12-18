import { autocomplete_func, ccts_main, CCTSolver } from './interface';

export const autocomplete = autocomplete_func;

import { contracts as algo_stock_contracts } from './algo_stock';
import { contracts as caesar_contracts } from './caesar';
import { contracts as prime_contracts } from './prime';
import { contracts as unique_path_grid_contracts } from './unique_path_grid';

export const contracts = new Map<string, CCTSolver>([
  ...algo_stock_contracts,
  ...caesar_contracts,
  ...prime_contracts,
  ...unique_path_grid_contracts,
]);

export const main = ccts_main(contracts);
