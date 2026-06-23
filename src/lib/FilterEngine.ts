// src/lib/FilterEngine.ts
// Orchestrator connecting FaceTracker + FilterPainter
// Used by both the live preview (FilterOverlay) and recording (useGridRecorder)

import { FaceTracker } from './FaceTracker';
import { drawFilter, drawPersistentBackground } from './FilterPainter';
import { ActorFilterConfig, FaceLandmarks, FilterTargetRect } from '@/types/filters';

export class FilterEngine {
  private faceTracker: FaceTracker;
  private filterConfig: ActorFilterConfig = {};
  private drawCallbacks: Map<number, () => void> = new Map();

  constructor() {
    this.faceTracker = FaceTracker.getInstance();
  }

  /** Initialize MediaPipe (call once on app mount) */
  async initialize(): Promise<boolean> {
    return this.faceTracker.initialize();
  }

  get isInitialized(): boolean {
    return this.faceTracker.isInitialized;
  }

  /** Update the per-actor filter configuration */
  setFilterConfig(config: ActorFilterConfig): void {
    this.filterConfig = config;
  }

  /** Set a single actor's filter */
  setActorFilter(actorIndex: number, filterId: string): void {
    this.filterConfig = {
      ...this.filterConfig,
      [actorIndex]: { id: filterId as any },
    };
  }

  /** Get the filter ID for an actor */
  getActorFilter(actorIndex: number): string {
    return this.filterConfig[actorIndex]?.id ?? 'none';
  }

  /** Register an actor for detection scheduling */
  registerActor(actorIndex: number): void {
    this.faceTracker.registerActor(actorIndex);
  }

  /** Unregister an actor */
  unregisterActor(actorIndex: number): void {
    this.faceTracker.unregisterActor(actorIndex);
  }

  /**
   * Process a single frame for the live preview overlay.
   * Runs face detection AND draws the filter on the overlay canvas.
   *
   * @param actorIndex - Which actor this is
   * @param videoEl - The <video> element showing the webcam/actor feed
   * @param ctx - Canvas 2D context of the overlay
   * @param targetRect - Full canvas rect (overlay fills the cell)
   * @param time - Current timestamp in ms
   */
  processOverlayFrame(
    actorIndex: number,
    videoEl: HTMLVideoElement,
    ctx: CanvasRenderingContext2D,
    targetRect: FilterTargetRect,
    time: number,
  ): void {
    const filterId = this.getActorFilter(actorIndex);
    if (filterId === 'none' || !videoEl || videoEl.readyState < 2) return;

    const vw = videoEl.videoWidth || 1280;
    const vh = videoEl.videoHeight || 720;

    const landmarks = this.faceTracker.detect(videoEl, actorIndex, time);
    if (!landmarks) {
      // No face detected — draw persistent background only (dirt, starfield, etc.)
      drawPersistentBackground(ctx, filterId, targetRect, vw, vh, time);
      return;
    }

    drawFilter(ctx, landmarks, filterId, targetRect, vw, vh, time);
  }

  /**
   * Draw a filter on the recording canvas using cached landmarks.
   * This is called from the useGridRecorder draw loop.
   * Does NOT run new face detection — uses the most recent cached result.
   *
   * @param ctx - Recording canvas 2D context
   * @param actorIndex - Which actor this is
   * @param targetRect - The sub-rectangle on the composite canvas where this actor is drawn
   * @param videoWidth - Native width of the source video
   * @param videoHeight - Native height of the source video
   * @param time - Current timestamp in ms
   */
  drawCachedOnRecording(
    ctx: CanvasRenderingContext2D,
    actorIndex: number,
    targetRect: FilterTargetRect,
    videoWidth: number,
    videoHeight: number,
    time: number,
  ): void {
    const filterId = this.getActorFilter(actorIndex);
    if (filterId === 'none') return;

    const landmarks = this.faceTracker.getCached(actorIndex);
    if (!landmarks) {
      // No face — draw persistent background only
      drawPersistentBackground(ctx, filterId, targetRect, videoWidth, videoHeight, time);
      return;
    }

    drawFilter(ctx, landmarks, filterId, targetRect, videoWidth, videoHeight, time);
  }

  /**
   * Run a face detection for the recording pipeline (round-robin, low frequency).
   * Call this once per draw frame to keep detections fresh for drawCachedOnRecording.
   */
  runDetectionForRecording(
    actorIndex: number,
    videoEl: HTMLVideoElement | undefined,
    time: number,
  ): void {
    if (!videoEl || videoEl.readyState < 2) return;
    this.faceTracker.detect(videoEl, actorIndex, time);
  }
}
