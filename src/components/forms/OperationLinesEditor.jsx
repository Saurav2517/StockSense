import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/FormField';
import { classNames, formatQty, toNumber } from '../../utils/format';

/**
 * Product lines for an operation form.
 * mode = 'quantity' → { product_id, quantity }
 * mode = 'count'    → { product_id, counted_quantity } with recorded/difference preview
 * stockAt: { [product_id]: { quantity, reserved_quantity, free_to_use } } for the source location
 */
export function OperationLinesEditor({ lines, onChange, products = [], mode = 'quantity', stockAt = {}, showAvailability = false, quantityLabel = 'Quantity', errors = {} }) {
  const qtyKey = mode === 'count' ? 'counted_quantity' : 'quantity';

  function update(index, patch) {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function add() {
    onChange([...lines, { key: crypto.randomUUID(), product_id: '', [qtyKey]: '' }]);
  }
  function remove(index) {
    onChange(lines.filter((_, i) => i !== index));
  }

  const usedIds = new Set(lines.map((l) => l.product_id).filter(Boolean));

  return (
    <div className="space-y-3">
      <div className="table-wrap">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="th w-[45%]">Product</th>
              {mode === 'count' && <th className="th text-right">Recorded</th>}
              {showAvailability && <th className="th text-right">Free to use</th>}
              <th className="th text-right">{quantityLabel}</th>
              {mode === 'count' && <th className="th text-right">Difference</th>}
              <th className="th w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 && (
              <tr>
                <td colSpan={6} className="td py-6 text-center text-slate-500">
                  No product lines yet. Add at least one product.
                </td>
              </tr>
            )}
            {lines.map((line, index) => {
              const stock = stockAt[line.product_id];
              const recorded = toNumber(stock?.quantity);
              const free = toNumber(stock?.free_to_use);
              const qty = toNumber(line[qtyKey], NaN);
              const diff = Number.isNaN(qty) ? null : qty - recorded;
              const insufficient = showAvailability && line.product_id && !Number.isNaN(qty) && qty > free;
              const lineError = errors[index];
              return (
                <tr key={line.key || index} className={classNames(insufficient && 'bg-red-50/60')}>
                  <td className="td">
                    <Select
                      value={line.product_id}
                      onChange={(e) => update(index, { product_id: e.target.value })}
                      placeholder="Select product…"
                      invalid={Boolean(lineError?.product_id)}
                      aria-label="Product"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id} disabled={usedIds.has(p.id) && p.id !== line.product_id}>
                          {p.sku} — {p.name} ({p.unit_of_measure})
                        </option>
                      ))}
                    </Select>
                    {lineError?.product_id && <p className="mt-1 text-xs text-red-600">{lineError.product_id}</p>}
                  </td>
                  {mode === 'count' && <td className="td text-right tabular-nums">{line.product_id ? formatQty(recorded) : '—'}</td>}
                  {showAvailability && (
                    <td className={classNames('td text-right tabular-nums', insufficient ? 'font-semibold text-red-700' : 'text-slate-600')}>
                      {line.product_id ? formatQty(free) : '—'}
                    </td>
                  )}
                  <td className="td">
                    <Input
                      type="number"
                      min={mode === 'count' ? 0 : 0.001}
                      step="any"
                      inputMode="decimal"
                      value={line[qtyKey]}
                      onChange={(e) => update(index, { [qtyKey]: e.target.value })}
                      className="w-28 text-right tabular-nums ml-auto"
                      invalid={Boolean(lineError?.quantity) || insufficient}
                      aria-label={quantityLabel}
                    />
                    {lineError?.quantity && <p className="mt-1 text-right text-xs text-red-600">{lineError.quantity}</p>}
                    {insufficient && <p className="mt-1 text-right text-xs text-red-600">Exceeds free stock</p>}
                  </td>
                  {mode === 'count' && (
                    <td className={classNames('td text-right font-semibold tabular-nums', diff === null || diff === 0 ? 'text-slate-500' : diff > 0 ? 'text-emerald-700' : 'text-red-700')}>
                      {diff === null || !line.product_id ? '—' : formatQty(diff, { signed: true })}
                    </td>
                  )}
                  <td className="td text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Remove line">
                      <Trash2 className="h-4 w-4 text-slate-500" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button variant="secondary" size="sm" icon={Plus} onClick={add} disabled={products.length === 0}>
        Add product line
      </Button>
      {products.length === 0 && <p className="text-xs text-amber-700">No active products yet — create products first.</p>}
    </div>
  );
}
