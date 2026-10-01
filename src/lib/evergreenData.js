// Evergreen domain data + helpers. Powers the Precision Workspace shell.

export const categories = [
  { id: 'food', name: 'Food', icon: 'UtensilsCrossed', color: '#E56B22' },
  { id: 'religious', name: 'Temples', icon: 'Landmark', color: '#7954A8' },
  { id: 'retail', name: 'Shopping', icon: 'Shirt', color: '#2563EB' },
  { id: 'electronics', name: 'Electronics', icon: 'Smartphone', color: '#0EA5E9' },
  { id: 'salon', name: 'Salon', icon: 'Scissors', color: '#EC4899' },
  { id: 'grocery', name: 'Grocery', icon: 'ShoppingBasket', color: '#10B981' },
  { id: 'gym', name: 'Fitness', icon: 'Dumbbell', color: '#F59E0B' },
  { id: 'bakery', name: 'Bakery', icon: 'CakeSlice', color: '#D946EF' },
  { id: 'books', name: 'Books', icon: 'BookOpen', color: '#6366F1' },
  { id: 'pets', name: 'Pets', icon: 'PawPrint', color: '#14B8A6' },
  { id: 'repair', name: 'Repair', icon: 'Wrench', color: '#64748B' },
  { id: 'pharmacy', name: 'Pharmacy', icon: 'Cross', color: '#0891B2' },
];

export const typeConfig = {
  restaurant: { category: 'food', template: 'FOOD', main: 'Menu', tabs: ['Menu', 'Offers', 'Reviews', 'Info'] },
  cafe: { category: 'food', template: 'FOOD', main: 'Menu', tabs: ['Menu', 'Offers', 'Reviews', 'Info'] },
  bakery: { category: 'bakery', template: 'FOOD', main: 'Menu', tabs: ['Menu', 'Offers', 'Reviews', 'Info'] },
  temple: { category: 'religious', template: 'RELIGIOUS', main: 'Items', tabs: ['Timings & Puja', 'Events', 'Reviews', 'Info'] },
  clothing: { category: 'retail', template: 'RETAIL_CATALOG', main: 'Products', tabs: ['Products', 'Offers', 'Reviews', 'Info'] },
  electronics: { category: 'electronics', template: 'RETAIL_CATALOG', main: 'Catalog', tabs: ['Catalog', 'Offers', 'Reviews', 'Info'] },
  grocery: { category: 'grocery', template: 'RETAIL_CATALOG', main: 'Items', tabs: ['Items', 'Offers', 'Reviews', 'Info'] },
  bookstore: { category: 'books', template: 'RETAIL_CATALOG', main: 'Items', tabs: ['Items', 'Offers', 'Reviews', 'Info'] },
  salon: { category: 'salon', template: 'SERVICES', main: 'Services', tabs: ['Services', 'Offers', 'Reviews', 'Info'] },
  gym: { category: 'gym', template: 'SERVICES', main: 'Plans', tabs: ['Plans', 'Schedule', 'Reviews', 'Info'] },
  pet_care: { category: 'pets', template: 'SERVICES', main: 'Services', tabs: ['Services', 'Offers', 'Reviews', 'Info'] },
  repair: { category: 'repair', template: 'SERVICES', main: 'Services', tabs: ['Services', 'Offers', 'Reviews', 'Info'] },
  pharmacy: { category: 'pharmacy', template: 'RETAIL_CATALOG', main: 'Items', tabs: ['Items', 'Offers', 'Reviews', 'Info'] },
};

export const rupees = (paise) => {
  const n = Math.round(Number(paise || 0) / 100);
  return '₹' + n.toLocaleString('en-IN');
};

export const kmBetween = (a, b) => {
  if (!a || !b || a.lat == null || b.lat == null) return 0;
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

export const distanceLabel = (km) => {
  if (!km && km !== 0) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
};

export const isOpen = (b) => {
  if (!b?.hours?.length) return false;
  // Opening hours are Indian Standard Time, regardless of the visitor's timezone
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const mins = Number(parts.find(p => p.type === 'hour').value) % 24 * 60 + Number(parts.find(p => p.type === 'minute').value);
  return b.hours.some(h => {
    const [oh, om] = (h.open || '').split(':').map(Number);
    const [ch, cm] = (h.close || '').split(':').map(Number);
    if ([oh, om, ch, cm].some(Number.isNaN)) return false;
    const open = oh * 60 + om, close = ch * 60 + cm;
    return open <= close ? mins >= open && mins < close : mins >= open || mins < close; // overnight hours wrap past midnight
  });
};

export const discountFor = (offer, amountPaise) => {
  if (!offer) return 0;
  const c = offer.config || {};
  switch (offer.type) {
    case 'PERCENT': return Math.min(c.max_discount || Infinity, Math.round(amountPaise * (c.percent || 0) / 100));
    case 'FLAT': return Math.min(c.flat_amount || 0, amountPaise);
    case 'BOGO': return c.item_price || 0;
    case 'FREE_ITEM': return c.free_item_price || 0;
    default: return 0;
  }
};

// Fallback demo data used only when the database is empty.
