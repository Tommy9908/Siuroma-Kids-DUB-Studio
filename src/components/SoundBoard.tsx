// src/components/SoundBoard.tsx
import React, { useState } from 'react';
import { Volume2, Library, X, Play, Check, ArrowRightLeft, ExternalLink } from 'lucide-react';

/* 
  RELIABLE SOURCES FOR SOUND EFFECTS:
  1. Pixabay (https://pixabay.com/sound-effects/) - No attribution required
  2. Mixkit (https://mixkit.co/free-sound-effects/) - High quality, free
  3. Zapsplat (https://www.zapsplat.com/) - Huge library (requires account)
  4. Freesound.org (https://freesound.org/) - Community driven
*/

interface SoundEffect {
  id: string;
  label: string;
  url: string;
  emoji: string;
  color: string;
}

// Extended Inventory
const INVENTORY: SoundEffect[] = [
  // Original Set
  { id: 'clap', label: 'Clap', url: '/sounds/clapping.mp3', emoji: '👏', color: 'bg-yellow-500' },
  { id: 'cheer', label: 'Cheer', url: '/sounds/cheer.mp3', emoji: '🎉', color: 'bg-green-500' },
  { id: 'laugh', label: 'Laugh', url: '/sounds/laugh.mp3', emoji: '😂', color: 'bg-blue-500' },
  { id: 'boo', label: 'Boo', url: '/sounds/boo.mp3', emoji: '👎', color: 'bg-red-500' },
  { id: 'drum', label: 'Rimshot', url: '/sounds/rimshot.mp3', emoji: '🥁', color: 'bg-purple-500' },
  { id: 'tada', label: 'Ta-da', url: '/sounds/tada.mp3', emoji: '✨', color: 'bg-pink-500' },
  { id: 'horn', label: 'Air Horn', url: '/sounds/airhorn.mp3', emoji: '📢', color: 'bg-orange-500' },
  
  // Extended Set
  { id: 'cricket', label: 'Crickets', url: '/sounds/cricket.mp3', emoji: '🦗', color: 'bg-teal-500' },
  { id: 'bell', label: 'Ding', url: '/sounds/ding.mp3', emoji: '🔔', color: 'bg-yellow-400' },
  { id: 'gong', label: 'Gong', url: '/sounds/gong.mp3', emoji: '🛑', color: 'bg-red-700' },
  { id: 'punch', label: 'Punch', url: '/sounds/punch.mp3', emoji: '👊', color: 'bg-orange-600' },
  { id: 'whoosh', label: 'Whoosh', url: '/sounds/woosh.mp3', emoji: '💨', color: 'bg-gray-500' },
  { id: 'pop', label: 'Pop', url: '/sounds/pop.mp3', emoji: '🎈', color: 'bg-pink-400' },
  { id: 'success', label: 'Success', url: '/sounds/success.mp3', emoji: '🏆', color: 'bg-yellow-600' },
  { id: 'fail', label: 'Fail', url: '/sounds/fail.mp3', emoji: '📉', color: 'bg-gray-600' },
];

interface SoundBoardProps {
  audioContext?: AudioContext | null;
  audioDestination?: MediaStreamAudioDestinationNode | null;
}

