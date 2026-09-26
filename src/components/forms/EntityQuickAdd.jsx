import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FormField, Input, Textarea } from '../ui/FormField';
import { Alert } from '../ui/Feedback';
import { useSaveContact } from '../../hooks/useMasterData';
import { getErrorMessage } from '../../utils/errors';

/** Create a supplier / customer without leaving the operation form. */
export function ContactFormModal({ entity, open, onClose, onCreated, initial }) {
  const save = useSaveContact(entity);
  const [form, setForm] = useState(initial || { name: '', email: '', phone: '', address: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const label = entity === 'supplier' ? 'Supplier' : 'Customer';

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');
    setError('');
    try {
      const row = await save.mutateAsync({ id: initial?.id, values: { ...form, name: form.name.trim() } });
      onCreated?.(row);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? `Edit ${label}` : `New ${label}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="contact-form" loading={save.isPending}>Save</Button>
        </>
      }
    >
      <form id="contact-form" onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert kind="error">{error}</Alert>}
        <FormField label="Name" required htmlFor="c-name">
          <Input id="c-name" value={form.name} onChange={set('name')} autoFocus />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Email" htmlFor="c-email">
            <Input id="c-email" type="email" value={form.email || ''} onChange={set('email')} />
          </FormField>
          <FormField label="Phone" htmlFor="c-phone">
            <Input id="c-phone" value={form.phone || ''} onChange={set('phone')} />
          </FormField>
        </div>
        <FormField label={entity === 'customer' ? 'Delivery address' : 'Address'} htmlFor="c-address">
          <Textarea id="c-address" rows={2} value={form.address || ''} onChange={set('address')} />
        </FormField>
      </form>
    </Modal>
  );
}
