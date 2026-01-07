// src/types/index.ts

export type SourceMode = 'file' | 'stream';
export type ActorCount = 1 | 2 | 3 | 4;

export interface VideoState {
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
}

// --- ADD THIS MISSING PART ---
export interface ActorDeviceConfig {
  [actorIndex: number]: {
    videoDeviceId?: string;
    audioDeviceId?: string;
  };
}
