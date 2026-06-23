// src/components/InteractiveWatermark.tsx
import React, { useState, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { Settings, Move, ZoomIn, Film, EyeOff, Palette } from 'lucide-react';

export type WatermarkState = {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  animation: string;
  visible: boolean;
};

interface InteractiveWatermarkProps {
  src: string;
  state: WatermarkState;
  onChange: (state: WatermarkState) => void;
  containerRef: React.RefObject<HTMLElement | null>; // Ref to the container for bounds
}

/** Calculate the actual video content rect within a container that uses object-fit: contain */
function getVideoContentRect(container: HTMLElement): { x: number; y: number; width: number; height: number } {
  const cw = container.clientWidth;
  const ch = container.clientHeight;

  if (container instanceof HTMLVideoElement && container.videoWidth && container.videoHeight) {
    const videoAspect = container.videoWidth / container.videoHeight;
    const containerAspect = cw / ch;

    if (videoAspect > containerAspect) {
      // Video is wider → letterbox top/bottom
      const displayW = cw;
      const displayH = cw / videoAspect;
      return { x: 0, y: (ch - displayH) / 2, width: displayW, height: displayH };
    } else {
      // Video is taller → letterbox left/right
      const displayW = ch * videoAspect;
      const displayH = ch;
      return { x: (cw - displayW) / 2, y: 0, width: displayW, height: displayH };
    }
  }

  return { x: 0, y: 0, width: cw, height: ch };
}

export const InteractiveWatermark: React.FC<InteractiveWatermarkProps> = ({
  src,
  state,
  onChange,
  containerRef,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const rndRef = useRef<Rnd>(null);

  const handleDragStop = (e: any, d: any) => {
    if (!containerRef.current) {
      onChange({ ...state, x: d.x, y: d.y });
      return;
    }
    const rect = getVideoContentRect(containerRef.current);
    const clampedX = Math.max(rect.x, Math.min(d.x, rect.x + rect.width - state.width));
    const clampedY = Math.max(rect.y, Math.min(d.y, rect.y + rect.height - state.height));
    onChange({ ...state, x: clampedX, y: clampedY });
  };

  const handleResizeStop = (e: any, direction: any, ref: any, delta: any, position: any) => {
    const newWidth = parseInt(ref.style.width, 10);
    const newHeight = parseInt(ref.style.height, 10);

    if (!containerRef.current) {
      onChange({ ...state, width: newWidth, height: newHeight, ...position });
      return;
    }

    const rect = getVideoContentRect(containerRef.current);

    // Clamp size to fit within content rect
    const clampedW = Math.min(newWidth, rect.width);
    const clampedH = Math.min(newHeight, rect.height);

    // Clamp position so the element stays inside the content rect
    const clampedX = Math.max(rect.x, Math.min(position.x, rect.x + rect.width - clampedW));
    const clampedY = Math.max(rect.y, Math.min(position.y, rect.y + rect.height - clampedH));

    onChange({
      ...state,
      width: clampedW,
      height: clampedH,
      x: clampedX,
      y: clampedY,
    });
  };

  const animationOptions = [
    { value: 'none', label: 'None', icon: <div className="w-4 h-4 border border-gray-400 rounded-sm" /> },
    { value: 'scroll-h', label: 'Scroll H', icon: <Move className="w-4 h-4" /> },
    { value: 'scroll-v', label: 'Scroll V', icon: <Move className="w-4 h-4 rotate-90" /> },
    { value: 'pulse', label: 'Pulse', icon: <ZoomIn className="w-4 h-4" /> },
    { value: 'fade-in-out', label: 'Fade In/Out', icon: <Film className="w-4 h-4" /> },
  ];

  const getBounds = () => {
    if (containerRef.current) {
      return containerRef.current;
    }
    return 'parent';
  };

  if (!state.visible) {
    return null;
  }

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
        style={{ zIndex: 20 }}
        lockAspectRatio={true}
      >
        <img
          src={src}
          alt="Watermark"
          className="w-full h-full object-contain pointer-events-none"
          style={{ opacity: state.opacity }}
        />
        <div className="absolute -top-3 -right-3 p-1 bg-gray-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" style={{ zIndex: 9999 }}>
          <Settings size={16} onClick={() => setIsSettingsOpen(!isSettingsOpen)} />
        </div>
      </Rnd>

      {isSettingsOpen && (
        <div className="absolute bg-gray-800 text-white p-4 rounded-lg shadow-lg" style={{ top: state.y + state.height + 10, left: state.x, zIndex: 30 }}>
          <h4 className="font-bold mb-2 text-sm">Watermark Settings</h4>
          
          {/* Opacity */}
          <div className="flex items-center gap-2 mb-2">
            <Palette size={16} />
            <label htmlFor="opacity" className="text-xs">Opacity</label>
            <input
              id="opacity"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={state.opacity}
              onChange={(e) => onChange({ ...state, opacity: parseFloat(e.target.value) })}
              className="w-24"
            />
          </div>

          {/* Animation */}
          <div className="mb-2">
             <label className="text-xs block mb-1">Animation</label>
             <div className="grid grid-cols-3 gap-1">
                {animationOptions.map(opt => (
                    <button 
                        key={opt.value}
                        onClick={() => onChange({ ...state, animation: opt.value })}
                        className={`p-1 rounded-md text-center ${state.animation === opt.value ? 'bg-blue-600' : 'bg-gray-700'}`}
                        title={opt.label}
                    >
                        {opt.icon}
                    </button>
                ))}
             </div>
          </div>

          {/* Visibility */}
          <button
            onClick={() => onChange({ ...state, visible: false })}
            className="w-full flex items-center justify-center gap-2 text-xs bg-red-600/80 hover:bg-red-600 p-2 rounded-md"
          >
            <EyeOff size={14} /> Hide Watermark
          </button>
        </div>
      )}
    </>
  );
};