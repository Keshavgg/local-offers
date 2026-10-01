import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ArrowUpRight, FileText } from 'lucide-react';
import { typeConfig, categories } from '@/lib/evergreenData';

export default function RecentFiles({ businesses, loading }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between px-4 h-11 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-primary" />
          <h2 className="font-display text-[14px] font-semibold">Recent places</h2>
        </div>
        <Link to="/" className="text-[10px] font-medium uppercase tracking-[0.05em] text-primary">Browse</Link>
      </header>
      <div className="p-2">
        {loading ? (
          <div className="space-y-2 p-1">
            {[0, 1, 2].map(i => <div key={i} className="h-12 rounded-md bg-muted/60 animate-pulse" />)}
          </div>
        ) : businesses.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-muted-foreground">No places yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {businesses.map(b => {
              const cfg = typeConfig[b.entity_type];
              const cat = categories.find(c => c.id === cfg?.category);
              return (
                <li key={b.id}>
                  <Link to={`/b/${b.id}`} className="flex items-center gap-3 px-2 py-2.5 hover:bg-accent/60 rounded-md transition">
                    <div className="w-9 h-9 rounded-md bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                      {b.cover_url ? <img src={b.cover_url} alt="" className="w-full h-full object-cover" /> : <FileText size={15} className="text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold truncate">{b.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{cat?.name || 'Place'} · {b.locality || 'Delhi'}</p>
                    </div>
                    {b.rating > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] font-semibold text-foreground">
                        <Star size={11} className="text-amber-500 fill-amber-500" />
                        {b.rating.toFixed(1)}
                      </span>
                    )}
                    <ArrowUpRight size={14} className="text-muted-foreground shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}