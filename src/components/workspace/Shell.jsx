import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Compass, Tag, Bookmark, Store, UserRound, Plus, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const links = [
  ['/', 'Home', LayoutDashboard],
  ['/explore', 'Explore', Compass],
  ['/offers', 'Offers', Tag],
  ['/saved', 'Saved', Bookmark],
  ['/manage', 'Manage', Store],
  ['/profile', 'You', UserRound],
];

export default function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const visibleLinks = links.filter(([to]) => to !== '/manage' || user?.role === 'owner');
  const initial = (user?.full_name?.[0] || user?.email?.[0] || user?.phone?.[1] || 'E').toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex">
        {/* Desktop dock */}
        <aside className="hidden md:flex w-60 shrink-0 h-screen sticky top-0 border-r border-border bg-card flex-col">
          <Link to="/" className="flex items-center gap-2.5 px-5 pt-7 pb-2">
            <span className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Compass size={20} strokeWidth={2.2} />
            </span>
            <span className="font-display font-bold text-[17px] tracking-tight text-foreground">evergreen</span>
          </Link>
          <p className="px-5 pb-6 text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">Workspace</p>

          <nav className="px-3 space-y-1">
            {visibleLinks.map(([to, label, Icon]) => (
              <NavLink
                key={to}
                end={to === '/'}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition ${
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`
                }
              >
                <Icon size={18} strokeWidth={2} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto p-3 border-t border-border">
            <div className="flex items-center gap-3 p-2">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate">{user?.full_name || 'User'}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.locality || 'Delhi NCR'}</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="mt-1 w-full flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground py-2 hover:text-destructive transition"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </aside>

        {/* Mobile header */}
        <header className="md:hidden fixed top-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-b border-border">
          <div className="flex items-center justify-between px-4 h-14">
            <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="p-2 -ml-2 text-foreground">
              <Menu size={22} />
            </button>
            <Link to="/" className="flex items-center gap-2 font-display font-bold tracking-tight">
              <span className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                <Compass size={16} strokeWidth={2.2} />
              </span>
              evergreen
            </Link>
            {user?.role === 'owner' ? (
              <button
                onClick={() => navigate('/manage')}
                aria-label="Create"
                className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"
              >
                <Plus size={18} />
              </button>
            ) : <span className="w-9 h-9" />}
          </div>
        </header>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-foreground/40" onClick={() => setMobileOpen(false)} />
            <div className="relative w-72 max-w-[80vw] bg-card border-r border-border flex flex-col">
              <div className="flex items-center justify-between px-5 h-14 border-b border-border">
                <span className="font-display font-bold">evergreen</span>
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={20} /></button>
              </div>
              <nav className="p-3 space-y-1">
                {visibleLinks.map(([to, label, Icon]) => (
                  <NavLink
                    key={to}
                    end={to === '/'}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`
                    }
                  >
                    <Icon size={18} /> {label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <div className="md:hidden h-14" />
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border flex justify-around pb-[env(safe-area-inset-bottom)]">
        {visibleLinks.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            end={to === '/'}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 min-w-[60px] h-14 text-[10px] font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`
            }
          >
            <Icon size={20} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}