// src/lib/FaceTracker.ts
// Singleton wrapper around MediaPipe FaceLandmarker

import { FaceLandmarks } from '@/types/filters';

// We'll import MediaPipe dynamically to avoid SSR issues
let FaceLandmarkerModule: any = null;
let FilesetResolverModule: any = null;

interface DetectionCache {
  landmarks: FaceLandmarks;
  timestamp: number;
}

interface DetectionResult {
  faceLandmarks: Array<Array<{ x: number; y: number; z: number }>>;
}

export class FaceTracker {
  private static instance: FaceTracker;
  private faceLandmarker: any = null;
  private initialized = false;
  private initPromise: Promise<boolean> | null = null;
  private detectionCache: Map<number, DetectionCache> = new Map();
  private lastDetectionTime: Map<number, number> = new Map();
  private detectionOrder: number[] = [];
  private currentDetectionIndex = 0;
  private readonly detectionInterval = 150; // ms between detections (~6.7 Hz)
  private readonly staleThreshold = 500; // ms before cached detection is considered stale
  private xnnpackLogSuppressed = false;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): FaceTracker {
    if (!FaceTracker.instance) {
      FaceTracker.instance = new FaceTracker();
    }
    return FaceTracker.instance;
  }

  /** Initialize MediaPipe FaceLandmarker. Returns true on success. */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    const result = await this.initPromise;
    this.initialized = result;
    return result;
  }

  private async _doInitialize(): Promise<boolean> {
    try {
      // Dynamic import to avoid SSR issues
      const visionModule = await import('@mediapipe/tasks-vision');
      FaceLandmarkerModule = visionModule.FaceLandmarker;
      FilesetResolverModule = visionModule.FilesetResolver;

      const wasmUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';

      const fileset = await FilesetResolverModule.forVisionTasks(wasmUrl);

      // Try GPU first, fall back to CPU silently
      let delegate: 'GPU' | 'CPU' = 'GPU';
      try {
        this.faceLandmarker = await FaceLandmarkerModule.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
      } catch {
        // GPU failed, retry with CPU
        delegate = 'CPU';
        this.faceLandmarker = await FaceLandmarkerModule.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
      }

      console.log(`FaceTracker: initialized successfully (${delegate} delegate)`);
      return true;
    } catch (error) {
      console.warn('FaceTracker: failed to initialize', error);
      return false;
    }
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  /** Register an actor for round-robin detection scheduling */
  registerActor(actorIndex: number): void {
    if (!this.detectionOrder.includes(actorIndex)) {
      this.detectionOrder.push(actorIndex);
    }
  }

  /** Unregister an actor */
  unregisterActor(actorIndex: number): void {
    this.detectionOrder = this.detectionOrder.filter((i) => i !== actorIndex);
    this.detectionCache.delete(actorIndex);
    this.lastDetectionTime.delete(actorIndex);
  }

  /**
   * Run face detection on a video element, if it's this actor's turn.
   * Uses round-robin scheduling: only one actor is detected per call,
   * cycling through all registered actors.
   *
   * Returns the (possibly cached) landmarks for the given actor.
   */
  detect(videoEl: HTMLVideoElement, actorIndex: number, timestamp: number): FaceLandmarks | null {
    if (!this.initialized || !this.faceLandmarker || !videoEl || videoEl.readyState < 2) {
      return this.getCached(actorIndex, timestamp);
    }

    // Check if it's time for a new detection for this actor
    const lastTime = this.lastDetectionTime.get(actorIndex) ?? 0;
    const shouldDetect = timestamp - lastTime >= this.detectionInterval;

    if (shouldDetect && this.detectionOrder.length > 0) {
      // Round-robin: only detect if it's this actor's turn
      const targetActor = this.detectionOrder[this.currentDetectionIndex % this.detectionOrder.length];

      if (targetActor === actorIndex) {
        try {
          const videoTimestamp = performance.now();

          // Suppress the one-time XNNPACK delegate INFO log from TFLite
          let result: DetectionResult;
          if (!this.xnnpackLogSuppressed) {
            const origInfo = console.info;
            console.info = (...args: unknown[]) => {
              if (typeof args[0] === 'string' && args[0].includes('XNNPACK')) return;
              origInfo.apply(console, args);
            };
            try {
              result = this.faceLandmarker.detectForVideo(videoEl, videoTimestamp) as DetectionResult;
            } finally {
              console.info = origInfo;
            }
            this.xnnpackLogSuppressed = true;
          } else {
            result = this.faceLandmarker.detectForVideo(videoEl, videoTimestamp) as DetectionResult;
          }

          if (result.faceLandmarks && result.faceLandmarks.length > 0) {
            const landmarks = this.extractLandmarks(result, videoEl.videoWidth, videoEl.videoHeight);
            this.detectionCache.set(actorIndex, {
              landmarks,
              timestamp,
            });
          } else {
            // No face detected — clear cache so filter disappears
            this.detectionCache.delete(actorIndex);
          }
          this.lastDetectionTime.set(actorIndex, timestamp);
        } catch {
          // Detection can fail if video isn't ready yet — silently ignore
        }
      } else {
        // Not this actor's turn — just update timestamp so they get a turn soon
        this.lastDetectionTime.set(actorIndex, timestamp);
      }

      // Advance round-robin pointer (for the NEXT call)
      if (actorIndex === targetActor || shouldDetect) {
        this.currentDetectionIndex++;
      }
    }

    return this.getCached(actorIndex, timestamp);
  }

  /** Get cached landmarks for an actor without running new detection.
   *  Returns null if the detection is too old (face has likely left the frame). */
  getCached(actorIndex: number, now: number = performance.now()): FaceLandmarks | null {
    const cached = this.detectionCache.get(actorIndex);
    if (!cached) return null;
    // If detection is older than the stale threshold, treat as no face
    if (now - cached.timestamp > this.staleThreshold) {
      this.detectionCache.delete(actorIndex);
      return null;
    }
    return cached.landmarks;
  }

  /**
   * Extract simplified landmarks from MediaPipe's 478-point result.
   * All coordinates are normalized to [0, 1].
   */
  private extractLandmarks(
    result: DetectionResult,
    videoWidth: number,
    videoHeight: number,
  ): FaceLandmarks {
    const lm = result.faceLandmarks[0]; // Array of {x, y, z} normalized to video dimensions

    // Helper: average of several landmark indices
    const avg = (indices: number[]) => {
      let x = 0,
        y = 0;
      for (const idx of indices) {
        x += lm[idx].x;
        y += lm[idx].y;
      }
      return { x: x / indices.length, y: y / indices.length };
    };

    // Face oval indices (tracing the face outline)
    const faceOvalIndices = [
      10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
      397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
      172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
    ];

    // Left eye center (indices around left eye)
    const leftEyeIndices = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
    // Right eye center
    const rightEyeIndices = [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382];
    // Mouth center
    const mouthIndices = [13, 14, 17, 84, 314, 61, 291, 78, 308];

    return {
      faceOval: faceOvalIndices.map((i) => ({ x: lm[i].x, y: lm[i].y })),
      leftEye: avg(leftEyeIndices),
      rightEye: avg(rightEyeIndices),
      nose: { x: lm[1].x, y: lm[1].y }, // nose tip
      mouth: avg(mouthIndices),
      // Approximate ear positions from face oval
      leftEar: avg([234, 127, 162]),
      rightEar: avg([454, 356, 389]),
      chinBottom: { x: lm[152].x, y: lm[152].y },
      foreheadTop: { x: lm[10].x, y: lm[10].y },
    };
  }
}
