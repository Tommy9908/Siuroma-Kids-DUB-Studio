// src/components/Header.tsx
import React from 'react';
import { Upload, Users } from 'lucide-react';
import { SourceMode, ActorCount, ActorDeviceConfig } from '@/types';
import { DeviceList } from '@/hooks/useMediaDevices';
import { DeviceSettings } from './DeviceSettings';

interface HeaderProps {
  sourceMode: SourceMode;
  setSourceMode: (mode: SourceMode) => void;
  actorCount: ActorCount;
  setActorCount: (count: ActorCount) => void;
  onFileImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  
  devices: DeviceList;
  config: ActorDeviceConfig;
  setConfig: React.Dispatch<React.SetStateAction<ActorDeviceConfig>>;
  
  isScanning?: boolean;
  refreshDevices?: () => void;
  selectedDeviceId?: string;
  setSelectedDeviceId?: (id: string) => void;
  hdmiVolume?: number;
  setHdmiVolume?: (vol: number) => void;
}

export function Header({
  actorCount,
  setActorCount,
  onFileImport,
  devices,
  config,
  setConfig
}: HeaderProps) {

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

        <div className="h-6 w-px bg-gray-800" />

        {/* Actor Count Selector */}
        <div className="flex items-center bg-gray-900 rounded-lg p-1 border border-gray-800">
          <div className="px-3 flex items-center gap-2 text-gray-400 border-r border-gray-800 mr-1">
            <Users size={16} />
          </div>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
            <button
              key={num}
              onClick={() => setActorCount(num as ActorCount)}
              className={`
                w-8 h-8 rounded-md text-sm font-bold transition
                ${actorCount === num 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'}
              `}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Only Device Settings remains here */}
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
