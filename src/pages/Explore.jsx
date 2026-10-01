import { api } from '@/api/client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';

import { typeConfig } from '@/lib/evergreenData';
import CategoryStrip from '@/components/workspace/CategoryStrip';
import PlaceCard from '@/components/workspace/PlaceCard';

const categoryTypes = (catId) => Object.entries(typeConfig).filter(([, v]) => v.category === catId).map(([k]) => k);

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [cat, setCat] = useState('');
  const [loading, setLoading] = useState(true);
  const [biz, setBiz] = useState([]);
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState('');

  // keep the search box in step with the URL (Back/Forward, links)
  useEffect(() => { setQuery(params.get('q') || ''); }, [params]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      const q = {};
      if (query.trim()) q.name = { $regex: query.trim(), $options: 'i' };
      if (cat) q.entity_type = { $in: categoryTypes(cat) };
      try {
        const [b, o] = await Promise.all([
          api.entities.Business.filter(q, { sort: '-created_date', limit: 50 }),
          api.entities.Offer.filter({ status: 'LIVE' }, { sort: '-created_date', limit: 50 }),
        ]);
        if (!alive) return;
        const bItems = b.items || [];
        setBiz(bItems);
        setOffers(o.items || []);
      } catch (e) { if (alive) { setBiz([]); setOffers([]); setError(e?.message || 'Could not load places'); } }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [query, cat]);

  return (
    <div className="px-4 md:px-8 py-5 md:py-7 max-w-[1280px] pb-24 md:pb-10">
      <h1 className="font-display text-[24px] md:text-[28px] font-bold tracking-tight mb-1">Explore places</h1>
      <p className="text-[13px] text-muted-foreground mb-5">Discover businesses, offers and services near you.</p>

      <div className="relative mb-5 max-w-md">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setParams(e.target.value ? { q: e.target.value } : {}); }}
          placeholder="Search places, dishes, services…"
          className="w-full h-11 pl-11 pr-10 rounded-lg border border-border bg-card text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
        />
        {query && <button onClick={() => { setQuery(''); setParams({}); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={16} /></button>}
      </div>

      <div className="mb-6"><CategoryStrip value={cat} onChange={setCat} /></div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="h-64 rounded-lg bg-muted/50 animate-pulse" />)}</div>
      ) : error ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-destructive text-[13px]">{error}</div>
      ) : biz.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-muted-foreground text-[13px]">{query || cat ? 'No places found. Try a different search.' : 'No places have been listed yet.'}</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{biz.map(b => <PlaceCard key={b.id} business={b} offers={offers} />)}</div>
      )}
    </div>
  );
}