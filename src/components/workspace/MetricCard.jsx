import React from 'react';

export default function MetricCard({ label, value, sub, tone = 'primary', icon: Icon, loading }) {
  const toneMap = {
    primary: 'text-primary',
    success: 'text-success',
    amber: 'text-amber-500',
    muted: 'text-muted-foreground',
  };
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col justify-between min-h-[104px]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">{label}</span>
        {Icon && <Icon size={15} className={toneMap[tone]} strokeWidth={2} />}
      </div>
      <div>
        {loading ? (
          <div className="h-8 w-16 rounded-md bg-muted/60 animate-pulse" />
        ) : (
          <p className={`font-display text-[32px] font-bold leading-none tracking-tight ${toneMap[tone]}`}>{value}</p>
        )}
        {sub && <p className="mt-1.5 text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}