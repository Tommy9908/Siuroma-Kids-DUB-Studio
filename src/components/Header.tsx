// src/components/Header.tsx
import React, { useState, useRef } from 'react';
import { Upload, Users, Eye, EyeOff, Type, Sticker, Video, Sparkles } from 'lucide-react';
import { ThemeToggleButton } from './ThemePicker';
import { SourceMode, ActorCount, ActorDeviceConfig, FilterId } from '@/types';
import { DeviceList } from '@/hooks/useMediaDevices';
import { DeviceSettings } from './DeviceSettings';
import { StickerPicker } from './StickerPicker';
import { FilterPicker } from './FilterPicker';

interface HeaderProps {
  sourceMode: SourceMode;
  setSourceMode: (mode: SourceMode) => void;
  actorCount: ActorCount;
  setActorCount: (count: ActorCount) => void;
  onFileImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImportActorVideo: (actorIndex: number, file: File) => void;
  onAddText: () => void;

  isWatermarkVisible: boolean;
  onToggleWatermark: () => void;

  devices: DeviceList;
  config: ActorDeviceConfig;
  setConfig: React.Dispatch<React.SetStateAction<ActorDeviceConfig>>;

  isScanning?: boolean;
  refreshDevices?: () => void;
  selectedDeviceId?: string;
  setSelectedDeviceId?: (id: string) => void;
  hdmiVolume?: number;
  setHdmiVolume?: (vol: number) => void;

  // Sticker props
  onAddSticker: (emoji: string) => void;

  // Filter props
  onSelectFilter: (filterId: FilterId, applyToAll?: boolean) => void;
  filtersAvailable: boolean;
}

export function Header({
  actorCount,
  setActorCount,
  onFileImport,
  onImportActorVideo,
  onAddText,
  isWatermarkVisible,
  onToggleWatermark,
  devices,
  config,
  setConfig,
  onAddSticker,
  onSelectFilter,
  filtersAvailable,
}: HeaderProps) {
  const [stickerOpen, setStickerOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [actorVideoDropdownOpen, setActorVideoDropdownOpen] = useState(false);
  const [actorCountDropdownOpen, setActorCountDropdownOpen] = useState(false);
  const actorVideoFileInputRef = useRef<HTMLInputElement>(null);
  const pendingActorIndexRef = useRef<number>(0);

  return (
    <header className="h-16 border-b border-gray-800 bg-gray-950 flex items-center justify-between px-6 shrink-0 z-20 relative">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">
          D
        </div>
        <h1 className="font-bold text-lg text-gray-100">Dubbing Studio</h1>
      </div>

      <div className="flex items-center gap-6">
         {/* File Import Button */}
        <label className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg cursor-pointer transition text-sm font-medium border border-gray-700">
          <Upload size={16} />
          <span>Import Reference</span>
          <input type="file" accept="video/*" onChange={onFileImport} className="hidden" />
        </label>

        {/* Import Video as Actor Button */}
        <div className="relative">
          <button
            onClick={() => setActorVideoDropdownOpen(!actorVideoDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg cursor-pointer transition text-sm font-medium border border-gray-700"
            title="Import Video as Actor"
          >
            <Video size={16} />
            <span>Import Video as Actor</span>
          </button>
          {actorVideoDropdownOpen && (
            <div
              className="absolute top-full mt-1 left-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[200px]"
              onMouseLeave={() => setActorVideoDropdownOpen(false)}
            >
              <div className="px-3 py-2 text-xs text-gray-400 uppercase tracking-wider">Replace Actor</div>
              {Array.from({ length: actorCount }).map((_, i) => {
                const actorName = config[i]?.name || `Actor ${i + 1}`;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      pendingActorIndexRef.current = i;
                      actorVideoFileInputRef.current?.click();
                      setActorVideoDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition flex items-center gap-3"
                  >
                    <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400">
                      {i + 1}
                    </span>
                    {actorName}
                  </button>
                );
              })}
            </div>
          )}
          <input
            ref={actorVideoFileInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onImportActorVideo(pendingActorIndexRef.current, file);
              }
              // Reset so the same file can be re-selected
              e.target.value = '';
            }}
            className="hidden"
          />
        </div>

        <div className="h-6 w-px bg-gray-800" />

        {/* Actor Count Selector (Dropdown) */}
        <div className="relative">
          <button
            onClick={() => setActorCountDropdownOpen(!actorCountDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition text-sm font-medium border border-gray-700"
            title="Number of Actors"
          >
            <Users size={16} />
            <span>{actorCount}</span>
          </button>
          {actorCountDropdownOpen && (
            <div
              className="absolute top-full mt-1 left-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[140px]"
              onMouseLeave={() => setActorCountDropdownOpen(false)}
            >
              <div className="px-3 py-2 text-xs text-gray-400 uppercase tracking-wider">Actors</div>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                <button
                  key={num}
                  onClick={() => {
                    setActorCount(num as ActorCount);
                    setActorCountDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm transition flex items-center gap-3 ${
                    actorCount === num
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    actorCount === num
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400'
                  }`}>
                    {num}
                  </span>
                  {num} {num === 1 ? 'Actor' : 'Actors'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onAddText}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
          title="Add Text"
        >
          <Type size={16} />
          <span>Add Text</span>
        </button>
        <button
          onClick={onToggleWatermark}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
          title="Toggle Watermark Visibility"
        >
          {isWatermarkVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          <span>Watermark</span>
        </button>

        {/* Sticker Toggle */}
        <div className="relative">
          <button
            onClick={() => setStickerOpen(!stickerOpen)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
              stickerOpen
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 bg-gray-800 hover:bg-gray-700'
            }`}
            title="Add Stickers"
          >
            <Sticker size={16} />
            <span>Stickers</span>
          </button>
          <StickerPicker
            onSelectSticker={(emoji) => { onAddSticker(emoji); setStickerOpen(false); }}
            isOpen={stickerOpen}
            onClose={() => setStickerOpen(false)}
          />
        </div>

        {/* Filter Toggle */}
        {filtersAvailable && (
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
                filterOpen
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 bg-gray-800 hover:bg-gray-700'
              }`}
              title="AR Face Filters"
            >
              <Sparkles size={16} />
              <span>Filters</span>
            </button>
            <FilterPicker
              onSelectFilter={(filterId, applyToAll) => {
                onSelectFilter(filterId, applyToAll);
                setFilterOpen(false);
              }}
              isOpen={filterOpen}
              onClose={() => setFilterOpen(false)}
            />
          </div>
        )}

        {/* Theme Toggle */}
        <ThemeToggleButton />

        <DeviceSettings
          devices={devices}
          actorCount={actorCount}
          config={config}
          setConfig={setConfig}
        />
      </div>
    </header>
  );
}