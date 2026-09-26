import { supabase, unwrap } from '../lib/supabase';
import { getOperationConfig } from '../utils/operations';

/**
 * Shared data access for Receipts / Deliveries / Transfers / Adjustments.
 * All writes go through the atomic database functions — the frontend never
 * touches inventory or stock_movements directly.
 */

export async function listOperations({
  type = '',
  status = '',
  warehouseId = '',
  locationId = '',
  categoryId = '',
  search = '',
  lateOnly = false,
  upcomingOnly = false,
  limit = 300,
} = {}) {
  let q = supabase.from('v_operations').select('*').order('created_at', { ascending: false }).limit(limit);
  if (type) q = q.eq('operation_type', type);
  if (status) q = q.eq('status', status);
  if (warehouseId) q = q.eq('warehouse_id', warehouseId);
  if (locationId) q = q.or(`location_id.eq.${locationId},destination_location_id.eq.${locationId}`);
  if (categoryId) q = q.contains('category_ids', [categoryId]);
  if (lateOnly) q = q.eq('is_late', true);
  if (upcomingOnly) q = q.in('status', ['DRAFT', 'WAITING', 'READY']).gte('schedule_date', new Date().toISOString());
  if (search.trim()) {
    const s = search.trim().replace(/[%,()]/g, ' ');
    q = q.or(`reference.ilike.%${s}%,contact_name.ilike.%${s}%,note.ilike.%${s}%`);
  }
  return unwrap(q);
}

export async function getOperation(type, id) {
  const cfg = getOperationConfig(type);
  return unwrap(supabase.from(cfg.table).select(cfg.select).eq('id', id).single());
}

export async function createOperation(type, payload) {
  const cfg = getOperationConfig(type);
  return unwrap(supabase.rpc(cfg.rpc.create, { payload }));
}

export async function updateOperation(type, id, payload) {
  const cfg = getOperationConfig(type);
  return unwrap(supabase.rpc(cfg.rpc.update, { p_id: id, payload }));
}

export async function markReady(type, id) {
  return unwrap(supabase.rpc('mark_ready', { p_operation_type: type, p_id: id }));
}

export async function validateOperation(type, id) {
  const cfg = getOperationConfig(type);
  return unwrap(supabase.rpc(cfg.rpc.validate, { p_id: id }));
}

export async function cancelOperation(type, id) {
  return unwrap(supabase.rpc('cancel_operation', { p_operation_type: type, p_id: id }));
}

export async function setDeliveryProgress(id, stage) {
  return unwrap(supabase.rpc('set_delivery_lines_progress', { p_id: id, p_stage: stage }));
}
