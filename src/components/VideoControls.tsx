import React from 'react';
import { Play, Pause, FastForward, Rewind, Circle, Square } from 'lucide-react';

interface VideoControlsProps {
  isPlaying: boolean;
  isRecording: boolean; // New prop to know if we are recording
  onTogglePlay: () => void;
  onToggleRecord: () => void; // New handler
  progress: number;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSkip: (seconds: number) => void;
  disabled?: boolean;
}

export function VideoControls({ 
  isPlaying, 
  isRecording,
  onTogglePlay, 
  onToggleRecord,
  progress, 
  onSeek, 
  onSkip, 
  disabled 
}: VideoControlsProps) {
  return (
    <div className={`bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center gap-6 shadow-lg ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      
      {/* --- Main Action Buttons --- */}
      <div className="flex items-center gap-3">
        
        {/* 1. Rehearse Button (Play/Pause) */}
        {!isRecording && (
          <button 
            onClick={onTogglePlay}
            className="w-12 h-12 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-full text-blue-400 transition-colors border border-gray-700"
            title="Rehearse (No Save)"
          >
            {isPlaying ? <Pause fill="currentColor" size={20} /> : <Play fill="currentColor" size={20} />}
          </button>
        )}

        {/* 2. RECORD Button (The important one) */}
        <button 
          onClick={onToggleRecord}
          className={`w-14 h-14 flex items-center justify-center rounded-full transition-all shadow-lg scale-100 active:scale-95 ${
            isRecording 
              ? "bg-red-600 hover:bg-red-700 text-white animate-pulse" 
              : "bg-red-600 hover:bg-red-500 text-white"
          }`}
          title={isRecording ? "Stop Recording" : "Start Recording Scene"}
        >
          {isRecording ? (
            <Square fill="white" size={24} /> // Stop Icon
          ) : (
            <div className="flex items-center gap-1">
               <Circle fill="white" size={20} className="text-white" /> 
            </div>
          )}
        </button>
      </div>

      {/* Scrubbing Bar */}
      <div className="flex-1 flex flex-col justify-center gap-1">
        <div className="flex justify-between text-xs text-gray-400 font-medium uppercase tracking-wider">
           <span>{isRecording ? "Recording..." : "Timeline"}</span>
           <span>{Math.round(progress)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={onSeek}
          disabled={isRecording} // Disable seeking while recording
          className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
            isRecording ? "bg-red-900/30 accent-red-500" : "bg-gray-700 accent-blue-500"
          }`}
        />
      </div>

      {/* Skip Buttons (Hidden while recording) */}
      {!isRecording && (
        <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
          <button 
            onClick={() => onSkip(-5)}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition"
          >
            <Rewind size={20} />
          </button>
          <button 
            onClick={() => onSkip(5)}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition"
          >
            <FastForward size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
