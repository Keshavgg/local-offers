import React from "react";
import { ShoppingBag, Store } from "lucide-react";
import { Label } from "@/components/ui/label";

const OPTIONS = [
  ["customer", "Customer", "Find places and offers", ShoppingBag],
  ["owner", "Shop owner", "List my business", Store],
];

export default function RolePicker({ value, onChange }) {
  return (
    <div className="mb-5">
      <Label className="mb-2 block">I am a</Label>
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map(([id, title, hint, Icon]) => (
          <button
            type="button"
            key={id}
            onClick={() => onChange(id)}
            aria-pressed={value === id}
            className={`text-left rounded-xl border p-3 transition ${value === id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/50"}`}
          >
            <Icon className="w-5 h-5 mb-2 text-primary" />
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs text-muted-foreground">{hint}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
