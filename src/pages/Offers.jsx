import { api } from '@/api/client';

import React, { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';

import OfferCard from '@/components/workspace/OfferCard';

export default function Offers() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offers, setOffers] = useState([]);
  const [biz, setBiz] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const o = await api.entities.Offer.filter({ status: 'LIVE' }, { sort: '-created_date', limit: 100 });
        const items = o.items || [];
        const ids = [...new Set(items.map(x => x.business_id))];
        const b = ids.length ? await api.entities.Business.filter({ id: { $in: ids } }, { limit: 200 }) : { items: [] };
        if (!alive) return;
        setOffers(items);
        setBiz(b.items || []);
      } catch (e) { if (alive) setError(e?.message || 'Could not load offers'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const bizMap = Object.fromEntries(biz.map(b => [b.id, b]));

  return (
    <div className="px-4 md:px-8 py-5 md:py-7 max-w-[1280px] pb-24 md:pb-10">
      <div className="flex items-center gap-2 mb-1">
        <Tag size={20} className="text-primary" />
        <h1 className="font-display text-[24px] md:text-[28px] font-bold tracking-tight">Offers</h1>
      </div>
      <p className="text-[13px] text-muted-foreground mb-6">Live deals and discounts from local places.</p>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-64 rounded-lg bg-muted/50 animate-pulse" />)}</div>
      ) : error ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-destructive text-[13px]">{error}</div>
      ) : offers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-muted-foreground text-[13px]">No live offers right now.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map(o => <OfferCard key={o.id} offer={o} business={bizMap[o.business_id]} />)}
        </div>
      )}
    </div>
  );
}
