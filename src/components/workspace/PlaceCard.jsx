import React from 'react';
import { Link } from 'react-router-dom';
import { Star, MapPin, ArrowUpRight, Sparkles } from 'lucide-react';
import { typeConfig, categories, distanceLabel, isOpen } from '@/lib/evergreenData';
import SaveButton from '@/components/workspace/SaveButton';

export default function PlaceCard({ business: b, distance, offers }) {
  const cfg = typeConfig[b.entity_type];
  const category = categories.find(c => c.id === cfg?.category);
  const offer = (offers || []).find(o => o.business_id === b.id);
  const religious = cfg?.template === 'RELIGIOUS';
  return (
    <div className="relative">
    <Link to={`/b/${b.id}`} className="group block rounded-lg border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all">
      <div className="relative h-36 bg-muted overflow-hidden">
        {b.cover_url ? (
          <img src={b.cover_url} loading="lazy" alt={b.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[12px]">No photo</div>
        )}
        <span className="absolute top-2.5 left-2.5 rounded-md bg-card/95 px-2 py-0.5 text-[10px] font-semibold text-foreground border border-border">{category?.name || 'Place'}</span>
        <span className={`absolute top-2.5 right-2.5 rounded-md px-2 py-0.5 text-[10px] font-semibold ${isOpen(b) ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
          {isOpen(b) ? (religious ? 'Darshan open' : 'Open now') : 'Closed'}
        </span>
      </div>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-[15px] font-semibold leading-tight truncate">{b.name}</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{b.subtitle}</p>
          </div>
          <ArrowUpRight size={16} className="text-muted-foreground shrink-0 group-hover:text-primary" />
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-3">
          {b.review_count > 0 && b.rating > 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-foreground"><Star size={12} className="text-amber-500 fill-amber-500" />{b.rating.toFixed(1)}</span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-primary"><Sparkles size={12} />New</span>
          )}
          {distance != null && <span className="inline-flex items-center gap-1"><MapPin size={12} />{distanceLabel(distance)}</span>}
          <span className="truncate">{b.locality}</span>
        </div>
        {offer && <div className="mt-2.5 pt-2.5 border-t border-border text-[11px] font-medium text-primary">✦ {offer.title}</div>}
      </div>
    </Link>
    <SaveButton businessId={b.id} className="absolute right-2.5 top-[6.5rem]" />
    </div>
  );
}