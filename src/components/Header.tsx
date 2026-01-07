import React from 'react';
import { Upload, Users } from 'lucide-react';
import { SourceMode, ActorCount } from '@/types';

interface HeaderProps {
  sourceMode: SourceMode;
  setSourceMode: (mode: SourceMode) => void;
  actorCount: ActorCount;
  setActorCount: (count: ActorCount) => void;
  onFileImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  hdmiVolume: number;
  setHdmiVolume: (vol: number) => void;
}

export function Header({
  actorCount, 
  setActorCount, 
  onFileImport
}: HeaderProps) {
  
  // Helper to safely cast number to ActorCount type if needed
  const handleCountChange = (num: number) => {
    if (num >= 1 && num <= 4) {
      setActorCount(num as ActorCount);
    }
  };

  return (
    <header className="h-[80px] border-b border-gray-800 bg-gray-950 px-6 flex items-center justify-between">
      {/* Left: Branding */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-900/20">
          D
        </div>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
          Dubbing Studio
        </h1>
      </div>

      {/* Center: Controls (Reduced to just Actor Count & Import) */}
      <div className="flex items-center gap-6">
        
        {/* Import Video Button - This is now the ONLY source option [file:2] */}
        <div className="relative">
          <input
            type="file"
            accept="video/*"
            onChange={onFileImport}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
          />
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition border border-gray-700">
            <Upload size={18} />
            <span className="font-medium">Import Reference</span>
          </button>
        </div>

        <div className="w-px h-8 bg-gray-800" />

        {/* Actor Count Selector */}
        <div className="flex items-center gap-3 bg-gray-900 p-1.5 rounded-lg border border-gray-800">
          <div className="px-2 text-gray-400 flex items-center gap-2">
            <Users size={16} />
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
              <button
                key={num}
                onClick={() => setActorCount(num)}
                className={`w-7 h-8 rounded-md text-xs font-bold transition-all ${
                  actorCount === num
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:bg-gray-800'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>
      

      {/* Right: Empty or Additional Actions */}
      <div className="w-[200px] flex justify-end">
        {/* Placeholder for future settings or user profile */}
      </div>
    </header>
  );
}
