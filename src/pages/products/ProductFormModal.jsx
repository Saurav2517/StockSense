import { useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Checkbox, FormField, Input, Select } from '../../components/ui/FormField';
import { Alert } from '../../components/ui/Feedback';
import { useCategories, useLocations, useSaveProduct } from '../../hooks/useMasterData';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../utils/errors';
import { validateNonNegativeNumber } from '../../utils/validation';

const UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'm', 'box', 'pack', 'set'];

const EMPTY = { sku: '', name: '', category_id: '', unit_of_measure: 'pcs', unit_cost: '', reorder_level: '', is_active: true };

export function ProductFormModal({ open, onClose, product }) {
  const isEdit = Boolean(product?.product_id || product?.id);
  const productId = product?.product_id || product?.id;
  const toast = useToast();
  const save = useSaveProduct();
  const { data: categories = [] } = useCategories();
  const { data: locations = [] } = useLocations({ activeOnly: true });

  // The parent mounts this modal only while open, so state initialises from the product once.
  const [form, setForm] = useState(() =>
    product
      ? {
          sku: product.sku || '',
          name: product.name || '',
          category_id: product.category_id || '',
          unit_of_measure: product.unit_of_measure || 'pcs',
          unit_cost: product.unit_cost ?? '',
          reorder_level: product.reorder_level ?? '',
          is_active: product.is_active ?? true,
        }
      : EMPTY
  );
  const [initial, setInitial] = useState({ quantity: '', locationId: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  const units = useMemo(() => (form.unit_of_measure && !UNITS.includes(form.unit_of_measure) ? [form.unit_of_measure, ...UNITS] : UNITS), [form.unit_of_measure]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  function validate() {
    const e = {};
    if (!form.sku.trim()) e.sku = 'SKU is required';
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.unit_of_measure.trim()) e.unit_of_measure = 'Unit is required';
    const cost = validateNonNegativeNumber(form.unit_cost === '' ? 0 : form.unit_cost, 'Unit cost');
    if (cost) e.unit_cost = cost;
    const reorder = validateNonNegativeNumber(form.reorder_level === '' ? 0 : form.reorder_level, 'Reorder level');
    if (reorder) e.reorder_level = reorder;
    if (!isEdit) {
      const qtyErr = validateNonNegativeNumber(initial.quantity === '' ? 0 : initial.quantity, 'Initial stock');
      if (qtyErr) e.initial_quantity = qtyErr;
      if (Number(initial.quantity) > 0 && !initial.locationId) e.initial_location = 'Choose where the initial stock is stored';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;
    const values = {
      sku: form.sku.trim().toUpperCase(),
      name: form.name.trim(),
      category_id: form.category_id || null,
      unit_of_measure: form.unit_of_measure.trim(),
      unit_cost: Number(form.unit_cost || 0),
      reorder_level: Number(form.reorder_level || 0),
      is_active: Boolean(form.is_active),
    };
    try {
      await save.mutateAsync({ id: productId, values, initialStock: isEdit ? null : initial });
      toast.success(
        isEdit ? 'Product updated' : 'Product created',
        !isEdit && Number(initial.quantity) > 0 ? 'Initial stock recorded as a validated adjustment (see Move History).' : undefined
      );
      onClose();
    } catch (err) {
      const msg = getErrorMessage(err);
      setFormError(/duplicate|unique|already exists/i.test(msg) ? 'A product with this SKU already exists.' : msg);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${product?.name}` : 'New product'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" loading={save.isPending}>
            {isEdit ? 'Save changes' : 'Create product'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} className="space-y-4" noValidate>
        {formError && <Alert kind="error">{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="SKU" required error={errors.sku} htmlFor="p-sku">
            <Input id="p-sku" value={form.sku} onChange={set('sku')} placeholder="e.g. STL-001" invalid={Boolean(errors.sku)} autoFocus={!isEdit} className="uppercase" />
          </FormField>
          <FormField label="Category" htmlFor="p-cat">
            <Select id="p-cat" value={form.category_id} onChange={set('category_id')} placeholder="Uncategorized">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField label="Product name" required error={errors.name} htmlFor="p-name">
          <Input id="p-name" value={form.name} onChange={set('name')} placeholder="e.g. Steel Rod 12mm" invalid={Boolean(errors.name)} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Unit of measure" required error={errors.unit_of_measure} htmlFor="p-uom">
            <Select id="p-uom" value={form.unit_of_measure} onChange={set('unit_of_measure')}>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Unit cost" error={errors.unit_cost} htmlFor="p-cost">
            <Input id="p-cost" type="number" min={0} step="0.01" inputMode="decimal" value={form.unit_cost} onChange={set('unit_cost')} placeholder="0.00" invalid={Boolean(errors.unit_cost)} />
          </FormField>
          <FormField label="Reorder level" error={errors.reorder_level} hint="Low-stock alert threshold" htmlFor="p-reorder">
            <Input id="p-reorder" type="number" min={0} step="any" inputMode="decimal" value={form.reorder_level} onChange={set('reorder_level')} placeholder="0" invalid={Boolean(errors.reorder_level)} />
          </FormField>
        </div>

        {isEdit ? (
          <Checkbox label="Active (available for new operations)" checked={Boolean(form.is_active)} onChange={set('is_active')} />
        ) : (
          <fieldset className="rounded-lg border border-dashed border-slate-300 p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Initial stock (optional)</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Quantity" error={errors.initial_quantity} htmlFor="p-init-qty">
                <Input id="p-init-qty" type="number" min={0} step="any" inputMode="decimal" value={initial.quantity} onChange={(e) => setInitial((s) => ({ ...s, quantity: e.target.value }))} placeholder="0" invalid={Boolean(errors.initial_quantity)} />
              </FormField>
              <FormField label="Initial location" required={Number(initial.quantity) > 0} error={errors.initial_location} htmlFor="p-init-loc">
                <Select id="p-init-loc" value={initial.locationId} onChange={(e) => setInitial((s) => ({ ...s, locationId: e.target.value }))} placeholder="Select location…" invalid={Boolean(errors.initial_location)}>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.warehouse?.code} / {l.code} — {l.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Stock is never written directly: the initial quantity is recorded through a validated inventory adjustment so the ledger stays complete.
            </p>
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
