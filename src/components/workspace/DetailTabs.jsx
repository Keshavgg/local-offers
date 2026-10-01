import { api } from '@/api/client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Clock3, MapPin, Star } from 'lucide-react';

import OfferCard from '@/components/workspace/OfferCard';
import { typeConfig } from '@/lib/evergreenData';

const priceNote = 'Prices set by the shop; may vary. Confirm with the store.';

export default function DetailTabs({ business: b, tab, offers, reviews, onReviewAdded }) {
  const { user } = useAuth();
  const isOwner = !!user && user.id === b.owner_id;
  const hasReviewed = !!user && (reviews || []).some(r => r.owner_id === user.id);
  const cfg = typeConfig[b.entity_type];
  const mine = (offers || []).filter(o => o.business_id === b.id);

  if (tab === 'Offers' || tab === 'Deals') {
    return mine.length ? (
      <div className="grid sm:grid-cols-2 gap-4">{mine.map(o => <OfferCard key={o.id} offer={o} business={b} />)}</div>
    ) : <Empty text="No live offers right now" />;
  }

  if (tab === 'Reviews') {
    const list = (reviews || []).filter(r => r.business_id === b.id);
    return (
      <div className="space-y-4">
        {list.length ? (
          <div className="space-y-3">
            {list.map(r => (
              <div key={r.id} className="p-4 rounded-lg bg-card border border-border">
                <div className="flex justify-between">
                  <strong className="text-[13px]">{r.author || 'Anonymous'}</strong>
                  <span className="text-[11px] text-muted-foreground">{r.date ? new Date(r.date).toLocaleDateString('en-IN') : ''}</span>
                </div>
                <p className="text-amber-500 text-[13px] mt-1">{'★'.repeat(r.rating)}</p>
                <p className="text-[13px] text-muted-foreground mt-2">{r.body}</p>
                {r.reply && <p className="mt-3 p-3 rounded-md bg-muted text-[13px]"><b>Response from owner</b><br />{r.reply}</p>}
                {isOwner && <ReplyForm review={r} onSaved={onReviewAdded} />}
                {user && r.owner_id === user.id && (
                  <button
                    onClick={async () => { if (!window.confirm('Delete your review?')) return; try { await api.entities.Review.delete(r.id); onReviewAdded?.(); } catch (e) { alert(e?.message || 'Could not delete'); } }}
                    className="mt-2 text-[11px] font-medium text-muted-foreground hover:text-destructive"
                  >Delete my review</button>
                )}
              </div>
            ))}
          </div>
        ) : <Empty text="No reviews yet" />}
        {isOwner ? <p className="text-[12px] text-muted-foreground">You can reply to reviews on your own place, but you can't review it.</p>
          : hasReviewed ? <p className="text-[12px] text-muted-foreground">You've reviewed this place.</p>
          : <ReviewForm businessId={b.id} onSaved={onReviewAdded} />}
      </div>
    );
  }

  if (tab === 'Info') {
    return (
      <div className="rounded-lg border border-border bg-card p-5 space-y-5 text-[13px]">
        <div className="flex gap-3"><MapPin size={18} className="text-primary shrink-0" /><div><b>Address</b><p className="text-muted-foreground mt-1">{b.address}</p></div></div>
        <div className="flex gap-3"><Clock3 size={18} className="text-primary shrink-0" /><div><b>Timings · IST</b>{(b.hours || []).map((h, i) => <p key={i} className="text-muted-foreground mt-1">{h.label ? `${h.label} · ` : ''}{h.open} – {h.close}</p>)}</div></div>
        <div><b>About</b><p className="text-muted-foreground mt-1">{b.description}</p></div>
        <p className="text-[11px] text-muted-foreground">{priceNote}</p>
      </div>
    );
  }

  if (tab === 'Events') return <Empty text="No upcoming events listed" />;
  if (tab === 'Schedule') return <div className="rounded-lg border border-border bg-card p-5"><h3 className="font-display font-semibold">Weekly classes</h3><p className="text-[13px] text-muted-foreground mt-2">Contact the studio for the current class schedule.</p></div>;

  if (tab === 'Timings & Puja') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-display font-semibold text-[16px]">Darshan & prayer timings</h3>
          {(b.hours || []).map((h, i) => (
            <div key={i} className="flex justify-between py-3 border-b border-border text-[13px]"><span>{h.label || 'Session'}</span><b>{h.open} – {h.close}</b></div>
          ))}
          <p className="text-[11px] text-muted-foreground mt-3">Timings may change on special days. Contact before visiting.</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-display font-semibold">Puja & seva</h3>
          {(b.items || []).map((i, n) => (
            <div key={i.id || n} className="py-3 border-b border-border last:border-0">
              <b className="text-[13px]">{i.name}</b>
              <p className="text-[11px] text-muted-foreground mt-1">{i.description}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const content = ['Plans', 'Products', 'Catalog', 'Services', 'Menu', 'Items'].includes(tab);
  if (content) {
    return (b.items || []).length ? (
      <div>
        <div className={cfg?.template === 'RETAIL_CATALOG' ? 'grid sm:grid-cols-2 gap-3' : 'space-y-3'}>
          {(b.items || []).map((i, n) => (
            <div key={i.id || n} className="flex justify-between gap-3 rounded-lg bg-card border border-border p-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-primary">{i.section}</p>
                <h3 className="font-display font-semibold text-[14px] mt-1">{i.name}</h3>
                <p className="text-[11px] text-muted-foreground mt-1">{i.description}</p>
                {i.is_available === false && <p className="text-[11px] text-destructive mt-2">Unavailable today</p>}
              </div>
              {cfg?.template !== 'RELIGIOUS' && <b className="shrink-0 text-[13px]">{i.price_paise ? `₹${Math.round(i.price_paise / 100)}` : ''}</b>}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-4">{priceNote}</p>
      </div>
    ) : <Empty text={`No ${cfg?.main?.toLowerCase() || 'items'} listed yet`} />;
  }
  return <Empty text="Nothing listed here yet" />;
}

function ReviewForm({ businessId, onSaved }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await api.entities.Review.create({ business_id: businessId, rating: Number(rating), body: body.trim() });
      setBody(''); setRating(5); setOpen(false); onSaved?.();
    } catch (e) { alert(e?.message || 'Could not post review'); }
    setSaving(false);
  };
  if (!open) return <button onClick={() => setOpen(true)} className="w-full rounded-lg border border-dashed border-border py-3 text-[13px] font-semibold text-primary hover:bg-accent">+ Write a review</button>;
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h3 className="font-display text-[14px] font-semibold">Write a review</h3>
      <div className="flex gap-1">{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setRating(n)}><Star size={20} className={n <= rating ? 'text-amber-500 fill-amber-500' : 'text-border'} /></button>)}</div>
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Share your experience…" className="w-full rounded-md border border-border px-3 py-2 text-[13px] outline-none focus:border-primary resize-none" />
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving} className="text-[13px] font-semibold text-primary-foreground bg-primary rounded-md px-4 py-2 disabled:opacity-60">{saving ? 'Posting…' : 'Post review'}</button>
        <button onClick={() => setOpen(false)} className="text-[13px] font-medium text-muted-foreground px-2">Cancel</button>
      </div>
    </div>
  );
}

function Empty({ text }) { return <div className="rounded-lg border border-border bg-card py-14 px-5 text-center text-muted-foreground text-[13px]">{text}</div>; }
function ReplyForm({ review, onSaved }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(review.reply || '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await api.entities.Review.update(review.id, { reply: text.trim() }); setOpen(false); onSaved?.(); }
    catch (e) { alert(e?.message || 'Could not save the reply'); }
    setSaving(false);
  };
  if (!open) return <button onClick={() => setOpen(true)} className="mt-2 text-[12px] font-semibold text-primary">{review.reply ? 'Edit reply' : 'Reply'}</button>;
  return (
    <div className="mt-3 space-y-2">
      <textarea value={text} onChange={e => setText(e.target.value)} rows={2} maxLength={1000} placeholder="Reply to this review…" className="w-full rounded-md border border-border px-3 py-2 text-[13px] outline-none focus:border-primary resize-none" />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="text-[12px] font-semibold text-primary-foreground bg-primary rounded-md px-3 py-1.5 disabled:opacity-60">{saving ? 'Saving…' : 'Post reply'}</button>
        <button onClick={() => setOpen(false)} className="text-[12px] text-muted-foreground px-2">Cancel</button>
      </div>
    </div>
  );
}
