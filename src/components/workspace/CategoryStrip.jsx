import React from 'react';
import { Landmark, UtensilsCrossed, Shirt, Smartphone, Scissors, ShoppingBasket, Cross, Dumbbell, CakeSlice, BookOpen, PawPrint, Wrench } from 'lucide-react';
import { categories } from '@/lib/evergreenData';

const icons = { Landmark, UtensilsCrossed, Shirt, Smartphone, Scissors, ShoppingBasket, Cross, Dumbbell, CakeSlice, BookOpen, PawPrint, Wrench };

export default function CategoryStrip({ value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 md:mx-0">
      {categories.map(c => {
        const Icon = icons[c.icon];
        const active = value === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onChange(active ? '' : c.id)}
            className={`shrink-0 flex flex-col items-center gap-1.5 min-w-[64px] text-[11px] font-medium transition ${active ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <span className={`w-12 h-12 rounded-lg flex items-center justify-center transition border ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary/40'}`}>
              <Icon size={20} strokeWidth={2} />
            </span>
            {c.name}
          </button>
        );
      })}
    </div>
  );
}