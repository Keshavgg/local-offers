import { api } from '@/api/client';

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Search, Plus, Store, Tag, MessageSquare, Star } from 'lucide-react';

import MetricCard from '@/components/workspace/MetricCard';
import TaskQueue from '@/components/workspace/TaskQueue';
import ActivityFeed from '@/components/workspace/ActivityFeed';
import RecentFiles from '@/components/workspace/RecentFiles';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [biz, setBiz] = useState([]);
  const [offers, setOffers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [counts, setCounts] = useState({ places: 0, offers: 0, reviews: 0, avg: 0 });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [b, o, r, places, live, revCount, agg] = await Promise.all([
          api.entities.Business.filter({}, { sort: '-created_date', limit: 6, fields: ['name', 'entity_type', 'subtitle', 'locality', 'cover_url', 'rating', 'review_count', 'lat', 'lng'] }).catch(() => ({ items: [] })),
          api.entities.Offer.filter({ status: 'LIVE' }, { sort: '-created_date', limit: 8 }).catch(() => ({ items: [] })),
          api.entities.Review.filter({}, { sort: '-created_date', limit: 5 }).catch(() => ({ items: [] })),
          api.entities.Business.count().catch(() => 0),
          api.entities.Offer.count({ status: 'LIVE' }).catch(() => 0),
          api.entities.Review.count().catch(() => 0),
          api.entities.Review.aggregate({ avg: 'rating' }).catch(() => ({ rows: [] })),
        ]);
        if (!alive) return;
        const bItems = b.items || [];
        const oItems = o.items || [];
        const rItems = r.items || [];
        const avgRow = (agg?.rows || [])[0];
        setBiz(bItems);
        setOffers(oItems);
        setReviews(rItems);
        setCounts({
          places: typeof places === 'number' ? places : bItems.length,
          offers: typeof live === 'number' ? live : oItems.length,
          reviews: typeof revCount === 'number' ? revCount : rItems.length,
          avg: avgRow?.avg_rating ? Math.round(avgRow.avg_rating * 10) / 10 : 0,
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(query.trim() ? `/explore?q=${encodeURIComponent(query.trim())}` : '/explore');
  };

  return (
    <div className="px-4 md:px-8 py-5 md:py-7 max-w-[1280px] pb-24 md:pb-10">
      {/* Action bar */}
      <div className="flex items-center gap-3 mb-6">
        <form onSubmit={submitSearch} className="relative flex-1 max-w-md">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search places, dishes, services…"
            className="w-full h-11 pl-11 pr-4 rounded-lg border border-border bg-card text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
          />
        </form>
        <div className="ml-auto flex items-center gap-2">
          {user?.role === 'owner' && (
            <button
              onClick={() => navigate('/manage')}
              className="flex items-center gap-2 h-11 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition shadow-sm"
            >
              <Plus size={17} strokeWidth={2.4} /> <span className="hidden sm:inline">New place</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <MetricCard label="Places" value={counts.places} sub="Listed businesses" tone="primary" icon={Store} loading={loading} />
        <MetricCard label="Live offers" value={counts.offers} sub="Active right now" tone="success" icon={Tag} loading={loading} />
        <MetricCard label="Reviews" value={counts.reviews} sub="Customer feedback" tone="amber" icon={MessageSquare} loading={loading} />
        <MetricCard label="Avg rating" value={counts.avg ? counts.avg.toFixed(1) : '—'} sub="Across all places" tone="muted" icon={Star} loading={loading} />
      </div>

      {/* Bento: 65 / 35 */}
      <div className="grid lg:grid-cols-[1fr_380px] gap-4 md:gap-6">
        <div className="space-y-4 md:space-y-6 min-w-0">
          <TaskQueue offers={offers} businesses={biz} loading={loading} />
        </div>
        <div className="space-y-4 md:space-y-6 min-w-0">
          <ActivityFeed reviews={reviews} businesses={biz} loading={loading} />
          <RecentFiles businesses={biz} loading={loading} />
        </div>
      </div>
    </div>
  );
}