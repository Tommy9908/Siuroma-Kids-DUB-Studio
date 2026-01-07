import React, { forwardRef } from 'react';

interface VideoPlayerProps {
  fileSrc: string | null;
  onTimeUpdate?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onEnded?: () => void;
  muted?: boolean;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ fileSrc, onTimeUpdate, onLoadedMetadata, onEnded, muted = false }, ref) => {
    if (!fileSrc) {
      return (
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
          {/* Placeholder content handled by parent overlay usually, but this is a fallback */}
        </div>
      );
    }

    return (
      <video
        ref={ref}
        src={fileSrc}
        className="w-full h-full object-contain"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        muted={muted}
      />
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
