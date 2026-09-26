import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createFakeSupabase } from './fakeSupabase';
import { createDb, createRpc, session, IDS } from './fixtures';

// One fake client per test; `vi.mock` is hoisted so every module sees the same instance.
const state = { client: null };
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return state.client;
  },
  isSupabaseConfigured: true,
  unwrap: async (promise) => {
    const { data, error } = await promise;
    if (error) throw error;
    return data;
  },
}));

const { renderApp } = await import('./renderApp');

function setup({ signedIn = true } = {}) {
  const db = createDb();
  const rpc = createRpc(db);
  state.client = createFakeSupabase({
    db,
    rpc,
    session: signedIn ? session : null,
    auth: {
      signInWithPassword: async ({ email, password }) =>
        email === 'manager@example.com' && password === 'Passw0rd!x'
          ? { data: { session, user: session.user }, error: null }
          : { data: { session: null, user: null }, error: { message: 'Invalid login credentials' } },
    },
  });
  return { db, rpc, client: state.client };
}

beforeEach(() => {
  state.client = null;
});

describe('authentication', () => {
  it('redirects anonymous users to the login page and rejects bad credentials with the spec message', async () => {
    setup({ signedIn: false });
    renderApp('/dashboard');
    const loginField = await screen.findByLabelText(/login id \/ email/i);
    fireEvent.change(loginField, { target: { value: 'manager1' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Invalid Login ID or Password')).toBeTruthy();
    // Login ID → email lookup went through the anon RPC
    expect(state.client.__rpcCalls.find((c) => c.name === 'email_for_login_id')?.args).toEqual({ p_login_id: 'manager1' });
  });

  it('signs in with a Login ID (resolved to email server-side) and lands on the dashboard', async () => {
    const { client } = setup({ signedIn: false });
    renderApp('/login');
    fireEvent.change(await screen.findByLabelText(/login id \/ email/i), { target: { value: 'manager1' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Passw0rd!x' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => client.__emit('SIGNED_IN', session));
    expect(await screen.findByText(/Total Products in Stock/i)).toBeTruthy();
  });
});

describe('dashboard', () => {
  it('shows database-computed KPIs, filters and the operations list', async () => {
    setup();
    renderApp('/dashboard');
    expect(await screen.findByText(/Total Products in Stock/i)).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Pending Deliveries').closest('button, div').textContent).toMatch(/1/));
    expect(await screen.findByText('WH/IN/0001')).toBeTruthy();
    expect(screen.getByText('WH/OUT/0001')).toBeTruthy();
    expect(screen.getByText(/1 delivery waiting for stock/i)).toBeTruthy();
    // low-stock alert panel
    expect(screen.getAllByText('Wall Paint 5L').length).toBeGreaterThan(0);
    // filter by document type
    fireEvent.change(screen.getByLabelText('Document type'), { target: { value: 'DELIVERY' } });
    await waitFor(() => expect(screen.queryByText('WH/IN/0001')).toBeNull());
    expect(screen.getByText('WH/OUT/0001')).toBeTruthy();
  });
});

describe('products', () => {
  it('lists products with stock status and creates a product with initial stock via the RPC', async () => {
    const { client } = setup();
    renderApp('/products');
    expect(await screen.findByText('Steel Rod 12mm')).toBeTruthy();
    expect(within(screen.getByRole('table')).getByText('Low stock')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /new product/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^SKU/), { target: { value: 'cem-003' } });
    fireEvent.change(within(dialog).getByLabelText(/product name/i), { target: { value: 'Cement 50kg' } });
    fireEvent.change(within(dialog).getByLabelText(/^Quantity/), { target: { value: '40' } });
    // initial location required when quantity > 0
    fireEvent.click(within(dialog).getByRole('button', { name: /create product/i }));
    expect(await within(dialog).findByText(/choose where the initial stock is stored/i)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(/initial location/i), { target: { value: IDS.b2 } });
    fireEvent.click(within(dialog).getByRole('button', { name: /create product/i }));

    await waitFor(() => expect(client.__log.find((l) => l.kind === 'insert' && l.table === 'products')).toBeTruthy());
    const insert = client.__log.find((l) => l.kind === 'insert' && l.table === 'products');
    expect(insert.values).toMatchObject({ sku: 'CEM-003', name: 'Cement 50kg', is_active: true });
    const init = client.__rpcCalls.find((c) => c.name === 'init_product_stock');
    expect(init.args).toMatchObject({ p_location_id: IDS.b2, p_quantity: 40 });
    expect(await screen.findByText(/product created/i)).toBeTruthy();
  });
});

describe('receipts', () => {
  it('creates a receipt through create_receipt with the documented payload and opens the draft', async () => {
    const { client } = setup();
    renderApp('/receipts/new');
    expect(await screen.findByRole('heading', { name: /new receipt/i })).toBeTruthy();
    await screen.findByRole('option', { name: /WH — Main Warehouse/ });

    fireEvent.change(screen.getByLabelText(/^Warehouse/), { target: { value: IDS.wh } });
    fireEvent.change(screen.getByLabelText(/destination location/i), { target: { value: IDS.a1 } });
    fireEvent.change(screen.getByLabelText(/receive from \(supplier\)/i), { target: { value: IDS.supplier } });
    fireEvent.change(screen.getByLabelText('Product'), { target: { value: IDS.steel } });
    fireEvent.change(screen.getByLabelText('Quantity received'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /save as draft/i }));

    await waitFor(() => expect(client.__rpcCalls.find((c) => c.name === 'create_receipt')).toBeTruthy());
    const { payload } = client.__rpcCalls.find((c) => c.name === 'create_receipt').args;
    expect(payload).toMatchObject({ warehouse_id: IDS.wh, location_id: IDS.a1, supplier_id: IDS.supplier, items: [{ product_id: IDS.steel, quantity: 100 }] });
    expect(payload.schedule_date).toBeTruthy();
    // navigated to the new document (reference generated server-side)
    expect(await screen.findByText('WH/IN/0002')).toBeTruthy();
    expect(screen.getByText(/created as draft/i)).toBeTruthy();
  });

  it('blocks empty submissions with inline validation', async () => {
    setup();
    renderApp('/receipts/new');
    await screen.findByRole('heading', { name: /new receipt/i });
    fireEvent.click(screen.getByRole('button', { name: /save as draft/i }));
    expect(await screen.findByText('Warehouse is required')).toBeTruthy();
    expect(screen.getByText('Destination Location is required')).toBeTruthy();
    expect(screen.getByText('Select a product')).toBeTruthy();
    expect(state.client.__rpcCalls.find((c) => c.name === 'create_receipt')).toBeUndefined();
  });

  it('walks a draft through Mark Ready → Validate using mark_ready / validate_receipt', async () => {
    const { client } = setup();
    renderApp(`/receipts/${IDS.receipt}`);
    expect(await screen.findByText('WH/IN/0001')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^validate$/i })).toBeNull(); // DRAFT cannot be validated

    fireEvent.click(screen.getByRole('button', { name: /mark as ready/i }));
    await waitFor(() => expect(client.__rpcCalls.find((c) => c.name === 'mark_ready')?.args).toEqual({ p_operation_type: 'RECEIPT', p_id: IDS.receipt }));
    const validateBtn = await screen.findByRole('button', { name: /^validate$/i });
    fireEvent.click(validateBtn);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/inventory will increase/i)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: /^validate$/i }));

    await waitFor(() => expect(client.__rpcCalls.find((c) => c.name === 'validate_receipt')?.args).toEqual({ p_id: IDS.receipt }));
    expect(await screen.findByText(/WH\/IN\/0001 validated/i)).toBeTruthy();
    expect(await screen.findByText(/Inventory has been updated/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^validate$/i })).toBeNull(); // DONE is terminal
  });
});

