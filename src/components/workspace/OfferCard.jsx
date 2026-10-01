import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock3 } from 'lucide-react';
import { rupees, discountFor } from '@/lib/evergreenData';

export default function OfferCard({ offer, business }) {
  const [bill, setBill] = useState('');
  const b = business;
  if (!b) return null;
  const amount = Math.max(0, Math.round(Number(bill || 0) * 100));
  const saving = discountFor(offer, amount);
  return (
    <article className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex gap-3 p-3.5">
        <div className="w-16 h-16 rounded-md bg-muted overflow-hidden shrink-0">
          {b.cover_url ? <img src={b.cover_url} alt="" className="w-full h-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-muted-foreground truncate">{b.name} · {b.locality}</p>
          <h3 className="font-display text-[15px] font-semibold mt-0.5 leading-tight">{offer.title}</h3>
          <p className="text-[11px] text-muted-foreground mt-1">{offer.terms}</p>
        </div>
      </div>
      <div className="mx-3.5 mb-3 rounded-md bg-primary/5 flex justify-between items-center px-3 py-2">
        <span className="text-[12px] font-medium text-muted-foreground">You save up to</span>
        <span className="font-display text-[16px] font-bold text-primary">{rupees(offer.max_saving_paise)}</span>
      </div>
      <div className="px-3.5 pb-3.5">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-2.5">
          <Clock3 size={12} /> Valid until {offer.ends_at ? new Date(offer.ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
        </div>
        <details className="group border-t border-border pt-2.5">
          <summary className="cursor-pointer text-[12px] font-medium text-primary">Check my bill</summary>
          <div className="mt-2.5">
            <input
              type="number"
              min="0"
              value={bill}
              onChange={e => setBill(e.target.value)}
              placeholder="Bill amount (₹)"
              className="w-full rounded-md border border-border px-3 py-2 text-[13px] outline-none focus:border-primary"
            />
            <div className="flex justify-between mt-2 text-[12px]">
              <span className="text-muted-foreground">You save <b className="text-foreground">{rupees(saving)}</b></span>
              <span className="text-muted-foreground">Pay <b className="text-foreground">{rupees(amount - saving)}</b></span>
            </div>
          </div>
        </details>
        <Link to={`/b/${b.id}`} className="mt-2.5 flex items-center justify-between text-[12px] font-semibold text-primary">
          View place <ArrowUpRight size={15} />
        </Link>
      </div>
    </article>
  );
}