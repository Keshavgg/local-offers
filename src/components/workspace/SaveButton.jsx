import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { api } from '@/api/client';

// Saved place ids live on the server (per user); this module keeps one shared copy
// so every button on the page stays in sync.
let cache = null;
const listeners = new Set();
const publish = (ids) => { cache = ids; listeners.forEach((fn) => fn(ids)); };

export function useSaved() {
  const [ids, setIds] = useState(cache || []);
  useEffect(() => {
    listeners.add(setIds);
    if (cache) setIds(cache);
    else api.saved.ids().then(publish).catch(() => {});
    return () => { listeners.delete(setIds); };
  }, []);

  const toggle = async (businessId) => {
    const before = cache || [];
    const has = before.includes(businessId);
    publish(has ? before.filter((x) => x !== businessId) : [businessId, ...before]);
    try {
      await (has ? api.saved.remove(businessId) : api.saved.add(businessId));
    } catch {
      publish(before); // revert if the server rejected it
    }
  };
  return { ids, toggle };
}

export default function SaveButton({ businessId, className = '' }) {
  const { ids, toggle } = useSaved();
  const saved = ids.includes(businessId);
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(businessId); }}
      aria-label={saved ? 'Remove from saved' : 'Save place'}
      aria-pressed={saved}
      className={`w-8 h-8 rounded-full bg-card/95 border border-border flex items-center justify-center hover:border-primary transition ${className}`}
    >
      <Bookmark size={15} className={saved ? 'text-primary fill-primary' : 'text-muted-foreground'} />
    </button>
  );
}
