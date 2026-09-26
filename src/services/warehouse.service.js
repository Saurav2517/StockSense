import { supabase, unwrap } from '../lib/supabase';

// ---------------- warehouses ----------------
export async function listWarehouses({ activeOnly = false } = {}) {
  let q = supabase.from('warehouses').select('*').order('code');
  if (activeOnly) q = q.eq('is_active', true);
  return unwrap(q);
}
export async function createWarehouse(values) {
  return unwrap(supabase.from('warehouses').insert(values).select('*').single());
}
export async function updateWarehouse(id, values) {
  return unwrap(supabase.from('warehouses').update(values).eq('id', id).select('*').single());
}

// ---------------- locations ----------------
export async function listLocations({ warehouseId = '', activeOnly = false } = {}) {
  let q = supabase
    .from('locations')
    .select('*, warehouse:warehouses(id,code,name,is_active)')
    .order('code');
  if (warehouseId) q = q.eq('warehouse_id', warehouseId);
  if (activeOnly) q = q.eq('is_active', true);
  return unwrap(q);
}
export async function createLocation(values) {
  return unwrap(supabase.from('locations').insert(values).select('*').single());
}
export async function updateLocation(id, values) {
  return unwrap(supabase.from('locations').update(values).eq('id', id).select('*').single());
}
