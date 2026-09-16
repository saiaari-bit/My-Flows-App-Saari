import { createContext, useContext } from 'react';

import { createCdfOperationsService } from '../services/CdfOperationsService';
import type { CdfHttp, OperationsService } from '../services/operationsService';

export type OperationsViewModelDeps = {
  createService: (http: CdfHttp) => OperationsService;
  nowMs: () => number;
};

export const defaultOperationsDeps: OperationsViewModelDeps = {
  createService: createCdfOperationsService,
  nowMs: () => Date.now(),
};

export type OperationsViewModelContextType = OperationsViewModelDeps;

export const OperationsViewModelContext = createContext<OperationsViewModelContextType>(
  defaultOperationsDeps,
);

export function useOperationsDeps(): OperationsViewModelDeps {
  return useContext(OperationsViewModelContext);
}
