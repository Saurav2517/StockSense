import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Save } from 'lucide-react';
import { PageHeader } from '../../components/ui/Misc';
import { FormField, Input, Select, Textarea } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { Alert, ErrorState, LoadingBlock } from '../../components/ui/Feedback';
import { OperationLinesEditor } from '../../components/forms/OperationLinesEditor';
import { ContactFormModal } from '../../components/forms/EntityQuickAdd';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useContacts, useLocations, useProductList, useProfiles, useWarehouses } from '../../hooks/useMasterData';
import { useStockAtLocation } from '../../hooks/useInventory';
import { useCreateOperation, useOperation, useUpdateOperation } from '../../hooks/useOperations';
import { getOperationConfig, operationPath } from '../../utils/operations';
import { fromDateTimeLocal, toDateTimeLocal } from '../../utils/format';
import { getErrorMessage } from '../../utils/errors';
import { validateNonNegativeNumber, validatePositiveNumber } from '../../utils/validation';

function emptyLine(mode) {
  return { key: crypto.randomUUID(), product_id: '', [mode === 'count' ? 'counted_quantity' : 'quantity']: '' };
}

/** Initial form state: from an existing DRAFT (edit) or from query params / defaults (new). */
function initialFormState({ cfg, existing, searchParams, userId }) {
  if (existing) {
    return {
      form: {
        warehouse_id: existing.warehouse_id || '',
        location_id: existing.location_id || '',
        source_location_id: existing.source_location_id || '',
        destination_location_id: existing.destination_location_id || '',
        supplier_id: existing.supplier_id || '',
        customer_id: existing.customer_id || '',
        reason: existing.reason || '',
        schedule_date: toDateTimeLocal(existing.schedule_date),
        responsible_user_id: existing.responsible_user_id || '',
      },
      lines: (existing.items || []).map((it) => ({
        key: it.id,
        product_id: it.product_id,
        quantity: it.quantity ?? '',
        counted_quantity: it.counted_quantity ?? '',
      })),
    };
  }
  const location = searchParams.get('location') || '';
  const productId = searchParams.get('product');
  return {
    form: {
      warehouse_id: '',
      location_id: location,
      source_location_id: location,
      destination_location_id: '',
      supplier_id: '',
      customer_id: '',
      reason: '',
      schedule_date: toDateTimeLocal(new Date()),
      responsible_user_id: userId || '',
    },
    lines: [productId ? { ...emptyLine(cfg.linesMode), product_id: productId } : emptyLine(cfg.linesMode)],
  };
}

/** Loads the document (edit mode) and mounts the form once data is available. */
export function OperationFormPage({ type }) {
  const cfg = getOperationConfig(type);
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { data: existing, isLoading, error } = useOperation(type, id);

  if (isEdit && isLoading) return <LoadingBlock />;
  if (isEdit && error) return <ErrorState error={error} />;
  if (isEdit && existing && !cfg.editableStatuses.includes(existing.status)) {
    return (
      <Alert kind="warning" title={`${existing.reference} is ${existing.status}`}>
        Only {cfg.editableStatuses.join(' / ')} {cfg.plural.toLowerCase()} can be edited.{' '}
        <Link className="link" to={operationPath(type, id)}>
          Back to the document
        </Link>
      </Alert>
    );
  }
  // key = document id so the form state re-initialises if the route changes
  return <OperationForm key={id || 'new'} type={type} existing={isEdit ? existing : null} />;
}

