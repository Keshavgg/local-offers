import { api } from '@/api/client';

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Star, MapPin } from 'lucide-react';

import { typeConfig, categories } from '@/lib/evergreenData';

export default function Saved() {
  const [biz, setBiz] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const ids = await api.saved.ids();
        if (!ids.length) { setBiz([]); return; }
        const res = await api.entities.Business.filter({ id: { $in: ids } }, { limit: 200 });
        const order = new Map(ids.map((id, i) => [id, i]));
        setBiz((res.items || []).sort((a, b) => order.get(a.id) - order.get(b.id)));
      } catch (e) { setError(e?.message || 'Could not load saved places'); }
      finally { setLoading(false); }
    })();
  }, []);

  const remove = async (id) => {
    setBiz(list => list.filter(b => b.id !== id));
    try { await api.saved.remove(id); } catch (e) { alert(e?.message || 'Could not remove'); }
  };

  return (
    <div className="px-4 md:px-8 py-5 md:py-7 max-w-[1280px] pb-24 md:pb-10">
      <div className="flex items-center gap-2 mb-1">
        <Bookmark size={20} className="text-primary" />
        <h1 className="font-display text-[24px] md:text-[28px] font-bold tracking-tight">Saved</h1>
      </div>
      <p className="text-[13px] text-muted-foreground mb-6">Places you've bookmarked for later.</p>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2].map(i => <div key={i} className="h-52 rounded-lg bg-muted/50 animate-pulse" />)}</div>
      ) : error ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-[13px] text-destructive">{error}</div>
      ) : biz.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <Bookmark size={28} className="mx-auto text-muted-foreground/50" />
          <p className="text-[13px] text-muted-foreground mt-3">No saved places yet.</p>
          <Link to="/explore" className="inline-block mt-3 text-[13px] font-semibold text-primary">Browse places →</Link>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {biz.map(b => {
            const cfg = typeConfig[b.entity_type];
            const cat = categories.find(c => c.id === cfg?.category);
            return (
              <li key={b.id} className="rounded-lg border border-border bg-card overflow-hidden">
                <Link to={`/b/${b.id}`} className="block">
                  <div className="h-32 bg-muted overflow-hidden">{b.cover_url && <img src={b.cover_url} alt="" className="w-full h-full object-cover" />}</div>
                  <div className="p-3.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-primary">{cat?.name}</span>
                    <h3 className="font-display text-[15px] font-semibold mt-0.5 truncate">{b.name}</h3>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-2">
                      {b.rating > 0 && <span className="inline-flex items-center gap-1 font-semibold text-foreground"><Star size={12} className="text-amber-500 fill-amber-500" />{b.rating.toFixed(1)}</span>}
                      <span className="inline-flex items-center gap-1"><MapPin size={12} />{b.locality}</span>
                    </div>
                  </div>
                </Link>
                <button onClick={() => remove(b.id)} className="w-full border-t border-border py-2 text-[11px] font-medium text-muted-foreground hover:text-destructive transition">Remove from saved</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
