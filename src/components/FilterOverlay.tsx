'use client';

import React, { useEffect, useRef } from 'react';
import { FilterEngine } from '@/lib/FilterEngine';

interface FilterOverlayProps {
  actorIndex: number;
  videoEl: HTMLVideoElement | null;
  filterEngine: FilterEngine | null;
  filterId: string;
}

/**
 * Renders an absolutely-positioned <canvas> over an actor cell.
 * Runs a requestAnimationFrame loop to continuously draw AR filter effects
 * for the live studio preview.
 */
export const FilterOverlay: React.FC<FilterOverlayProps> = ({
  actorIndex,
  videoEl,
  filterEngine,
  filterId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Clear canvas when filter is removed / changed to 'none'
    const canvas = canvasRef.current;
    if (!filterEngine || !videoEl || filterId === 'none') {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    let animFrameId: number;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    filterEngine.registerActor(actorIndex);

    const loop = (time: number) => {
      const parent = canvas.parentElement;
      if (parent) {
        const pw = parent.clientWidth;
        const ph = parent.clientHeight;
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (videoEl.readyState >= 2) {
        filterEngine.processOverlayFrame(actorIndex, videoEl, ctx, {
          x: 0,
          y: 0,
          w: canvas.width,
          h: canvas.height,
        }, time);
      }

      animFrameId = requestAnimationFrame(loop);
    };

    animFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameId);
      // Clear canvas so filter effects don't linger on screen
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      filterEngine.unregisterActor(actorIndex);
    };
  }, [filterEngine, videoEl, actorIndex, filterId]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-15"
      style={{ pointerEvents: 'none' }}
    />
  );
};
