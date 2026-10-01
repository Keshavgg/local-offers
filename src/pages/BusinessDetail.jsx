import { api } from '@/api/client';

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, Phone, MessageCircle } from 'lucide-react';

import { typeConfig, categories, isOpen } from '@/lib/evergreenData';
import SaveButton from '@/components/workspace/SaveButton';
import DetailTabs from '@/components/workspace/DetailTabs';

export default function BusinessDetail() {
  const { id } = useParams();
  const [b, setB] = useState(null);
  const [offers, setOffers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [tab, setTab] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [biz, o, r] = await Promise.all([
        api.entities.Business.get(id).catch(() => null),
        api.entities.Offer.filter({ business_id: id }, { sort: '-created_date', limit: 50 }).catch(() => ({ items: [] })),
        api.entities.Review.filter({ business_id: id }, { sort: '-created_date', limit: 50 }).catch(() => ({ items: [] })),
      ]);
      const found = biz;
      setB(found);
      setOffers((o.items || []).filter(x => x.status === 'LIVE'));
      setReviews(r.items || []);
      const cfg = typeConfig[found?.entity_type];
      setTab(prev => (silent && prev) ? prev : (cfg?.tabs?.[0] || 'Info')); // keep the current tab on refresh
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="px-8 py-20 text-center text-muted-foreground text-[13px]">Loading…</div>;
  if (!b) return <div className="px-8 py-20 text-center text-muted-foreground text-[13px]">Place not found. <Link to="/explore" className="text-primary">Browse places</Link></div>;

  const cfg = typeConfig[b.entity_type];
  const category = categories.find(c => c.id === cfg?.category);

  return (
    <div className="pb-24 md:pb-10">
      <div className="relative h-44 md:h-64 bg-muted overflow-hidden">
        {b.cover_url && <img src={b.cover_url} alt={b.name} className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
        <Link to="/explore" className="absolute top-4 left-4 flex items-center gap-1.5 rounded-md bg-card/95 px-3 py-1.5 text-[12px] font-medium border border-border">
          <ArrowLeft size={14} /> Back
        </Link>
      </div>

      <div className="px-4 md:px-8 max-w-[1280px] -mt-8 relative">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-primary">{category?.name || 'Place'}</span>
              <h1 className="font-display text-[22px] md:text-[26px] font-bold tracking-tight mt-0.5">{b.name}</h1>
              <p className="text-[13px] text-muted-foreground mt-1">{b.subtitle}</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${isOpen(b) ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                {isOpen(b) ? 'Open now' : 'Closed'}
              </span>
              <SaveButton businessId={b.id} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-[12px] text-muted-foreground">
            {b.rating > 0 && <span className="inline-flex items-center gap-1 font-semibold text-foreground"><Star size={13} className="text-amber-500 fill-amber-500" />{b.rating.toFixed(1)} <span className="text-muted-foreground font-normal">({b.review_count || 0})</span></span>}
            <span className="inline-flex items-center gap-1"><MapPin size={13} />{b.locality}</span>
            {b.phone && <a href={`tel:${b.phone}`} className="inline-flex items-center gap-1 hover:text-primary"><Phone size={13} />{b.phone}</a>}
            {b.whatsapp && <a href={`https://wa.me/${b.whatsapp.replace(/\D/g, '')}`} className="inline-flex items-center gap-1 hover:text-success"><MessageCircle size={13} />WhatsApp</a>}
          </div>
        </div>

        <div className="flex gap-1 mt-5 border-b border-border overflow-x-auto scrollbar-hide">
          {(cfg?.tabs || ['Info']).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 -mb-px transition ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <DetailTabs business={b} tab={tab} offers={offers} reviews={reviews} onReviewAdded={() => load(true)} />
        </div>
      </div>
    </div>
  );
}