import React, { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { Settings, Trash2 } from 'lucide-react';

export type TextState = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  animation: string;
};

interface InteractiveTextProps {
  state: TextState;
  onChange: (newState: Partial<TextState>) => void;
  onDelete: () => void;
  containerRef: React.RefObject<HTMLElement | null>;
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

export const InteractiveText: React.FC<InteractiveTextProps> = ({ state, onChange, onDelete, containerRef }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editedText, setEditedText] = useState(state.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleDragStop = (e: any, d: any) => {
    if (!containerRef.current) {
      onChange({ x: d.x, y: d.y });
      return;
    }
    const rect = getVideoContentRect(containerRef.current);
    const clampedX = Math.max(rect.x, Math.min(d.x, rect.x + rect.width - state.width));
    const clampedY = Math.max(rect.y, Math.min(d.y, rect.y + rect.height - state.height));
    onChange({ x: clampedX, y: clampedY });
  };

  const handleResizeStop = (e: any, direction: any, ref: HTMLElement, delta: any, position: any) => {
    const newWidth = parseInt(ref.style.width, 10);
    const newHeight = parseInt(ref.style.height, 10);

    if (!containerRef.current) {
      onChange({ width: newWidth, height: newHeight, ...position });
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
      width: clampedW,
      height: clampedH,
      x: clampedX,
      y: clampedY,
    });
  };

  const handleBlur = () => {
    setIsEditing(false);
    onChange({ text: editedText });
  };

  const getBounds = () => {
    return containerRef.current ? containerRef.current : 'parent';
  };

  const handleDoubleClick = () => {
    if (!isSettingsOpen) {
      setIsEditing(true);
    }
  };

  return (
    <Rnd
      size={{ width: state.width, height: state.height }}
      position={{ x: state.x, y: state.y }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      bounds={getBounds()}
      className="group border border-dashed border-transparent hover:border-blue-500"
      style={{ zIndex: 21 }}
      minWidth={50}
      minHeight={30}
    >
      <div 
        className="w-full h-full flex items-center justify-center"
        onDoubleClick={handleDoubleClick}
        style={{
          color: state.color,
          fontSize: `${state.fontSize}px`,
          cursor: isEditing ? 'text' : 'move',
        }}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            onBlur={handleBlur}
            className="w-full h-full bg-transparent text-center resize-none border-none outline-none z-50"
            style={{
              color: state.color,
              fontSize: `${state.fontSize}px`,
            }}
          />
        ) : (
          <span className="p-2">{state.text}</span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="absolute -top-3 -right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ zIndex: 9999 }}>
        <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="p-1 bg-gray-800 rounded-full text-white hover:bg-gray-700">
          <Settings size={16} />
        </button>
        <button onClick={onDelete} className="p-1 bg-red-600 rounded-full text-white hover:bg-red-500">
          <Trash2 size={16} />
        </button>
      </div>

      {/* Settings Panel */}
      {isSettingsOpen && (
        <div 
          className="absolute top-full mt-2 left-0 bg-gray-800 p-3 rounded-lg shadow-xl w-64"
          onClick={(e) => e.stopPropagation()} // Prevent RND from capturing clicks
        >
          <div className="grid grid-cols-2 gap-3 text-sm text-white">
            <div>
              <label className="block mb-1 text-xs">Font Size</label>
              <input
                type="number"
                value={state.fontSize}
                onChange={(e) => onChange({ fontSize: parseInt(e.target.value, 10) })}
                className="w-full bg-gray-900 rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="block mb-1 text-xs">Color</label>
              <input
                type="color"
                value={state.color}
                onChange={(e) => onChange({ color: e.target.value })}
                className="w-full h-8 bg-gray-900 rounded"
              />
            </div>
            <div className="col-span-2">
              <label className="block mb-1 text-xs">Animation</label>
              <select
                value={state.animation}
                onChange={(e) => onChange({ animation: e.target.value })}
                className="w-full bg-gray-900 rounded px-2 py-1"
              >
                <option value="none">None</option>
                <option value="typewriter">Typewriter</option>
                <option value="scroll-up">Scroll Up</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </Rnd>
  );
};