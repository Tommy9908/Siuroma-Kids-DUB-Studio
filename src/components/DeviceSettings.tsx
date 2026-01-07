// src/components/DeviceSettings.tsx

import React from 'react';
import { Settings } from 'lucide-react';
import { DeviceList } from '@/hooks/useMediaDevices';
import { ActorDeviceConfig, ActorCount } from '@/types';

interface DeviceSettingsProps {
  devices: DeviceList;
  actorCount: ActorCount;
  config: ActorDeviceConfig;
  setConfig: React.Dispatch<React.SetStateAction<ActorDeviceConfig>>;
}

export function DeviceSettings({
  devices,
  actorCount,
  config,
  setConfig
}: DeviceSettingsProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleChange = (index: number, type: 'video' | 'audio', deviceId: string) => {
    setConfig(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        [type === 'video' ? 'videoDeviceId' : 'audioDeviceId']: deviceId
      }
    }));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition ${
          isOpen ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300'
        }`}
      >
        <Settings size={20} />
        Devices
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 w-80 bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-xl z-50">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Input Sources</h3>
          
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {Array.from({ length: actorCount }).map((_, i) => (
              <div key={i} className="space-y-2 p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="font-medium text-sm">Actor {i + 1}</span>
                </div>

                {/* Video Select */}
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:border-blue-500 outline-none"
                  value={config[i]?.videoDeviceId || ""}
                  onChange={(e) => handleChange(i, 'video', e.target.value)}
                >
                  <option value="">Default Camera</option>
                  <option value="no-video">⛔ No Camera (Audio Only)</option>
                  {devices.videoInputs.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Cam ${d.deviceId.slice(0,4)}`}
                    </option>
                  ))}
                </select>

                {/* Audio Select */}
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:border-blue-500 outline-none"
                  value={config[i]?.audioDeviceId || ""}
                  onChange={(e) => handleChange(i, 'audio', e.target.value)}
                >
                  <option value="">Default Mic</option>
                  {devices.audioInputs.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Mic ${d.deviceId.slice(0,4)}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