export function SoundBoard({ audioContext, audioDestination }: SoundBoardProps) {
  // Store indices of the INVENTORY array. We only show 7 slots + 1 Gallery button.
  const [slotIndices, setSlotIndices] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [targetSlotIndex, setTargetSlotIndex] = useState<number>(0); // 0-6, which slot we are replacing

  const playSound = async (sound: SoundEffect) => {
    setActiveSound(sound.id);

    // 1. Play via Web Audio API (if recording)
    if (audioContext && audioDestination) {
      try {
        const response = await fetch(sound.url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        // Connect to Recorder
        source.connect(audioDestination);
        // Connect to Speakers (so you can hear it too)
        source.connect(audioContext.destination);
        
        source.onended = () => setActiveSound(null);
        source.start(0);
        return;
      } catch (e) {
        console.warn("WebAudio play failed, falling back to HTML Audio", e);
      }
    }

    // 2. Fallback to standard HTML Audio (if not recording or error)
    const audio = new Audio(sound.url);
    audio.onended = () => setActiveSound(null);
    audio.play().catch(e => {
      console.error("Failed to play sound:", e);
      setActiveSound(null);
    });
  };

  const assignSoundToSlot = (inventoryIndex: number) => {
    const newSlots = [...slotIndices];
    newSlots[targetSlotIndex] = inventoryIndex;
    setSlotIndices(newSlots);
    // Optional: Close gallery after assignment?
    // setIsGalleryOpen(false); 
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Volume2 size={16} /> Sound Board
        </h3>
      </div>
      
      {/* 4x2 Grid: 7 Sounds + 1 Gallery Button */}
      <div className="grid grid-cols-4 gap-3 flex-1">
        {slotIndices.map((inventoryIdx, slotIdx) => {
          const sound = INVENTORY[inventoryIdx];
          return (
            <button
              key={`${sound.id}-${slotIdx}`}
              onClick={() => playSound(sound)}
              className={`
                relative group flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-100
                ${activeSound === sound.id 
                  ? 'transform scale-95 ring-2 ring-white/50 bg-gray-800' 
                  : 'hover:-translate-y-1 hover:bg-gray-800/80 bg-gray-800/40'}
                border border-white/5 overflow-hidden
              `}
            >
              {/* Color Stripe */}
              <div className={`absolute top-0 left-0 w-full h-1 ${sound.color} opacity-70`} />
              
              <span className="text-2xl mb-1 filter drop-shadow-lg">{sound.emoji}</span>
              <span className="text-[10px] font-medium text-gray-300 truncate w-full text-center px-1">
                {sound.label}
              </span>
              
              {activeSound === sound.id && (
                <div className="absolute inset-0 bg-white/10 animate-pulse rounded-xl" />
              )}
            </button>
          );
        })}

        {/* 8th Button: Gallery / More */}
        <button
          onClick={() => setIsGalleryOpen(true)}
          className="relative group flex flex-col items-center justify-center p-2 rounded-xl border border-white/10 border-dashed hover:bg-gray-800/50 transition-all text-gray-500 hover:text-white hover:border-white/30"
        >
          <Library size={24} className="mb-1" />
          <span className="text-[10px] font-medium">Gallery</span>
        </button>
      </div>

      {/* Gallery Modal */}
      {isGalleryOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 w-full max-w-2xl rounded-2xl border border-gray-800 shadow-2xl flex flex-col max-h-[80vh]">
            
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Library className="text-blue-500" /> Sound Library
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Select a slot below, then click a sound to assign it.
                </p>
              </div>
              <button 
                onClick={() => setIsGalleryOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Slot Selector */}
            <div className="p-4 bg-gray-950 border-b border-gray-800">
               <div className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">
                 Target Slot
               </div>
               <div className="flex gap-2">
                 {slotIndices.map((invIdx, idx) => {
                   const isActive = targetSlotIndex === idx;
                   const sound = INVENTORY[invIdx];
                   return (
                     <button
                       key={idx}
                       onClick={() => setTargetSlotIndex(idx)}
                       className={`
                         flex-1 h-12 rounded-lg border flex items-center justify-center gap-2 transition-all relative overflow-hidden
                         ${isActive 
                           ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500 text-white' 
                           : 'bg-gray-900 border-gray-800 text-gray-500 hover:bg-gray-800 hover:border-gray-700'}
                       `}
                       title={`Assign to Slot ${idx + 1}`}
                     >
                        <span className="text-sm">{sound.emoji}</span>
                        <div className="absolute top-1 right-1 text-[8px] font-mono opacity-50">{idx + 1}</div>
                        {isActive && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500" />}
                     </button>
                   );
                 })}
               </div>
            </div>

            {/* Inventory Grid */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {INVENTORY.map((sound, idx) => {
                const isAssigned = slotIndices[targetSlotIndex] === idx;
                
                return (
                  <div 
                    key={sound.id}
                    className={`
                      flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer
                      ${isAssigned 
                        ? 'bg-green-900/20 border-green-500/50' 
                        : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800 hover:border-gray-600'}
                    `}
                    onClick={() => assignSoundToSlot(idx)}
                  >
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-full ${sound.color} flex items-center justify-center text-xl shrink-0 shadow-lg`}>
                      {sound.emoji}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-200 truncate">{sound.label}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        {isAssigned ? (
                          <span className="text-green-400 flex items-center gap-1">
                            <Check size={10} /> Assigned
                          </span>
                        ) : (
                          <span className="group-hover:text-blue-400 transition-colors">Click to Assign</span>
                        )}
                      </div>
                    </div>

                    {/* Preview Button (Stop propagation to prevent assignment) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playSound(sound);
                      }}
                      className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition"
                      title="Preview Sound"
                    >
                      {activeSound === sound.id ? (
                        <div className="w-4 h-4 bg-blue-500 rounded-sm animate-pulse" />
                      ) : (
                        <Play size={16} fill="currentColor" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-800 bg-gray-950 flex justify-between items-center text-xs text-gray-500">
               <span>
                 Select a slot at the top, then click a sound to assign it.
               </span>
               <a 
                 href="https://pixabay.com/sound-effects/" 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="flex items-center gap-1 hover:text-blue-400 transition"
               >
                 More sounds on Pixabay <ExternalLink size={10} />
               </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
