import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader, Tabs, SearchInput } from '../../components/ui/Misc';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/Feedback';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ContactFormModal } from '../../components/forms/EntityQuickAdd';
import { useContacts, useDeleteContact } from '../../hooks/useMasterData';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../utils/errors';
import { SettingsTabs } from './SettingsLayout';

export function ContactsPage() {
  const toast = useToast();
  const [entity, setEntity] = useState('supplier');
  const [search, setSearch] = useState('');
  const { data: rows = [], isLoading, error, refetch } = useContacts(entity);
  const remove = useDeleteContact(entity);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const filtered = search ? rows.filter((r) => [r.name, r.email, r.phone].some((v) => (v || '').toLowerCase().includes(search.toLowerCase()))) : rows;
  const label = entity === 'supplier' ? 'Supplier' : 'Customer';

  async function confirmDelete() {
    try {
      await remove.mutateAsync(toDelete.id);
      toast.success(`${label} deleted`);
      setToDelete(null);
    } catch (err) {
      toast.error(`Could not delete ${label.toLowerCase()}`, /foreign key|violates/i.test(getErrorMessage(err)) ? 'It is referenced by existing operations.' : getErrorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Warehouses, locations and business contacts." actions={<Button icon={Plus} onClick={() => setEditing({})}>New {label.toLowerCase()}</Button>} />
      <SettingsTabs />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={entity} onChange={setEntity} items={[{ value: 'supplier', label: 'Suppliers' }, { value: 'customer', label: 'Customers' }]} />
        <SearchInput value={search} onChange={setSearch} placeholder={`Search ${label.toLowerCase()}s…`} className="sm:w-64" />
      </div>
      <DataTable
        columns={[
          { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
          { key: 'email', header: 'Email', hideBelow: 'sm', render: (r) => r.email || '—' },
          { key: 'phone', header: 'Phone', hideBelow: 'md', render: (r) => r.phone || '—' },
          { key: 'address', header: 'Address', hideBelow: 'lg', render: (r) => <span className="line-clamp-1">{r.address || '—'}</span> },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (r) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" aria-label="Edit" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Delete" onClick={(e) => { e.stopPropagation(); setToDelete(r); }}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ),
          },
        ]}
        rows={filtered}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        onRowClick={(r) => setEditing(r)}
        empty={<EmptyState title={`No ${label.toLowerCase()}s yet`} description={entity === 'supplier' ? 'Suppliers are selected on receipts.' : 'Customers are selected on delivery orders.'} action={<Button icon={Plus} onClick={() => setEditing({})}>New {label.toLowerCase()}</Button>} />}
      />
      {editing !== null && (
        <ContactFormModal key={editing?.id || 'new'} entity={entity} open initial={editing?.id ? editing : undefined} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={remove.isPending}
        variant="danger"
        title={`Delete ${toDelete?.name}?`}
        description="Existing operations keep their reference to this contact only if none exist; otherwise the delete is blocked."
        confirmLabel="Delete"
      />
    </div>
  );
}
