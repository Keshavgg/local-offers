import { api } from '@/api/client';

import React, { useState } from 'react';
import { UserRound, MapPin, Phone, LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function Profile() {
  const { user, logout, checkUserAuth } = useAuth();
  const [name, setName] = useState(user?.full_name || '');
  const [locality, setLocality] = useState(user?.locality || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.auth.updateMe({ full_name: name.trim() || undefined, locality, phone });
      await checkUserAuth();
      setDone(true); setTimeout(() => setDone(false), 2000);
    } catch (e) { alert(e?.message || 'Could not save'); }
    setSaving(false);
  };

  const initial = (user?.full_name?.[0] || user?.email?.[0] || user?.phone?.[1] || 'U').toUpperCase();

  return (
    <div className="px-4 md:px-8 py-5 md:py-7 max-w-2xl pb-24 md:pb-10">
      <div className="flex items-center gap-2 mb-1">
        <UserRound size={20} className="text-primary" />
        <h1 className="font-display text-[24px] md:text-[28px] font-bold tracking-tight">Your profile</h1>
      </div>
      <p className="text-[13px] text-muted-foreground mb-6">Manage your account and preferences.</p>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[20px] font-display font-bold">{initial}</div>
          <div className="min-w-0">
            <h2 className="font-display text-[17px] font-semibold truncate">{user?.full_name || 'User'}</h2>
            <p className="text-[13px] text-muted-foreground truncate">{user?.email || user?.phone}</p>
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-primary"><Shield size={12} />{user?.role === 'owner' ? 'Shop owner' : 'Customer'}</span>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground flex items-center gap-1"><UserRound size={12} />Display name</label>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="Shown on your reviews" className="mt-1.5 w-full rounded-md border border-border px-3 py-2.5 text-[13px] outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground flex items-center gap-1"><MapPin size={12} />Locality</label>
            <input value={locality} onChange={e => setLocality(e.target.value)} placeholder="Your neighbourhood" className="mt-1.5 w-full rounded-md border border-border px-3 py-2.5 text-[13px] outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground flex items-center gap-1"><Phone size={12} />Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} disabled={user?.phone_verified && !user?.email} placeholder="Contact number" className="mt-1.5 w-full rounded-md border border-border px-3 py-2.5 text-[13px] outline-none focus:border-primary disabled:opacity-60" />
            {user?.phone && <p className="mt-1 text-[11px] text-muted-foreground">{user.phone_verified ? '✓ Verified through Telegram' : 'Not verified'}</p>}
          </div>
          <button onClick={save} disabled={saving} className="rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold px-5 py-2.5 hover:bg-primary/90 disabled:opacity-60">
            {done ? 'Saved!' : saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <button onClick={() => logout()} className="mt-4 flex items-center gap-2 text-[13px] font-medium text-muted-foreground hover:text-destructive transition">
        <LogOut size={15} /> Sign out
      </button>
    </div>
  );
}