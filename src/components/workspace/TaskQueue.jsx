import React from 'react';
import { Link } from 'react-router-dom';
import { Tag, ArrowRight, Clock3 } from 'lucide-react';
import { rupees } from '@/lib/evergreenData';

export default function TaskQueue({ offers, businesses, loading }) {
  const bizMap = Object.fromEntries((businesses || []).map(b => [b.id, b]));
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between px-4 h-12 border-b border-border">
        <div className="flex items-center gap-2">
          <Tag size={15} className="text-primary" />
          <h2 className="font-display text-[15px] font-semibold">Active task queue</h2>
        </div>
        <Link to="/offers" className="text-[11px] font-medium uppercase tracking-[0.05em] text-primary flex items-center gap-1">
          All offers <ArrowRight size={12} />
        </Link>
      </header>
      <div className="p-2">
        {loading ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-md bg-muted/60 animate-pulse" />)}
          </div>
        ) : offers.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted-foreground">No live offers. Create one to attract customers.</div>
        ) : (
          <ul className="divide-y divide-border">
            {offers.map(o => {
              const b = bizMap[o.business_id];
              const expired = o.ends_at && Date.parse(o.ends_at) < Date.now();
              return (
                <li key={o.id} className="flex items-center gap-3 px-2 py-3">
                  <span className={`w-1.5 h-10 rounded-full ${expired ? 'bg-muted-foreground/40' : 'bg-success'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold truncate">{o.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {b?.name || 'Unknown'} · {b?.locality || ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-semibold text-foreground">{rupees(o.max_saving_paise)}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                      <Clock3 size={10} />
                      {expired ? 'Expired' : `Ends ${new Date(o.ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}