import { supabase, unwrap } from '../lib/supabase';

/** Stock by product × location (v_stock). */
export async function listStock({ warehouseId = '', locationId = '', categoryId = '', productId = '', search = '', onlyPositive = true } = {}) {
  let q = supabase.from('v_stock').select('*').order('product_name').order('warehouse_code').order('location_name');
  if (warehouseId) q = q.eq('warehouse_id', warehouseId);
  if (locationId) q = q.eq('location_id', locationId);
  if (categoryId) q = q.eq('category_id', categoryId);
  if (productId) q = q.eq('product_id', productId);
  if (onlyPositive) q = q.gt('quantity', 0);
  if (search.trim()) {
    const s = search.trim().replace(/[%,()]/g, ' ');
    q = q.or(`product_name.ilike.%${s}%,sku.ilike.%${s}%`);
  }
  return unwrap(q);
}

/** Free-to-use quantity per product at one location — used by operation forms. */
export async function stockAtLocation(locationId) {
  if (!locationId) return {};
  const rows = await unwrap(
    supabase.from('v_stock').select('product_id,quantity,reserved_quantity,free_to_use').eq('location_id', locationId)
  );
  return Object.fromEntries(rows.map((r) => [r.product_id, r]));
}

/** Move History (v_move_history). */
export async function listMoveHistory({
  movementType = '',
  warehouseId = '',
  locationId = '',
  productId = '',
  search = '',
  dateFrom = '',
  dateTo = '',
  limit = 500,
} = {}) {
  let q = supabase.from('v_move_history').select('*').order('created_at', { ascending: false }).limit(limit);
  if (movementType) q = q.eq('movement_type', movementType);
  if (warehouseId) q = q.or(`from_warehouse_id.eq.${warehouseId},to_warehouse_id.eq.${warehouseId}`);
  if (locationId) q = q.or(`from_location_id.eq.${locationId},to_location_id.eq.${locationId}`);
  if (productId) q = q.eq('product_id', productId);
  if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString());
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    q = q.lte('created_at', end.toISOString());
  }
  if (search.trim()) {
    const s = search.trim().replace(/[%,()]/g, ' ');
    q = q.or(`reference.ilike.%${s}%,contact_name.ilike.%${s}%,product_name.ilike.%${s}%,sku.ilike.%${s}%`);
  }
  return unwrap(q);
}

/** Dashboard KPIs — computed in the database (never hardcoded). */
export async function getDashboardKpis({ warehouseId = '', categoryId = '' } = {}) {
  return unwrap(
    supabase.rpc('dashboard_kpis', {
      p_warehouse_id: warehouseId || null,
      p_category_id: categoryId || null,
    })
  );
}

/** Products at or below their reorder level (alerts). */
export async function listLowStock({ limit = 8 } = {}) {
  return unwrap(
    supabase
      .from('v_product_stock')
      .select('*')
      .eq('is_active', true)
      .in('stock_status', ['LOW_STOCK', 'OUT_OF_STOCK'])
      .order('on_hand', { ascending: true })
      .limit(limit)
  );
}
