'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { FILTER_OPTIONS, FilterId } from '@/types/filters';

interface FilterPickerProps {
  onSelectFilter: (filterId: FilterId, applyToAll?: boolean) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const FilterPicker: React.FC<FilterPickerProps> = ({
  onSelectFilter,
  isOpen,
  onClose,
}) => {
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

  return (
    <div
      ref={panelRef}
      className="absolute top-12 right-0 w-72 bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl z-50"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">Pick a Filter</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition">
          <X size={16} />
        </button>
      </div>

      {/* Filter Grid */}
      <div className="grid grid-cols-3 gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => onSelectFilter(option.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              onSelectFilter(option.id, true);
            }}
            className={`flex flex-col items-center gap-1 p-3 rounded-lg transition hover:scale-105 active:scale-95 ${
              option.id === 'none'
                ? 'bg-gray-800 hover:bg-gray-700'
                : 'bg-gray-800 hover:bg-blue-800'
            }`}
            title={
              option.id === 'none'
                ? 'Remove filter'
                : `${option.label} — Right-click to apply to all actors`
            }
          >
            <span className="text-2xl">{option.icon}</span>
            <span className="text-[10px] text-gray-400 leading-tight text-center">
              {option.label}
            </span>
          </button>
        ))}
      </div>

      <p className="text-[10px] text-gray-500 mt-3 text-center">
        Right-click a filter to apply to all actors
      </p>
    </div>
  );
};
