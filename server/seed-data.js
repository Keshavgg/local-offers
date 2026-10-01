// Demo content for `npm run seed` (never loaded by the app itself)
export const businesses = [
  {
    id: 'demo-1', name: 'Saravana Bhavan', entity_type: 'restaurant', subtitle: 'South Indian thali',
    locality: 'Connaught Place', address: 'A-Block, Connaught Place, New Delhi', lat: 28.6328, lng: 77.2183,
    cover_url: 'https://images.unsplash.com/photo-1631290433255-e1a8c63e3a6e?w=800&q=80',
    phone: '+91 11 2331 6969', rating: 4.3, review_count: 12, verified: true,
    description: 'Authentic South Indian meals, dosa and filter coffee since 1981.',
    hours: [{ open: '07:30', close: '23:00', label: 'Daily' }],
    items: [
      { section: 'Meals', name: 'Mini Tiffin', price_paise: 22000, description: 'Idli, vada, pongal, kesari', is_available: true },
      { section: 'Meals', name: 'Masala Dosa', price_paise: 18000, description: 'Crispy rice crepe, potato masala', is_available: true },
      { section: 'Drinks', name: 'Filter Coffee', price_paise: 6000, description: 'South Indian style', is_available: true },
    ],
  },
  {
    id: 'demo-2', name: 'Lakshmi Narayan Mandir', entity_type: 'temple', subtitle: 'Birla Temple',
    locality: 'Connaught Place', address: 'Mandir Marg, Near Gole Market, New Delhi', lat: 28.6367, lng: 77.2033,
    cover_url: 'https://images.unsplash.com/photo-1567148332356-a8b4f2c1a82e?w=800&q=80',
    phone: '+91 11 2334 6401', rating: 4.7, review_count: 8, verified: true,
    description: 'Historic Hindu temple with morning and evening aarti.',
    hours: [{ open: '06:00', close: '12:00', label: 'Morning darshan' }, { open: '16:00', close: '21:00', label: 'Evening aarti' }],
    items: [
      { section: 'Seva', name: 'Archana', price_paise: 5100, description: 'Floral offering with name recital', is_available: true },
      { section: 'Seva', name: 'Aarti', price_paise: 11000, description: 'Evening aarti with prasad', is_available: true },
    ],
  },
  {
    id: 'demo-3', name: 'Khan Chacha', entity_type: 'restaurant', subtitle: 'Kathi rolls & kebabs',
    locality: 'Khan Market', address: 'Khan Market, New Delhi', lat: 28.6006, lng: 77.2275,
    cover_url: 'https://images.unsplash.com/photo-1568901346375-23c445f06339?w=800&q=80',
    phone: '+91 11 2465 2222', rating: 4.4, review_count: 15, verified: false,
    description: 'Legendary kathi rolls since 1972.',
    hours: [{ open: '11:00', close: '23:30', label: 'Daily' }],
    items: [
      { section: 'Rolls', name: 'Chicken Tikka Roll', price_paise: 24000, description: 'Char-grilled chicken, mint chutney', is_available: true },
      { section: 'Rolls', name: 'Paneer Roll', price_paise: 20000, description: 'Tandoori paneer, onions', is_available: true },
    ],
  },
  {
    id: 'demo-4', name: 'Modern Bazaar', entity_type: 'grocery', subtitle: 'Daily essentials & groceries',
    locality: 'Saket', address: 'District Centre, Saket, New Delhi', lat: 28.5245, lng: 77.2066,
    cover_url: 'https://images.unsplash.com/photo-1604719312566-8912e9221d2d?w=800&q=80',
    phone: '+91 11 4170 0000', rating: 4.1, review_count: 6, verified: true,
    description: 'Fresh produce, pantry staples and household goods.',
    hours: [{ open: '08:00', close: '22:00', label: 'Daily' }],
    items: [
      { section: 'Produce', name: 'Bananas (1 dozen)', price_paise: 6000, description: 'Fresh Cavendish', is_available: true },
      { section: 'Pantry', name: 'Basmati Rice 5kg', price_paise: 52000, description: 'Aged long grain', is_available: true },
    ],
  },
];

export const reviews = [
  { id: 'r1', business_id: 'demo-1', author: 'Ananya R.', rating: 5, body: 'The masala dosa is the best in CP. Filter coffee is unbeatable.', date: '2026-09-20' },
  { id: 'r2', business_id: 'demo-1', author: 'Vikram S.', rating: 4, body: 'Great food, slightly slow service at peak hours.', date: '2026-09-18' },
  { id: 'r3', business_id: 'demo-2', author: 'Meera D.', rating: 5, body: 'Evening aarti is serene and well-organised.', date: '2026-09-22' },
  { id: 'r4', business_id: 'demo-3', author: 'Rohan K.', rating: 4, body: 'Chicken tikka roll never disappoints.', date: '2026-09-19' },
];
