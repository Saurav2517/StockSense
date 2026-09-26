import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Plus } from 'lucide-react';
import { PageHeader } from '../../components/ui/Misc';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Checkbox, FormField, Input, Select } from '../../components/ui/FormField';
import { Alert, EmptyState } from '../../components/ui/Feedback';
import { useLocations, useSaveLocation, useWarehouses } from '../../hooks/useMasterData';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../utils/errors';
import { SettingsTabs } from './SettingsLayout';

function LocationModal({ open, onClose, location, defaultWarehouseId, warehouses }) {
  const toast = useToast();
  const save = useSaveLocation();
  const isEdit = Boolean(location?.id);
  const [form, setForm] = useState(() =>
    isEdit
      ? { warehouse_id: location.warehouse_id, code: location.code, name: location.name, is_active: location.is_active }
      : { warehouse_id: defaultWarehouseId || warehouses[0]?.id || '', code: '', name: '', is_active: true }
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.warehouse_id) errs.warehouse_id = 'Warehouse is required';
    if (!form.code.trim()) errs.code = 'Code is required';
    if (!form.name.trim()) errs.name = 'Name is required';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await save.mutateAsync({
        id: location?.id,
        values: { warehouse_id: form.warehouse_id, code: form.code.trim().toUpperCase(), name: form.name.trim(), is_active: Boolean(form.is_active) },
      });
      toast.success(isEdit ? 'Location updated' : 'Location created');
      onClose();
    } catch (err) {
      const msg = getErrorMessage(err);
      setFormError(/duplicate|unique/i.test(msg) ? 'This code is already used in the selected warehouse.' : msg);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${location.name}` : 'New location'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="location-form" loading={save.isPending}>Save</Button>
        </>
      }
    >
      <form id="location-form" onSubmit={submit} className="space-y-4" noValidate>
        {formError && <Alert kind="error">{formError}</Alert>}
        <FormField label="Warehouse" required error={errors.warehouse_id} hint={isEdit ? 'Locations cannot move between warehouses' : undefined} htmlFor="l-wh">
          <Select id="l-wh" value={form.warehouse_id} onChange={set('warehouse_id')} placeholder="Select warehouse…" invalid={Boolean(errors.warehouse_id)} disabled={isEdit}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Code" required error={errors.code} htmlFor="l-code">
            <Input id="l-code" value={form.code} onChange={set('code')} placeholder="A1" className="uppercase" invalid={Boolean(errors.code)} autoFocus={!isEdit} />
          </FormField>
          <FormField label="Name" required error={errors.name} className="sm:col-span-2" htmlFor="l-name">
            <Input id="l-name" value={form.name} onChange={set('name')} placeholder="Rack A1" invalid={Boolean(errors.name)} />
          </FormField>
        </div>
        {isEdit && <Checkbox label="Active" checked={Boolean(form.is_active)} onChange={set('is_active')} />}
      </form>
    </Modal>
  );
}

export function LocationsPage() {
  const [params, setParams] = useSearchParams();
  const warehouseId = params.get('warehouse') || '';
  const { data: warehouses = [] } = useWarehouses();
  const { data: rows = [], isLoading, error, refetch } = useLocations(warehouseId ? { warehouseId } : {});
  const [editing, setEditing] = useState(null);

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Warehouses, locations and business contacts."
        actions={
          <Button icon={Plus} onClick={() => setEditing({})} disabled={warehouses.length === 0}>
            New location
          </Button>
        }
      />
      <SettingsTabs />
      {warehouses.length === 0 && (
        <Alert kind="warning" className="mb-4">
          Create a warehouse before adding locations.
        </Alert>
      )}
      <div className="mb-4 sm:w-64">
        <Select value={warehouseId} onChange={(e) => setParams(e.target.value ? { warehouse: e.target.value } : {}, { replace: true })} placeholder="All warehouses" aria-label="Warehouse">
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} — {w.name}
            </option>
          ))}
        </Select>
      </div>
      <DataTable
        columns={[
          { key: 'warehouse', header: 'Warehouse', render: (r) => <span className="font-mono text-slate-700">{r.warehouse?.code}</span> },
          { key: 'code', header: 'Code', render: (r) => <span className="font-semibold text-slate-900">{r.code}</span> },
          { key: 'name', header: 'Name' },
          { key: 'is_active', header: 'Status', render: (r) => <Badge tone={r.is_active ? 'emerald' : 'slate'}>{r.is_active ? 'Active' : 'Inactive'}</Badge> },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (r) => (
              <Button variant="ghost" size="icon" aria-label="Edit" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>
                <Pencil className="h-4 w-4" />
              </Button>
            ),
          },
        ]}
        rows={rows}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        onRowClick={(r) => setEditing(r)}
        empty={<EmptyState title="No locations" description="Add racks, shelves or zones where stock is stored." action={warehouses.length ? <Button icon={Plus} onClick={() => setEditing({})}>New location</Button> : null} />}
      />
      {editing !== null && <LocationModal open location={editing} defaultWarehouseId={warehouseId} warehouses={warehouses} onClose={() => setEditing(null)} />}
    </div>
  );
}
