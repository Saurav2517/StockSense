import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus } from 'lucide-react';
import { PageHeader } from '../../components/ui/Misc';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Checkbox, FormField, Input, Textarea } from '../../components/ui/FormField';
import { Alert, EmptyState } from '../../components/ui/Feedback';
import { useLocations, useSaveWarehouse, useWarehouses } from '../../hooks/useMasterData';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../utils/errors';
import { SettingsTabs } from './SettingsLayout';

const EMPTY = { code: '', name: '', address: '', is_active: true };

function WarehouseModal({ open, onClose, warehouse }) {
  const toast = useToast();
  const save = useSaveWarehouse();
  const isEdit = Boolean(warehouse?.id);
  const [form, setForm] = useState(() => (isEdit ? { code: warehouse.code, name: warehouse.name, address: warehouse.address || '', is_active: warehouse.is_active } : EMPTY));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const code = form.code.trim().toUpperCase();
    const errs = {};
    if (!/^[A-Z0-9-]{1,10}$/.test(code)) errs.code = 'Use 1–10 letters, digits or dashes (e.g. WH, WH-2)';
    if (!form.name.trim()) errs.name = 'Name is required';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await save.mutateAsync({ id: warehouse?.id, values: { code, name: form.name.trim(), address: form.address.trim() || null, is_active: Boolean(form.is_active) } });
      toast.success(isEdit ? 'Warehouse updated' : 'Warehouse created');
      onClose();
    } catch (err) {
      const msg = getErrorMessage(err);
      setFormError(/duplicate|unique/i.test(msg) ? 'A warehouse with this code already exists.' : msg);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${warehouse.code}` : 'New warehouse'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="warehouse-form" loading={save.isPending}>Save</Button>
        </>
      }
    >
      <form id="warehouse-form" onSubmit={submit} className="space-y-4" noValidate>
        {formError && <Alert kind="error">{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Short code" required error={errors.code} hint="Used in references, e.g. WH/IN/0001" htmlFor="w-code">
            <Input id="w-code" value={form.code} onChange={set('code')} placeholder="WH" maxLength={10} className="uppercase" invalid={Boolean(errors.code)} disabled={isEdit} autoFocus={!isEdit} />
          </FormField>
          <FormField label="Name" required error={errors.name} className="sm:col-span-2" htmlFor="w-name">
            <Input id="w-name" value={form.name} onChange={set('name')} placeholder="Main Warehouse" invalid={Boolean(errors.name)} />
          </FormField>
        </div>
        <FormField label="Address" htmlFor="w-address">
          <Textarea id="w-address" rows={2} value={form.address} onChange={set('address')} />
        </FormField>
        {isEdit && <Checkbox label="Active" checked={Boolean(form.is_active)} onChange={set('is_active')} />}
      </form>
    </Modal>
  );
}

export function WarehousesPage() {
  const { data: rows = [], isLoading, error, refetch } = useWarehouses();
  const { data: locations = [] } = useLocations();
  const [editing, setEditing] = useState(null);

  const locCount = (id) => locations.filter((l) => l.warehouse_id === id).length;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Warehouses, locations and business contacts." actions={<Button icon={Plus} onClick={() => setEditing({})}>New warehouse</Button>} />
      <SettingsTabs />
      <DataTable
        columns={[
          { key: 'code', header: 'Code', render: (r) => <span className="font-mono font-semibold text-slate-900">{r.code}</span> },
          { key: 'name', header: 'Name' },
          { key: 'address', header: 'Address', hideBelow: 'md', render: (r) => r.address || '—' },
          {
            key: 'locations',
            header: 'Locations',
            align: 'right',
            render: (r) => (
              <Link to={`/settings/locations?warehouse=${r.id}`} className="link" onClick={(e) => e.stopPropagation()}>
                {locCount(r.id)}
              </Link>
            ),
          },
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
        empty={<EmptyState title="No warehouses yet" description="Create a warehouse, then add its storage locations." action={<Button icon={Plus} onClick={() => setEditing({})}>New warehouse</Button>} />}
      />
      {editing !== null && <WarehouseModal open warehouse={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
