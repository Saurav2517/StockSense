import { supabase, unwrap } from '../lib/supabase';

const TABLES = { supplier: 'suppliers', customer: 'customers' };

function table(entity) {
  const t = TABLES[entity];
  if (!t) throw new Error(`Unknown contact entity: ${entity}`);
  return t;
}

export async function listContacts(entity) {
  return unwrap(supabase.from(table(entity)).select('*').order('name'));
}
export async function createContact(entity, values) {
  return unwrap(supabase.from(table(entity)).insert(values).select('*').single());
}
export async function updateContact(entity, id, values) {
  return unwrap(supabase.from(table(entity)).update(values).eq('id', id).select('*').single());
}
export async function deleteContact(entity, id) {
  return unwrap(supabase.from(table(entity)).delete().eq('id', id));
}
