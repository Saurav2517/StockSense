import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ops from '../services/operation.service';

export const useOperations = (filters) =>
  useQuery({ queryKey: ['operations', filters ?? {}], queryFn: () => ops.listOperations(filters), placeholderData: (prev) => prev });

export const useOperation = (type, id) =>
  useQuery({ queryKey: ['operation', type, id], queryFn: () => ops.getOperation(type, id), enabled: Boolean(type && id) });

/**
 * Every stock-changing action invalidates everything: inventory, KPIs, move
 * history and operation lists all depend on the same database state.
 */
function useStockMutation(mutationFn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => qc.invalidateQueries() });
}

export const useCreateOperation = (type) => useStockMutation((payload) => ops.createOperation(type, payload));
export const useUpdateOperation = (type) => useStockMutation(({ id, payload }) => ops.updateOperation(type, id, payload));
export const useMarkReady = (type) => useStockMutation((id) => ops.markReady(type, id));
export const useValidateOperation = (type) => useStockMutation((id) => ops.validateOperation(type, id));
export const useCancelOperation = (type) => useStockMutation((id) => ops.cancelOperation(type, id));
export const useDeliveryProgress = () => useStockMutation(({ id, stage }) => ops.setDeliveryProgress(id, stage));
