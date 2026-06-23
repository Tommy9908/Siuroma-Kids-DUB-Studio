// src/types/filters.ts

export type FilterId = 'none' | 'potato' | 'cat' | 'robot' | 'astronaut';

/** Per-actor filter configuration */
export interface ActorFilterConfig {
  [actorIndex: number]: {
    id: FilterId;
  };
}

/** Simplified face landmarks extracted from MediaPipe's 478-point set */
export interface FaceLandmarks {
  /** Outline of the face (array of points forming an oval) */
  faceOval: { x: number; y: number }[];
  /** Center of left eye (normalized 0-1) */
  leftEye: { x: number; y: number };
  /** Center of right eye (normalized 0-1) */
  rightEye: { x: number; y: number };
  /** Nose tip (normalized 0-1) */
  nose: { x: number; y: number };
  /** Center of mouth (normalized 0-1) */
  mouth: { x: number; y: number };
  /** Approximate left ear / top-left of face */
  leftEar: { x: number; y: number };
  /** Approximate right ear / top-right of face */
  rightEar: { x: number; y: number };
  /** Bottom of chin */
  chinBottom: { x: number; y: number };
  /** Top of forehead */
  foreheadTop: { x: number; y: number };
}

/** Target rectangle on canvas for drawing a filter */
export interface FilterTargetRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Definition of a single filter effect */
export interface FilterDefinition {
  id: FilterId;
  name: string;
  label: string;
  icon: string; // emoji
  /** Draw the filter mask/effect on the canvas */
  drawMask: (
    ctx: CanvasRenderingContext2D,
    landmarks: FaceLandmarks,
    targetRect: FilterTargetRect,
    videoWidth: number,
    videoHeight: number,
    time: number,
  ) => void;
  /** Optional background drawing (drawn behind the actor) */
  drawBackground?: (
    ctx: CanvasRenderingContext2D,
    landmarks: FaceLandmarks,
    targetRect: FilterTargetRect,
    videoWidth: number,
    videoHeight: number,
    time: number,
  ) => void;
}

/** Display option for the filter picker */
export interface FilterOption {
  id: FilterId;
  name: string;
  label: string;
  icon: string;
}

export const FILTER_OPTIONS: FilterOption[] = [
  { id: 'none', name: 'None', label: 'None', icon: '🚫' },
  { id: 'potato', name: 'Potato', label: 'Potato', icon: '🥔' },
  { id: 'cat', name: 'Cat', label: 'Cat', icon: '🐱' },
  { id: 'robot', name: 'Robot', label: 'Robot', icon: '🤖' },
  { id: 'astronaut', name: 'Astronaut', label: 'Astronaut', icon: '🧑‍🚀' },
];
