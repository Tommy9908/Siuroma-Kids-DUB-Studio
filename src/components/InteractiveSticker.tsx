'use client';

import React, { useState, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { Settings, Trash2, RotateCw } from 'lucide-react';
import { StickerState } from '@/types';

/** Calculate the content rect within a container.
 *  For video elements with object-fit:contain, accounts for letterboxing.
 *  For regular divs, returns the full container area. */
export function getVideoContentRect(container: HTMLElement): { x: number; y: number; width: number; height: number } {
  const cw = container.clientWidth;
  const ch = container.clientHeight;

  if (container instanceof HTMLVideoElement && container.videoWidth && container.videoHeight) {
    const videoAspect = container.videoWidth / container.videoHeight;
    const containerAspect = cw / ch;

    if (videoAspect > containerAspect) {
      const displayW = cw;
      const displayH = cw / videoAspect;
      return { x: 0, y: (ch - displayH) / 2, width: displayW, height: displayH };
    } else {
      const displayW = ch * videoAspect;
      const displayH = ch;
      return { x: (cw - displayW) / 2, y: 0, width: displayW, height: displayH };
    }
  }

  // For non-video containers (e.g., actor cells), use the full area
  return { x: 0, y: 0, width: cw, height: ch };
}

interface InteractiveStickerProps {
  state: StickerState;
  onChange: (newState: Partial<StickerState>) => void;
  onDelete: () => void;
  containerRef: React.RefObject<HTMLElement | null>;
}

export const InteractiveSticker: React.FC<InteractiveStickerProps> = ({
  state,
  onChange,
  onDelete,
  containerRef,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const rndRef = useRef<Rnd>(null);

  const handleDragStop = (_e: any, d: any) => {
    if (!containerRef.current) {
      onChange({ x: d.x, y: d.y });
      return;
    }
    const rect = getVideoContentRect(containerRef.current);
    const clampedX = Math.max(rect.x, Math.min(d.x, rect.x + rect.width - state.width));
    const clampedY = Math.max(rect.y, Math.min(d.y, rect.y + rect.height - state.height));
    onChange({ x: clampedX, y: clampedY });
  };

  const handleResizeStop = (_e: any, _direction: any, ref: any, _delta: any, position: any) => {
    const size = parseInt(ref.style.width, 10); // square, use width for both

    if (!containerRef.current) {
      onChange({ width: size, height: size, ...position });
      return;
    }

    const rect = getVideoContentRect(containerRef.current);
    const clampedSize = Math.min(size, rect.width, rect.height);
    const clampedX = Math.max(rect.x, Math.min(position.x, rect.x + rect.width - clampedSize));
    const clampedY = Math.max(rect.y, Math.min(position.y, rect.y + rect.height - clampedSize));

    onChange({ width: clampedSize, height: clampedSize, x: clampedX, y: clampedY });
  };

  const getBounds = () => {
    return containerRef.current ? containerRef.current : 'parent';
  };

  return (
    <>
      <Rnd
        ref={rndRef}
        size={{ width: state.width, height: state.height }}
        position={{ x: state.x, y: state.y }}
        onDragStop={handleDragStop}
        onResizeStop={handleResizeStop}
        bounds={getBounds()}
        className="group"
        style={{ zIndex: 22 }}
        lockAspectRatio={true}
        minWidth={40}
        minHeight={40}
      >
        <div
          className="w-full h-full flex items-center justify-center select-none pointer-events-none"
          style={{
            fontSize: `${state.width * 0.75}px`,
            opacity: state.opacity,
            transform: `rotate(${state.rotation}deg)`,
            transformOrigin: 'center center',
            lineHeight: 1,
          }}
        >
          {state.emoji}
        </div>

        {/* Action Buttons */}
        <div
          className="absolute -top-3 -right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ zIndex: 9999 }}
        >
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="p-1 bg-gray-800 rounded-full text-white hover:bg-gray-700"
          >
            <Settings size={16} />
          </button>
          <button onClick={onDelete} className="p-1 bg-red-600 rounded-full text-white hover:bg-red-500">
            <Trash2 size={16} />
          </button>
        </div>
      </Rnd>

      {/* Settings Panel */}
      {isSettingsOpen && (
        <div
          className="absolute bg-gray-800 text-white p-4 rounded-lg shadow-xl w-56 z-50"
          style={{ top: state.y + state.height + 10, left: state.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <h4 className="font-bold mb-3 text-sm">Sticker Settings</h4>

          {/* Opacity */}
          <div className="mb-3">
            <label className="text-xs block mb-1">Opacity</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={state.opacity}
              onChange={(e) => onChange({ opacity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Rotation */}
          <div className="mb-3">
            <label className="text-xs block mb-1 flex items-center gap-1">
              <RotateCw size={12} /> Rotation
            </label>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={state.rotation}
              onChange={(e) => onChange({ rotation: parseInt(e.target.value, 10) })}
              className="w-full"
            />
          </div>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="w-full flex items-center justify-center gap-2 text-xs bg-red-600/80 hover:bg-red-600 p-2 rounded-md mt-2 transition"
          >
            <Trash2 size={14} /> Delete Sticker
          </button>
        </div>
      )}
    </>
  );
};
