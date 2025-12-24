"use client";
import { useState } from "react";
import { Globe, BookOpen, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SearchSelector({ onSelect }: { onSelect: (type: string) => void }) {
  const [selected, setSelected] = useState("default");

  const options = [
    { id: "default", name: "AI Default", icon: <Database className="w-5 h-5" /> },
    { id: "wikipedia", name: "Wikipedia Search", icon: <BookOpen className="w-5 h-5" /> },
    { id: "deep", name: "Deep Search", icon: <Globe className="w-5 h-5" /> },
  ];

  return (
    <div className="flex gap-4 p-3 justify-center">
      {options.map(opt => (
        <Button
          key={opt.id}
          variant={selected === opt.id ? "default" : "outline"}
          onClick={() => {
            setSelected(opt.id);
            onSelect(opt.id);
          }}
          className="flex items-center gap-2 rounded-2xl px-4 py-2 transition-all"
        >
          {opt.icon}
          <span>{opt.name}</span>
        </Button>
      ))}
    </div>
  );
}
