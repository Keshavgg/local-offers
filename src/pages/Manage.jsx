import { api } from '@/api/client';

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, Plus, Star, MapPin, Tag, Pause, Play, Trash2, Pencil } from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { typeConfig, categories } from '@/lib/evergreenData';
import OfferForm from '@/components/workspace/OfferForm';
import BusinessForm from '@/components/workspace/BusinessForm';

const STATE = {
  LIVE: ['Live', 'bg-emerald-100 text-emerald-700'],
  PAUSED: ['Paused', 'bg-muted text-muted-foreground'],
  SCHEDULED: ['Scheduled', 'bg-sky-100 text-sky-700'],
  EXPIRED: ['Expired', 'bg-muted text-muted-foreground'],
};

export default function Manage() {
  const { user } = useAuth();
  const [biz, setBiz] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(null); // null | { business? }
  const [offerFor, setOfferFor] = useState(null);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.entities.Business.filter({ owner_id: user.id }, { sort: '-created_date', limit: 100 });
      const list = res.items || [];
      setBiz(list);
      if (list.length) {
        const o = await api.entities.Offer.filter({ business_id: { $in: list.map(b => b.id) } }, { sort: '-created_date', limit: 500 });
        setOffers(o.items || []);
      } else setOffers([]);
    } catch (e) { setLoadError(e?.message || 'Could not load your places'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const act = async (fn, fail) => {
    try { await fn(); load(); } catch (e) { alert(e?.message || fail); }
  };
  const toggleOffer = (o) => act(() => api.entities.Offer.update(o.id, { status: o.status === 'PAUSED' ? 'LIVE' : 'PAUSED' }), 'Could not update the offer');
  const removeOffer = (o) => window.confirm(`Delete "${o.title}"?`) && act(() => api.entities.Offer.delete(o.id), 'Could not delete the offer');
  const removeBusiness = (b) => window.confirm(`Delete "${b.name}" with all its offers and reviews? This cannot be undone.`) && act(() => api.entities.Business.delete(b.id), 'Could not delete the place');

  return (
    <div className="px-4 md:px-8 py-5 md:py-7 max-w-[1280px] pb-24 md:pb-10">
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="flex items-center gap-2">
            <Store size={20} className="text-primary" />
            <h1 className="font-display text-[24px] md:text-[28px] font-bold tracking-tight">Manage</h1>
          </div>
          <p className="text-[13px] text-muted-foreground mt-1">Your business listings and offers.</p>
        </div>
        <button onClick={() => setForm({})} className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition">
          <Plus size={16} strokeWidth={2.4} /> <span className="hidden sm:inline">Add place</span>
        </button>
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-20 rounded-lg bg-muted/50 animate-pulse" />)}</div>
      ) : loadError ? (
        <div className="mt-6 rounded-lg border border-border bg-card py-12 text-center">
          <p className="text-[13px] text-destructive">{loadError}</p>
          <button onClick={load} className="mt-3 text-[13px] font-semibold text-primary">Try again</button>
        </div>
      ) : biz.length === 0 ? (
        <div className="mt-6 rounded-lg border border-border bg-card py-16 text-center">
          <Store size={28} className="mx-auto text-muted-foreground/50" />
          <p className="text-[13px] text-muted-foreground mt-3">You haven't listed a business yet.</p>
          <button onClick={() => setForm({})} className="mt-3 text-[13px] font-semibold text-primary">Add your first place →</button>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {biz.map(b => {
            const cfg = typeConfig[b.entity_type];
            const cat = categories.find(c => c.id === cfg?.category);
            const mine = offers.filter(o => o.business_id === b.id);
            return (
              <li key={b.id} className="rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 pr-3">
                  <Link to={`/b/${b.id}`} className="flex items-center gap-4 p-3.5 hover:bg-muted/30 rounded-tl-lg flex-1 min-w-0 transition">
                    <div className="w-14 h-14 rounded-md bg-muted overflow-hidden shrink-0">{b.cover_url && <img src={b.cover_url} alt="" className="w-full h-full object-cover" />}</div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-primary">{cat?.name || 'Place'}</span>
                      <h3 className="font-display text-[15px] font-semibold truncate">{b.name}</h3>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                        {b.rating > 0 && <span className="inline-flex items-center gap-1 font-semibold text-foreground"><Star size={11} className="text-amber-500 fill-amber-500" />{b.rating.toFixed(1)}</span>}
                        <span className="inline-flex items-center gap-1"><MapPin size={11} />{b.locality || '—'}</span>
                        <span>{b.review_count || 0} reviews</span>
                      </div>
                    </div>
                  </Link>
                  <button onClick={() => setForm({ business: b })} aria-label={`Edit ${b.name}`} className="p-2 text-muted-foreground hover:text-foreground"><Pencil size={16} /></button>
                  <button onClick={() => removeBusiness(b)} aria-label={`Delete ${b.name}`} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
                </div>
                <div className="border-t border-border px-3.5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Offers · {mine.length}</span>
                    <button onClick={() => setOfferFor(b)} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:underline">
                      <Tag size={13} /> Add offer
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {mine.map(o => {
                      const [text, tone] = STATE[o.status] || STATE.PAUSED;
                      return (
                        <li key={o.id} className="flex items-center gap-2 text-[13px]">
                          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${tone}`}>{text}</span>
                          <span className="truncate flex-1">{o.title}</span>
                          <span className="text-[11px] text-muted-foreground hidden sm:inline">ends {new Date(o.ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          {o.status !== 'EXPIRED' && (
                            <button onClick={() => toggleOffer(o)} aria-label={o.status === 'PAUSED' ? 'Resume offer' : 'Pause offer'} className="p-1 text-muted-foreground hover:text-foreground">
                              {o.status === 'PAUSED' ? <Play size={14} /> : <Pause size={14} />}
                            </button>
                          )}
                          <button onClick={() => removeOffer(o)} aria-label="Delete offer" className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {offerFor && <OfferForm business={offerFor} onClose={() => setOfferFor(null)} onSaved={() => { setOfferFor(null); load(); }} />}
      {form && <BusinessForm business={form.business} ownerName={user?.full_name} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
    </div>
  );
}
