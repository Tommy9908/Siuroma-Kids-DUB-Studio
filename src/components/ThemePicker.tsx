'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Palette, X, Check } from 'lucide-react';
import { useTheme, ThemeId } from '@/lib/ThemeContext';

interface ThemePickerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemePicker: React.FC<ThemePickerProps> = ({ isOpen, onClose }) => {
  const { theme: activeTheme, setTheme, themes } = useTheme();
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
        <h3 className="text-sm font-bold text-white">Pick a Theme</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition">
          <X size={16} />
        </button>
      </div>

      {/* Theme Swatch Grid */}
      <div className="grid grid-cols-3 gap-3">
        {themes.map((theme) => {
          const isActive = activeTheme === theme.id;
          return (
            <button
              key={theme.id}
              onClick={() => {
                setTheme(theme.id);
                onClose();
              }}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl transition hover:scale-105 active:scale-95 relative ${
                isActive
                  ? 'bg-gray-800 ring-2 ring-blue-500'
                  : 'bg-gray-800/60 hover:bg-gray-800'
              }`}
              title={theme.label}
            >
              {/* Color Swatch Circle */}
              <div
                className="w-10 h-10 rounded-full shadow-lg relative"
                style={{ background: theme.swatch }}
              >
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check size={18} className="text-white drop-shadow-lg" strokeWidth={3} />
                  </div>
                )}
              </div>
              <span className="text-[10px] text-gray-400 leading-tight text-center">
                {theme.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Theme toggle button for the header.
 * Renders the palette icon and opens the ThemePicker dropdown.
 */
export const ThemeToggleButton: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
          open
            ? 'bg-blue-600 text-white'
            : 'text-gray-300 bg-gray-800 hover:bg-gray-700'
        }`}
        title="Change Theme"
      >
        <Palette size={16} />
        <span>Theme</span>
      </button>
      <ThemePicker isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
};
