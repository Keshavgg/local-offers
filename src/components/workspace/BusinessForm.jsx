import React, { useState } from 'react';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '@/api/client';
import { typeConfig, categories } from '@/lib/evergreenData';

const input = 'w-full rounded-md border border-border px-3 py-2.5 text-[13px] outline-none focus:border-primary bg-card';
const label = 'text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground';

function Field({ title, children }) {
  return <div><label className={label}>{title}</label><div className="mt-1.5">{children}</div></div>;
}

const blankItem = () => ({ section: '', name: '', price: '', description: '', is_available: true });

// Create a business, or edit one when `business` is passed.
export default function BusinessForm({ business, ownerName, onClose, onSaved }) {
  const editing = !!business;
  const h0 = business?.hours?.[0];
  const [f, setF] = useState({
    name: business?.name || '',
    entity_type: business?.entity_type || 'restaurant',
    subtitle: business?.subtitle || '',
    locality: business?.locality || '',
    address: business?.address || '',
    phone: business?.phone || '',
    whatsapp: business?.whatsapp || '',
    cover_url: business?.cover_url || '',
    description: business?.description || '',
    open: h0?.open || '10:00',
    close: h0?.close || '21:00',
  });
  const [items, setItems] = useState((business?.items || []).map((i) => ({ ...i, price: i.price_paise ? String(i.price_paise / 100) : '' })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setItem = (n, k, v) => setItems((list) => list.map((it, i) => (i === n ? { ...it, [k]: v } : it)));
  const mainLabel = typeConfig[f.entity_type]?.main || 'Items';

  const save = async () => {
    setError('');
    if (!f.name.trim()) { setError('Enter the business name'); return; }
    const cleanItems = items.filter((i) => i.name.trim()).map(({ price, ...i }) => ({
      ...i,
      name: i.name.trim(), section: (i.section || '').trim(), description: (i.description || '').trim(),
      price_paise: Math.round(Number(price || 0) * 100),
    }));
    const payload = {
      name: f.name.trim(), entity_type: f.entity_type, subtitle: f.subtitle.trim(), locality: f.locality.trim(),
      address: f.address.trim(), phone: f.phone.trim(), whatsapp: f.whatsapp.trim(), cover_url: f.cover_url.trim(),
      description: f.description.trim(), hours: [{ open: f.open, close: f.close, label: 'Daily' }], items: cleanItems,
      ...(editing ? {} : { owner_name: ownerName || '' }),
    };
    setSaving(true);
    try {
      if (editing) await api.entities.Business.update(business.id, payload);
      else await api.entities.Business.create(payload);
      onSaved();
    } catch (e) {
      setError(e?.message || 'Could not save');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-lg rounded-t-lg sm:rounded-lg p-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-[18px] font-semibold">{editing ? 'Edit place' : 'Add a place'}</h2>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <Field title="Name"><input value={f.name} onChange={set('name')} className={input} placeholder="Business name" maxLength={100} /></Field>
          <Field title="Type">
            <select value={f.entity_type} onChange={set('entity_type')} className={input}>
              {Object.entries(typeConfig).map(([k, v]) => <option key={k} value={k}>{k.replace('_', ' ')} · {categories.find((c) => c.id === v.category)?.name}</option>)}
            </select>
          </Field>
          <Field title="Subtitle"><input value={f.subtitle} onChange={set('subtitle')} className={input} placeholder="One-line description" maxLength={160} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field title="Locality"><input value={f.locality} onChange={set('locality')} className={input} placeholder="Neighbourhood" maxLength={80} /></Field>
            <Field title="Phone"><input value={f.phone} onChange={set('phone')} className={input} placeholder="+91 …" maxLength={20} inputMode="tel" /></Field>
          </div>
          <Field title="Address"><input value={f.address} onChange={set('address')} className={input} placeholder="Street, area, city" maxLength={300} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field title="WhatsApp"><input value={f.whatsapp} onChange={set('whatsapp')} className={input} placeholder="+91 …" maxLength={20} inputMode="tel" /></Field>
            <Field title="Cover photo link"><input value={f.cover_url} onChange={set('cover_url')} className={input} placeholder="https://…" maxLength={500} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field title="Opens"><input type="time" value={f.open} onChange={set('open')} className={input} /></Field>
            <Field title="Closes"><input type="time" value={f.close} onChange={set('close')} className={input} /></Field>
          </div>
          <Field title="About"><textarea value={f.description} onChange={set('description')} rows={3} maxLength={2000} className={`${input} resize-none`} placeholder="Tell customers about this place" /></Field>

          <div className="pt-1">
            <div className="flex items-center justify-between">
              <span className={label}>{mainLabel}</span>
              <button type="button" onClick={() => setItems((l) => [...l, blankItem()])} className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary"><Plus size={13} /> Add</button>
            </div>
            <div className="mt-2 space-y-2">
              {items.map((it, n) => (
                <div key={n} className="rounded-md border border-border p-2.5 space-y-2">
                  <div className="grid grid-cols-[1fr_90px_auto] gap-2 items-center">
                    <input value={it.name} onChange={(e) => setItem(n, 'name', e.target.value)} placeholder="Name" className={input} maxLength={100} />
                    <input value={it.price} onChange={(e) => setItem(n, 'price', e.target.value)} placeholder="₹ price" type="number" min="0" className={input} />
                    <button type="button" onClick={() => setItems((l) => l.filter((_, i) => i !== n))} aria-label="Remove item" className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={15} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={it.section} onChange={(e) => setItem(n, 'section', e.target.value)} placeholder="Section (e.g. Starters)" className={input} maxLength={50} />
                    <input value={it.description} onChange={(e) => setItem(n, 'description', e.target.value)} placeholder="Short description" className={input} maxLength={300} />
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <input type="checkbox" checked={it.is_available !== false} onChange={(e) => setItem(n, 'is_available', e.target.checked)} /> Available today
                  </label>
                </div>
              ))}
              {items.length === 0 && <p className="text-[12px] text-muted-foreground">Nothing listed yet.</p>}
            </div>
          </div>

          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-[13px]">{error}</div>}
          <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold py-3 hover:bg-primary/90 disabled:opacity-60">
            {saving && <Loader2 size={18} className="animate-spin" />} {editing ? 'Save changes' : 'Create place'}
          </button>
        </div>
      </div>
    </div>
  );
}
