import React from 'react';
import { Link } from 'react-router-dom';
import { Star, MessageSquare } from 'lucide-react';

export default function ActivityFeed({ reviews, businesses, loading }) {
  const bizMap = Object.fromEntries((businesses || []).map(b => [b.id, b]));
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between px-4 h-11 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-primary" />
          <h2 className="font-display text-[14px] font-semibold">Activity feed</h2>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground">Recent</span>
      </header>
      <div className="p-3">
        {loading ? (
          <div className="space-y-3">
            {[0, 1].map(i => <div key={i} className="h-14 rounded-md bg-muted/60 animate-pulse" />)}
          </div>
        ) : reviews.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-muted-foreground">No reviews yet.</p>
        ) : (
          <ul className="space-y-3">
            {reviews.map(r => {
              const b = bizMap[r.business_id];
              return (
                <li key={r.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                    {(r.author || 'A')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] leading-snug">
                      <span className="font-semibold">{r.author || 'Anonymous'}</span>{' '}
                      <span className="text-muted-foreground">reviewed</span>{' '}
                      <Link to={b ? `/b/${b.id}` : '#'} className="font-medium text-primary hover:underline">{b?.name || 'a place'}</Link>
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} size={10} className={n <= r.rating ? 'text-amber-500 fill-amber-500' : 'text-border'} />
                      ))}
                      <span className="text-[10px] text-muted-foreground ml-1">{r.date ? new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</span>
                    </div>
                    {r.body && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{r.body}</p>}
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