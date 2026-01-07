import React, { useState } from 'react';
import { Volume2 } from 'lucide-react';

interface SoundEffect {
  id: string;
  label: string;
  url: string; // URL to the audio file
  emoji: string;
  color: string;
}

const SOUND_EFFECTS: SoundEffect[] = [
  { id: 'clap', label: 'Clap', url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3', emoji: '👏', color: 'bg-yellow-500' },
  { id: 'cheer', label: 'Cheer', url: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_884892586e.mp3', emoji: '🎉', color: 'bg-green-500' },
  { id: 'laugh', label: 'Laugh', url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3', emoji: '😂', color: 'bg-blue-500' },
  { id: 'boo', label: 'Boo', url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_c6ccf3232f.mp3', emoji: '👎', color: 'bg-red-500' },
  { id: 'drum', label: 'Rimshot', url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_5b3838297b.mp3', emoji: '🥁', color: 'bg-purple-500' },
  { id: 'tada', label: 'Ta-da', url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_277f0c609c.mp3', emoji: '✨', color: 'bg-pink-500' },
  { id: 'horn', label: 'Air Horn', url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_12b0c7443c.mp3', emoji: '📢', color: 'bg-orange-500' },
  { id: 'cricket', label: 'Crickets', url: 'https://cdn.pixabay.com/download/audio/2022/03/24/audio_14566d581c.mp3', emoji: '🦗', color: 'bg-teal-500' },
];

export function SoundBoard() {
  const [activeSound, setActiveSound] = useState<string | null>(null);

  const playSound = (sound: SoundEffect) => {
    setActiveSound(sound.id);
    const audio = new Audio(sound.url);
    
    audio.onended = () => setActiveSound(null);
    
    audio.play().catch(e => {
      console.error("Failed to play sound:", e);
      setActiveSound(null);
    });
  };

  return (
    <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
      <div className="flex items-center gap-2 mb-3 text-gray-400 text-sm font-medium uppercase tracking-wider">
        <Volume2 size={16} />
        Sound Board
      </div>
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
        {SOUND_EFFECTS.map((sound) => (
          <button
            key={sound.id}
            onClick={() => playSound(sound)}
            className={`
              relative group flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-100
              ${activeSound === sound.id ? 'transform scale-95 ring-2 ring-white/50' : 'hover:-translate-y-1 hover:bg-gray-800/80 bg-gray-800/40'}
              border border-white/5
            `}
          >
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center text-xl mb-2
              ${sound.color} bg-opacity-20 group-hover:bg-opacity-30 transition-all
            `}>
              {sound.emoji}
            </div>
            <span className="text-xs font-medium text-gray-400 group-hover:text-white truncate w-full text-center">
              {sound.label}
            </span>
            
            {/* Visual Ripple Effect when Active */}
            {activeSound === sound.id && (
              <span className="absolute inset-0 rounded-xl bg-white/10 animate-ping" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