function OperationForm({ type, existing }) {
  const cfg = getOperationConfig(type);
  const id = existing?.id;
  const isEdit = Boolean(existing);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();

  const { data: warehouses = [] } = useWarehouses({ activeOnly: true });
  const { data: locations = [] } = useLocations({ activeOnly: true });
  const { data: products = [] } = useProductList();
  const { data: profiles = [] } = useProfiles();
  const { data: contacts = [] } = useContacts(cfg.contact?.entity);

  const create = useCreateOperation(type);
  const update = useUpdateOperation(type);

  const [initial] = useState(() => initialFormState({ cfg, existing, searchParams, userId: user?.id }));
  const [form, setForm] = useState(initial.form);
  const [lines, setLines] = useState(initial.lines);
  const [errors, setErrors] = useState({});
  const [lineErrors, setLineErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [contactModal, setContactModal] = useState(false);

  // Warehouse is derived from the primary location when not chosen explicitly (e.g. Stock page → "Update stock").
  const primaryLocationId = form[cfg.locations[0].key];
  const warehouseId = form.warehouse_id || locations.find((l) => l.id === primaryLocationId)?.warehouse_id || '';

  const filteredLocations = useMemo(
    () => (cfg.hasWarehouse && warehouseId ? locations.filter((l) => l.warehouse_id === warehouseId) : locations),
    [locations, warehouseId, cfg.hasWarehouse]
  );

  // Stock at the source / counted location for availability & recorded figures
  const stockLocationId = cfg.linesMode === 'count' ? form.location_id : cfg.showAvailability ? form.source_location_id : null;
  const { data: stockAt = {} } = useStockAtLocation(stockLocationId);

  const set = (k) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: value };
      if (k === 'warehouse_id') {
        // reset locations that no longer match the warehouse
        for (const loc of cfg.locations) {
          const l = locations.find((x) => x.id === f[loc.key]);
          if (l && l.warehouse_id !== value) next[loc.key] = '';
        }
      }
      return next;
    });
  };

  function validate() {
    const e = {};
    if (cfg.hasWarehouse && !warehouseId) e.warehouse_id = 'Warehouse is required';
    for (const loc of cfg.locations) if (!form[loc.key]) e[loc.key] = `${loc.label} is required`;
    if (type === 'TRANSFER' && form.source_location_id && form.source_location_id === form.destination_location_id) {
      e.destination_location_id = 'Destination must differ from source';
    }
    for (const f of cfg.extraFields || []) if (f.required && !String(form[f.key] || '').trim()) e[f.key] = `${f.label} is required`;
    if (!form.schedule_date) e.schedule_date = 'Schedule date is required';

    const le = {};
    if (lines.length === 0) e.lines = 'Add at least one product line';
    lines.forEach((l, i) => {
      const err = {};
      if (!l.product_id) err.product_id = 'Select a product';
      const qtyErr = cfg.linesMode === 'count' ? validateNonNegativeNumber(l.counted_quantity, 'Counted quantity') : validatePositiveNumber(l.quantity, 'Quantity');
      if (qtyErr) err.quantity = qtyErr;
      if (Object.keys(err).length) le[i] = err;
    });
    setErrors(e);
    setLineErrors(le);
    return Object.keys(e).length === 0 && Object.keys(le).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;

    const payload = {
      schedule_date: fromDateTimeLocal(form.schedule_date),
      responsible_user_id: form.responsible_user_id || null,
      items: lines.map((l) =>
        cfg.linesMode === 'count'
          ? { product_id: l.product_id, counted_quantity: Number(l.counted_quantity) }
          : { product_id: l.product_id, quantity: Number(l.quantity) }
      ),
    };
    if (cfg.hasWarehouse) payload.warehouse_id = warehouseId;
    for (const loc of cfg.locations) payload[loc.key] = form[loc.key];
    if (cfg.contact) payload[cfg.contact.key] = form[cfg.contact.key] || null;
    for (const f of cfg.extraFields || []) payload[f.key] = form[f.key];

    try {
      let opId = id;
      if (isEdit) {
        await update.mutateAsync({ id, payload });
        toast.success(`${existing.reference} updated`);
      } else {
        opId = await create.mutateAsync(payload);
        toast.success(`${cfg.label} created as Draft`, 'Mark it Ready, then Validate to update inventory.');
      }
      navigate(operationPath(type, opId), { replace: true });
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        breadcrumb={
          <Link to={cfg.path} className="link">
            {cfg.plural}
          </Link>
        }
        title={isEdit ? `Edit ${existing?.reference || ''}` : `New ${cfg.label}`}
        subtitle={isEdit ? 'Changes are saved on the Draft. Validation happens from the document page.' : `The reference (${'<WH>'}/${cfg.prefix}/0001) is generated by the database on save.`}
        actions={
          <>
            <Button variant="secondary" to={isEdit ? operationPath(type, id) : cfg.path}>
              Cancel
            </Button>
            <Button type="submit" icon={Save} loading={saving}>
              {isEdit ? 'Save changes' : 'Save as Draft'}
            </Button>
          </>
        }
      />

      {formError && <Alert kind="error" className="mb-4">{formError}</Alert>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card space-y-4 p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold text-slate-900">Details</h2>

          {cfg.hasWarehouse && (
            <FormField label="Warehouse" required error={errors.warehouse_id} hint={isEdit ? 'Cannot change after creation' : undefined}>
              <Select value={warehouseId} onChange={set('warehouse_id')} placeholder="Select warehouse…" invalid={Boolean(errors.warehouse_id)} disabled={isEdit}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          {cfg.locations.map((loc) => (
            <FormField key={loc.key} label={loc.label} required error={errors[loc.key]}>
              <Select value={form[loc.key]} onChange={set(loc.key)} placeholder="Select location…" invalid={Boolean(errors[loc.key])}>
                {(cfg.hasWarehouse ? filteredLocations : locations).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.warehouse?.code} / {l.code} — {l.name}
                  </option>
                ))}
              </Select>
            </FormField>
          ))}

          {cfg.contact && (
            <FormField label={cfg.contact.label} htmlFor="op-contact">
              <div className="flex gap-2">
                <Select id="op-contact" value={form[cfg.contact.key]} onChange={set(cfg.contact.key)} placeholder={`Select ${cfg.contact.entity}…`}>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Button variant="secondary" size="icon" onClick={() => setContactModal(true)} aria-label={`New ${cfg.contact.entity}`} title={`New ${cfg.contact.entity}`}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </FormField>
          )}

          {(cfg.extraFields || []).map((f) => (
            <FormField key={f.key} label={f.label} required={f.required} error={errors[f.key]}>
              {f.type === 'textarea' ? (
                <Textarea value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder} invalid={Boolean(errors[f.key])} />
              ) : (
                <Input value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder} invalid={Boolean(errors[f.key])} />
              )}
            </FormField>
          ))}

          <FormField label="Schedule date" required error={errors.schedule_date}>
            <Input type="datetime-local" value={form.schedule_date} onChange={set('schedule_date')} invalid={Boolean(errors.schedule_date)} />
          </FormField>

          <FormField label="Responsible user">
            <Select value={form.responsible_user_id} onChange={set('responsible_user_id')} placeholder="Unassigned">
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.login_id} ({p.login_id})
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="card space-y-3 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Products</h2>
            {cfg.showAvailability && !stockLocationId && <span className="text-xs text-slate-500">Select the source location to see free stock.</span>}
            {cfg.linesMode === 'count' && !form.location_id && <span className="text-xs text-slate-500">Select the location to see recorded quantities.</span>}
          </div>
          {errors.lines && <Alert kind="error">{errors.lines}</Alert>}
          <OperationLinesEditor
            lines={lines}
            onChange={setLines}
            products={products}
            mode={cfg.linesMode}
            stockAt={stockAt}
            showAvailability={cfg.showAvailability}
            quantityLabel={cfg.quantityLabel}
            errors={lineErrors}
          />
          {type === 'DELIVERY' && (
            <p className="text-xs text-slate-500">
              Lines that exceed free stock are highlighted. Marking the delivery Ready re-checks availability server-side; if stock is short the delivery goes to <strong>Waiting</strong> — inventory never goes negative.
            </p>
          )}
          {type === 'ADJUSTMENT' && (
            <p className="text-xs text-slate-500">
              On validation, inventory is set to the counted quantity and the difference is written to the ledger as an <strong>ADJUSTMENT</strong>.
            </p>
          )}
        </div>
      </div>

      {cfg.contact && contactModal && (
        <ContactFormModal
          entity={cfg.contact.entity}
          open={contactModal}
          onClose={() => setContactModal(false)}
          onCreated={(row) => setForm((f) => ({ ...f, [cfg.contact.key]: row.id }))}
        />
      )}
    </form>
  );
}
