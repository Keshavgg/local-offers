import React, { useState } from 'react';
import { X, Loader2, Tag } from 'lucide-react';
import { api } from '@/api/client';

const input = 'w-full rounded-md border border-border px-3 py-2.5 text-[13px] outline-none focus:border-primary bg-card';
const label = 'text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground';

const TYPES = [
  ['PERCENT', 'Percent off'],
  ['FLAT', 'Flat amount off'],
  ['BOGO', 'Buy X get Y free'],
];

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const paise = (rupees) => Math.round(Number(rupees) * 100);

function Field({ title, children }) {
  return <div><label className={label}>{title}</label><div className="mt-1.5">{children}</div></div>;
}

export default function OfferForm({ business, onClose, onSaved }) {
  const [type, setType] = useState('PERCENT');
  const [title, setTitle] = useState('');
  const [percent, setPercent] = useState('20');
  const [maxDiscount, setMaxDiscount] = useState('150');
  const [flat, setFlat] = useState('50');
  const [minOrder, setMinOrder] = useState('300');
  const [buyQty, setBuyQty] = useState('2');
  const [getQty, setGetQty] = useState('1');
  const [itemPrice, setItemPrice] = useState('60');
  const [starts, setStarts] = useState(today());
  const [ends, setEnds] = useState(inDays(14));
  const [terms, setTerms] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const num = (v) => Number(v);

  const build = () => {
    if (!title.trim()) return 'Give the offer a title';
    if (!starts || !ends) return 'Choose start and end dates';
    if (ends < starts) return 'The end date must be after the start date';
    if (type === 'PERCENT') {
      if (!(num(percent) > 0 && num(percent) <= 100)) return 'Percent must be between 1 and 100';
      if (!(num(maxDiscount) > 0)) return 'Set a maximum discount in ₹';
      return { config: { percent: num(percent), max_discount: paise(maxDiscount), min_order: paise(minOrder || 0) }, max_saving_paise: paise(maxDiscount) };
    }
    if (type === 'FLAT') {
      if (!(num(flat) > 0)) return 'Enter the discount amount in ₹';
      return { config: { flat_amount: paise(flat), min_order: paise(minOrder || 0) }, max_saving_paise: paise(flat) };
    }
    if (!(num(buyQty) >= 1 && num(getQty) >= 1)) return 'Quantities must be at least 1';
    if (!(num(itemPrice) > 0)) return 'Enter the item price in ₹';
    return { config: { buy_qty: num(buyQty), get_qty: num(getQty), item_price: paise(itemPrice) }, max_saving_paise: paise(itemPrice) * num(getQty) };
  };

  const save = async () => {
    setError('');
    const built = build();
    if (typeof built === 'string') { setError(built); return; }
    setSaving(true);
    try {
      await api.entities.Offer.create({
        business_id: business.id,
        title: title.trim(),
        type,
        ...built,
        starts_at: new Date(`${starts}T00:00:00`).toISOString(),
        ends_at: new Date(`${ends}T23:59:00`).toISOString(),
        status: 'LIVE',
        terms: terms.trim(),
      });
      onSaved();
    } catch (e) {
      setError(e?.message || 'Could not create the offer');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-md rounded-t-lg sm:rounded-lg p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-[18px] font-semibold">Add an offer</h2>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <p className="text-[12px] text-muted-foreground mb-4">For {business.name}</p>

        <div className="space-y-3">
          <Field title="Offer type">
            <select value={type} onChange={(e) => setType(e.target.value)} className={input}>
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field title="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} placeholder="e.g. 20% off on weekdays" />
          </Field>

          {type === 'PERCENT' && (
            <div className="grid grid-cols-2 gap-3">
              <Field title="Percent off"><input type="number" min="1" max="100" value={percent} onChange={(e) => setPercent(e.target.value)} className={input} /></Field>
              <Field title="Max discount (₹)"><input type="number" min="1" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} className={input} /></Field>
            </div>
          )}
          {type === 'FLAT' && (
            <Field title="Discount (₹)"><input type="number" min="1" value={flat} onChange={(e) => setFlat(e.target.value)} className={input} /></Field>
          )}
          {type === 'BOGO' && (
            <div className="grid grid-cols-3 gap-3">
              <Field title="Buy"><input type="number" min="1" value={buyQty} onChange={(e) => setBuyQty(e.target.value)} className={input} /></Field>
              <Field title="Get free"><input type="number" min="1" value={getQty} onChange={(e) => setGetQty(e.target.value)} className={input} /></Field>
              <Field title="Item price (₹)"><input type="number" min="1" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className={input} /></Field>
            </div>
          )}
          {type !== 'BOGO' && (
            <Field title="Minimum bill (₹)"><input type="number" min="0" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} className={input} /></Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field title="Starts"><input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} className={input} /></Field>
            <Field title="Ends"><input type="date" value={ends} min={starts} onChange={(e) => setEnds(e.target.value)} className={input} /></Field>
          </div>
          <Field title="Terms (optional)">
            <input value={terms} onChange={(e) => setTerms(e.target.value)} className={input} placeholder="e.g. Dine-in only" />
          </Field>

          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-[13px]">{error}</div>}

          <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold py-3 hover:bg-primary/90 disabled:opacity-60">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Tag size={16} />} Publish offer
          </button>
        </div>
      </div>
    </div>
  );
}
