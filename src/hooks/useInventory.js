import { useQuery } from '@tanstack/react-query';
import * as inventoryService from '../services/inventory.service';

export const useStock = (filters) =>
  useQuery({ queryKey: ['stock', filters ?? {}], queryFn: () => inventoryService.listStock(filters), placeholderData: (prev) => prev });

export const useStockAtLocation = (locationId) =>
  useQuery({ queryKey: ['stock-at', locationId], queryFn: () => inventoryService.stockAtLocation(locationId), enabled: Boolean(locationId) });

export const useMoveHistory = (filters) =>
  useQuery({ queryKey: ['move-history', filters ?? {}], queryFn: () => inventoryService.listMoveHistory(filters), placeholderData: (prev) => prev });

export const useDashboardKpis = (filters) =>
  useQuery({ queryKey: ['kpis', filters ?? {}], queryFn: () => inventoryService.getDashboardKpis(filters), placeholderData: (prev) => prev });

export const useLowStock = (opts) => useQuery({ queryKey: ['low-stock', opts ?? {}], queryFn: () => inventoryService.listLowStock(opts) });
