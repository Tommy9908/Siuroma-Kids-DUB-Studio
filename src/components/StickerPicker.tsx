'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { EMOJI_CATEGORIES } from '@/types';

interface StickerPickerProps {
  onSelectSticker: (emoji: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const StickerPicker: React.FC<StickerPickerProps> = ({
  onSelectSticker,
  isOpen,
  onClose,
}) => {
  const [activeCategory, setActiveCategory] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const category = EMOJI_CATEGORIES[activeCategory];

  return (
    <div
      ref={panelRef}
      className="absolute top-12 right-0 w-80 bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl z-50"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">Add Sticker</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition">
          <X size={16} />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1 scrollbar-hide">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              i === activeCategory
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="grid grid-cols-5 gap-2">
        {category.emojis.map(emoji => (
          <button
            key={emoji}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', emoji);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => onSelectSticker(emoji)}
            className="aspect-square flex items-center justify-center text-3xl bg-gray-800 hover:bg-gray-700 rounded-lg transition transform hover:scale-110 active:scale-95 cursor-grab active:cursor-grabbing"
            title={`${emoji} — drag to place or click to add`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
