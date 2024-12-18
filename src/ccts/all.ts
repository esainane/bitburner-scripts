import { NS } from '@ns'

import { CCTSolver } from './interface';

import { contracts as algo_stock_contracts } from './algo_stock';
import { contracts as caesar_contracts } from './caesar';
import { contracts as unique_path_grid_contracts } from './unique_path_grid';

export const contracts = new Map<string, CCTSolver>([
  ...algo_stock_contracts,
  ...caesar_contracts,
  ...unique_path_grid_contracts,
]);