describe('deliveries', () => {
  it('explains WAITING and re-checks availability without going negative', async () => {
    const { client } = setup();
    renderApp(`/deliveries/${IDS.delivery}`);
    expect(await screen.findByText('WH/OUT/0001')).toBeTruthy();
    expect(screen.getByText(/waiting for stock/i)).toBeTruthy();
    // 8 requested vs 5 free → highlighted as unavailable
    expect(await screen.findByText(/\(unavailable\)/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /check availability/i }));
    await waitFor(() => expect(client.__rpcCalls.find((c) => c.name === 'mark_ready')?.args).toEqual({ p_operation_type: 'DELIVERY', p_id: IDS.delivery }));
    expect(await screen.findByText(/is waiting for stock/i)).toBeTruthy();
    expect(client.__rpcCalls.find((c) => c.name === 'validate_delivery')).toBeUndefined();
  });

  it('cancels from the detail page through cancel_operation', async () => {
    const { client } = setup();
    renderApp(`/deliveries/${IDS.delivery}`);
    await screen.findByText('WH/OUT/0001');
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel operation/i }));
    await waitFor(() => expect(client.__rpcCalls.find((c) => c.name === 'cancel_operation')?.args).toEqual({ p_operation_type: 'DELIVERY', p_id: IDS.delivery }));
    expect(await screen.findByText(/WH\/OUT\/0001 canceled/i)).toBeTruthy();
  });
});

describe('stock, move history, settings and profile pages', () => {
  it('renders stock by location with totals', async () => {
    setup();
    renderApp('/stock');
    expect(await screen.findByText('Rack B2')).toBeTruthy();
    expect(screen.getAllByText('Steel Rod 12mm').length).toBe(2);
    const tfoot = document.querySelector('tfoot');
    expect(tfoot.textContent).toMatch(/105/); // 70 + 30 + 5
  });

  it('renders the move history ledger', async () => {
    setup();
    renderApp('/move-history');
    expect(await screen.findByText('WH/ADJ/0001')).toBeTruthy();
    expect(within(screen.getByRole('table')).getByText('ADJUSTMENT')).toBeTruthy();
    expect(screen.getByText(/1 movement$/)).toBeTruthy();
  });

  it('renders warehouses, locations and contacts and creates a location', async () => {
    const { client } = setup();
    renderApp('/settings/warehouses');
    expect(await screen.findByText('Main Warehouse')).toBeTruthy();

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Settings' })).getByRole('link', { name: /^Locations$/ }));
    expect(await screen.findByText('Rack A1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /new location/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Code/), { target: { value: 'c3' } });
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: 'Rack C3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(client.__log.find((l) => l.kind === 'insert' && l.table === 'locations')?.values).toMatchObject({ warehouse_id: IDS.wh, code: 'C3', name: 'Rack C3' }));

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Settings' })).getByRole('link', { name: /suppliers & customers/i }));
    expect(await screen.findByText('Tata Steel')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /customers/i }));
    expect(await screen.findByText('Acme Builders')).toBeTruthy();
  });

  it('renders the profile page', async () => {
    setup();
    renderApp('/profile');
    expect(await screen.findByText('manager1')).toBeTruthy();
    expect(screen.getAllByText('Inventory Manager').length).toBeGreaterThan(0);
  });

  it('shows the 404 page for unknown routes', async () => {
    setup();
    renderApp('/nope');
    expect(await screen.findByText(/page not found/i)).toBeTruthy();
  });
});
