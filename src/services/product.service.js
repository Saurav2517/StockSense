import { supabase, unwrap } from '../lib/supabase';

// ---------------- categories ----------------
export async function listCategories() {
  return unwrap(supabase.from('categories').select('*').order('name'));
}
export async function createCategory(values) {
  return unwrap(supabase.from('categories').insert(values).select('*').single());
}
export async function updateCategory(id, values) {
  return unwrap(supabase.from('categories').update(values).eq('id', id).select('*').single());
}
export async function deleteCategory(id) {
  return unwrap(supabase.from('categories').delete().eq('id', id));
}

// ---------------- products ----------------
/** Products with aggregated stock (v_product_stock). */
export async function listProductStock({ search = '', categoryId = '', stockStatus = '', includeInactive = false } = {}) {
  let q = supabase.from('v_product_stock').select('*').order('name');
  if (!includeInactive) q = q.eq('is_active', true);
  if (categoryId) q = q.eq('category_id', categoryId);
  if (stockStatus) q = q.eq('stock_status', stockStatus);
  if (search.trim()) {
    const s = search.trim().replace(/[%,()]/g, ' ');
    q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%`);
  }
  return unwrap(q);
}

export async function listProducts({ activeOnly = true } = {}) {
  let q = supabase.from('products').select('id,sku,name,unit_of_measure,unit_cost,reorder_level,category_id,is_active').order('name');
  if (activeOnly) q = q.eq('is_active', true);
  return unwrap(q);
}

export async function getProduct(id) {
  return unwrap(supabase.from('v_product_stock').select('*').eq('product_id', id).single());
}

export async function createProduct(values) {
  return unwrap(supabase.from('products').insert(values).select('*').single());
}

export async function updateProduct(id, values) {
  return unwrap(supabase.from('products').update(values).eq('id', id).select('*').single());
}

/**
 * Initial stock is an auto-validated Inventory Adjustment (DataBase.md §5),
 * so it is auditable in Move History. Returns the adjustment id.
 */
export async function initProductStock({ productId, locationId, quantity, reason = 'Initial stock' }) {
  return unwrap(
    supabase.rpc('init_product_stock', {
      p_product_id: productId,
      p_location_id: locationId,
      p_quantity: quantity,
      p_reason: reason,
    })
  );
}
