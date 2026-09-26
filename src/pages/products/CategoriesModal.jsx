import { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/FormField';
import { Alert, EmptyState } from '../../components/ui/Feedback';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useCategories, useDeleteCategory, useSaveCategory } from '../../hooks/useMasterData';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../utils/errors';

export function CategoriesModal({ open, onClose }) {
  const toast = useToast();
  const { data: categories = [] } = useCategories();
  const save = useSaveCategory();
  const remove = useDeleteCategory();
  const [draft, setDraft] = useState({ id: null, name: '', description: '' });
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!draft.name.trim()) return setError('Category name is required');
    setError('');
    try {
      await save.mutateAsync({ id: draft.id, values: { name: draft.name.trim(), description: draft.description.trim() || null } });
      toast.success(draft.id ? 'Category updated' : 'Category added');
      setDraft({ id: null, name: '', description: '' });
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(/duplicate|unique/i.test(msg) ? 'A category with this name already exists.' : msg);
    }
  }

  async function confirmDelete() {
    try {
      await remove.mutateAsync(toDelete.id);
      toast.success('Category deleted', 'Products in it are now uncategorized.');
      setToDelete(null);
    } catch (err) {
      toast.error('Could not delete category', getErrorMessage(err));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Product categories" description="Categories are used for filtering products, stock and dashboard operations.">
      <form onSubmit={submit} className="space-y-3" noValidate>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Category name" aria-label="Category name" className="sm:flex-1" />
          <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Description (optional)" aria-label="Description" className="sm:flex-1" />
          <div className="flex gap-2">
            <Button type="submit" icon={draft.id ? Pencil : Plus} loading={save.isPending}>
              {draft.id ? 'Update' : 'Add'}
            </Button>
            {draft.id && (
              <Button variant="ghost" size="icon" onClick={() => setDraft({ id: null, name: '', description: '' })} aria-label="Cancel edit">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </form>

      <div className="mt-4 max-h-80 overflow-y-auto rounded-lg border border-slate-200">
        {categories.length === 0 ? (
          <EmptyState title="No categories yet" description="Add your first category above." className="py-8" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                  {c.description && <p className="truncate text-xs text-slate-500">{c.description}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setDraft({ id: c.id, name: c.name, description: c.description || '' })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setToDelete(c)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={remove.isPending}
        variant="danger"
        title={`Delete "${toDelete?.name}"?`}
        description="Products in this category will become uncategorized. Stock and history are not affected."
        confirmLabel="Delete"
      />
    </Modal>
  );
}
