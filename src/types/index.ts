// src/types/index.ts

export type SourceMode = 'file' | 'stream';
export type ActorCount = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

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
    name ?: string;
  };
}

// --- AR Stickers ---
export type StickerTarget = 'video' | number; // 'video' = on reference video, number = actor index

export interface StickerState {
  id: string;
  emoji: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  rotation: number;
  target: StickerTarget; // which area the sticker is placed on
}

// --- Actor Video Import ---
export interface ActorVideoState {
  src: string;
  duration: number;
  fileName: string;
}

export interface EmojiCategory {
  name: string;
  label: string;
  emojis: string[];
}

// --- AR Face Filters ---
export type { FilterId, ActorFilterConfig, FaceLandmarks, FilterTargetRect, FilterDefinition, FilterOption } from './filters';
export { FILTER_OPTIONS } from './filters';

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: 'faces',
    label: 'Faces',
    emojis: ['😀', '😍', '🤣', '😎', '🥳', '😜', '🤩', '😭', '😡', '🥺', '😱', '🤗', '😴', '🤔', '😇'],
  },
  {
    name: 'animals',
    label: 'Animals',
    emojis: ['🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🦄', '🐰', '🦁', '🐮', '🐷', '🐔', '🐲', '🐳', '🦋'],
  },
  {
    name: 'accessories',
    label: 'Accessories',
    emojis: ['👑', '🎩', '🕶️', '💍', '🎀', '👒', '🧢', '🎭', '👓', '🌟', '🌈', '🪄', '🎪', '🏆', '🎯'],
  },
  {
    name: 'hearts_stars',
    label: 'Hearts & Stars',
    emojis: ['❤️', '💖', '💕', '💗', '⭐', '✨', '🌟', '💫', '🔥', '💥', '🎉', '💝', '🧡', '💛', '💚'],
  },
];
