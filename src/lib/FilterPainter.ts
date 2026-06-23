// src/lib/FilterPainter.ts
// Stateless canvas drawing functions for AR face filters
// All coordinates use normalized [0, 1] from landmarks, mapped to target canvas rect

import { FaceLandmarks, FilterDefinition, FilterTargetRect } from '@/types/filters';

// ─── Coordinate Mapping ───────────────────────────────────────────

/**
 * Map a normalized landmark point to canvas pixel coordinates,
 * accounting for object-fit: contain letterboxing (same math as drawImageContain).
 */
function mapLandmark(
  lx: number,
  ly: number,
  videoWidth: number,
  videoHeight: number,
  rect: FilterTargetRect,
): { x: number; y: number } {
  const videoAspect = videoWidth / videoHeight;
  const rectAspect = rect.w / rect.h;

  let drawW: number, drawH: number, drawX: number, drawY: number;

  if (videoAspect > rectAspect) {
    // Video is wider — letterbox top/bottom
    drawW = rect.w;
    drawH = rect.w / videoAspect;
    drawX = rect.x;
    drawY = rect.y + (rect.h - drawH) / 2;
  } else {
    // Video is taller — letterbox left/right
    drawH = rect.h;
    drawW = rect.h * videoAspect;
    drawX = rect.x + (rect.w - drawW) / 2;
    drawY = rect.y;
  }

  // Check for degenerate cases
  if (drawW <= 0 || drawH <= 0) {
    return { x: rect.x + lx * rect.w, y: rect.y + ly * rect.h };
  }

  return {
    x: drawX + lx * drawW,
    y: drawY + ly * drawH,
  };
}

/** Average multiple mapped landmark points */
function mapAvg(
  points: { x: number; y: number }[],
  videoWidth: number,
  videoHeight: number,
  rect: FilterTargetRect,
): { x: number; y: number } {
  let sx = 0,
    sy = 0;
  for (const p of points) {
    const m = mapLandmark(p.x, p.y, videoWidth, videoHeight, rect);
    sx += m.x;
    sy += m.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

// ─── Drawing Helpers ───────────────────────────────────────────────

/** Simple multiplicative hash for pseudo-random (non-patterned) distribution */
function hash(n: number): number {
  let h = (n * 2654435761) >>> 0; // Knuth's multiplicative hash
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) & 0x7fffffff;
  return h / 0x7fffffff;
}

/** Draw a potato-shaped blob (ellipse with irregular bumps) */
function drawPotatoShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  time: number,
) {
  const numPoints = 24;
  const wobbleAmp = Math.min(rx, ry) * 0.08;

  ctx.beginPath();
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    // Slight wobble for organic potato feel
    const wobble = Math.sin(angle * 3 + time * 0.001) * wobbleAmp +
      Math.cos(angle * 2 + time * 0.0015) * wobbleAmp * 0.5;
    const px = cx + Math.cos(angle) * (rx + wobble);
    const py = cy + Math.sin(angle) * (ry + wobble * 0.7);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ─── Filter Definitions ────────────────────────────────────────────

const potatoFilter: FilterDefinition = {
  id: 'potato',
  name: 'Potato',
  label: 'Potato',
  icon: '🥔',
  drawMask(ctx, landmarks, targetRect, videoWidth, videoHeight, time) {
    const { faceOval, leftEye, rightEye, mouth, chinBottom, foreheadTop } = landmarks;

    // Calculate face bounds from landmarks
    const faceCenter = mapAvg(faceOval, videoWidth, videoHeight, targetRect);
    const chin = mapLandmark(chinBottom.x, chinBottom.y, videoWidth, videoHeight, targetRect);
    const forehead = mapLandmark(foreheadTop.x, foreheadTop.y, videoWidth, videoHeight, targetRect);

    // Face dimensions
    const faceHeight = Math.abs(chin.y - forehead.y) * 1.1;
    const faceRx = faceHeight * 0.42; // potato horizontal radius
    const faceRy = faceHeight * 0.55; // potato vertical radius

    // Potato body color
    const potatoBody = '#8B6914';
    const potatoDark = '#6B4F12';
    const potatoLight = '#A0781E';

    // 1. Draw dirt/soil background (BEHIND everything, painted first)
    ctx.save();
    const bgGrad = ctx.createLinearGradient(targetRect.x, targetRect.y, targetRect.x, targetRect.y + targetRect.h);
    bgGrad.addColorStop(0, '#5C3D1A');
    bgGrad.addColorStop(0.5, '#4A2E0F');
    bgGrad.addColorStop(1, '#3B2208');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(targetRect.x, targetRect.y, targetRect.w, targetRect.h);

    // Small pebbles with proper hash distribution
    const numPebbles = 15;
    for (let i = 0; i < numPebbles; i++) {
      const px = targetRect.x + hash(i * 2) * targetRect.w;
      const py = targetRect.y + hash(i * 2 + 1) * targetRect.h;
      const pr = 3 + hash(i * 3 + 2) * 6;

      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      const pebbleColor = hash(i * 3) < 0.33 ? '#6B4F12' : hash(i * 3) < 0.66 ? '#3E2A0C' : '#8B6914';
      ctx.fillStyle = pebbleColor;
      ctx.fill();
    }
    ctx.restore();

    // 2. Draw potato body on face
    ctx.save();
    drawPotatoShape(ctx, faceCenter.x, faceCenter.y, faceRx, faceRy, time);

    // Gradient fill for 3D look
    const gradient = ctx.createRadialGradient(
      faceCenter.x - faceRx * 0.3,
      faceCenter.y - faceRy * 0.3,
      faceRx * 0.1,
      faceCenter.x,
      faceCenter.y,
      faceRx * 1.2,
    );
    gradient.addColorStop(0, potatoLight);
    gradient.addColorStop(0.6, potatoBody);
    gradient.addColorStop(1, potatoDark);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Outline
    ctx.strokeStyle = potatoDark;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 3. Cut eye holes through potato to reveal real eyes underneath
    const leftEyeCanvas = mapLandmark(leftEye.x, leftEye.y, videoWidth, videoHeight, targetRect);
    const rightEyeCanvas = mapLandmark(rightEye.x, rightEye.y, videoWidth, videoHeight, targetRect);
    const eyeSizeX = faceRx * 0.2;
    const eyeSizeY = faceRy * 0.22;

    for (const eye of [leftEyeCanvas, rightEyeCanvas]) {
      // Use destination-out to cut a hole through the potato body
      // This reveals the person's real eyes from the webcam video underneath
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.ellipse(eye.x, eye.y, eyeSizeX, eyeSizeY, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'white'; // fully opaque → fully removes potato
      ctx.fill();
      ctx.restore();

      // Soft brown rim around the eye hole to blend with potato skin
      ctx.beginPath();
      ctx.ellipse(eye.x, eye.y, eyeSizeX + 2, eyeSizeY + 2, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(80, 50, 15, 0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 3. Draw mouth (simple curved line on potato)
    const mouthCanvas = mapLandmark(mouth.x, mouth.y, videoWidth, videoHeight, targetRect);
    const mouthWidth = faceRx * 0.35;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(mouthCanvas.x - mouthWidth, mouthCanvas.y + mouthWidth * 0.1);
    ctx.quadraticCurveTo(
      mouthCanvas.x,
      mouthCanvas.y + mouthWidth * 0.5,
      mouthCanvas.x + mouthWidth,
      mouthCanvas.y + mouthWidth * 0.1,
    );
    ctx.strokeStyle = '#3E2A0C';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 4. Scatter potato "eyes" (small dark spots)
    ctx.save();
    const spots = [
      { ox: -0.4, oy: -0.5 },
      { ox: 0.35, oy: -0.3 },
      { ox: 0.15, oy: 0.4 },
      { ox: -0.25, oy: 0.3 },
      { ox: 0.4, oy: 0.15 },
      { ox: -0.5, oy: 0.0 },
      { ox: 0.0, oy: -0.6 },
    ];
    for (const spot of spots) {
      const sx = faceCenter.x + spot.ox * faceRx;
      const sy = faceCenter.y + spot.oy * faceRy;
      const sr = faceRx * (0.04 + Math.sin(spot.ox * 10 + spot.oy * 5) * 0.02);

      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = '#4A3510';
      ctx.fill();
    }
    ctx.restore();

  },
};

const catFilter: FilterDefinition = {
  id: 'cat',
  name: 'Cat',
  label: 'Cat',
  icon: '🐱',
  drawMask(ctx, landmarks, targetRect, videoWidth, videoHeight, time) {
    const { leftEye, rightEye, nose, mouth, leftEar, rightEar, foreheadTop } = landmarks;

    const leftEyeC = mapLandmark(leftEye.x, leftEye.y, videoWidth, videoHeight, targetRect);
    const rightEyeC = mapLandmark(rightEye.x, rightEye.y, videoWidth, videoHeight, targetRect);
    const noseC = mapLandmark(nose.x, nose.y, videoWidth, videoHeight, targetRect);
    const mouthC = mapLandmark(mouth.x, mouth.y, videoWidth, videoHeight, targetRect);
    const leftEarC = mapLandmark(leftEar.x, leftEar.y, videoWidth, videoHeight, targetRect);
    const rightEarC = mapLandmark(rightEar.x, rightEar.y, videoWidth, videoHeight, targetRect);
    const foreheadC = mapLandmark(foreheadTop.x, foreheadTop.y, videoWidth, videoHeight, targetRect);

    const eyeDist = Math.abs(rightEyeC.x - leftEyeC.x);
    const earHeight = eyeDist * 0.7;
    const earWidth = eyeDist * 0.4;

    // 1. Cat ears
    ctx.save();
    const earTwitch = Math.sin(time * 0.003) * 3; // slight ear twitch

    for (const ear of [
      { tip: leftEarC, side: 'left' as const },
      { tip: rightEarC, side: 'right' as const },
    ]) {
      const dir = ear.side === 'left' ? -1 : 1;
      const earBaseX = ear.tip.x + dir * earWidth * 0.2;
      const earBaseY = foreheadC.y;
      const earTipX = ear.tip.x + dir * earWidth * 0.5 + earTwitch * (ear.side === 'left' ? -1 : 1);
      const earTipY = ear.tip.y - earHeight;

      // Outer ear (dark)
      ctx.beginPath();
      ctx.moveTo(earBaseX - dir * earWidth * 0.4, earBaseY);
      ctx.lineTo(earTipX, earTipY);
      ctx.lineTo(earBaseX + dir * earWidth * 0.8, earBaseY);
      ctx.closePath();
      ctx.fillStyle = '#8B7355';
      ctx.fill();

      // Inner ear (pink)
      ctx.beginPath();
      ctx.moveTo(earBaseX - dir * earWidth * 0.15, earBaseY);
      ctx.lineTo(earTipX, earTipY + earHeight * 0.2);
      ctx.lineTo(earBaseX + dir * earWidth * 0.5, earBaseY);
      ctx.closePath();
      ctx.fillStyle = '#FFB6C1';
      ctx.fill();
    }

    // 2. Whiskers (6 lines radiating from nose area)
    const whiskerLength = eyeDist * 0.8;
    const whiskerAngles = [-15, 0, 15];

    for (const angle of whiskerAngles) {
      const radL = (Math.PI + (angle * Math.PI) / 180);
      const radR = (0 + (angle * Math.PI) / 180);

      // Left whiskers
      ctx.beginPath();
      ctx.moveTo(noseC.x - 5, noseC.y);
      ctx.lineTo(
        noseC.x - Math.cos(radL) * whiskerLength - Math.cos(radL) * whiskerLength,
        noseC.y - Math.sin(radL) * whiskerLength,
      );
      ctx.strokeStyle = '#6B6B6B';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Right whiskers
      ctx.beginPath();
      ctx.moveTo(noseC.x + 5, noseC.y);
      ctx.lineTo(
        noseC.x + Math.cos(radR) * whiskerLength + Math.cos(radR) * whiskerLength,
        noseC.y + Math.sin(radR) * whiskerLength,
      );
      ctx.stroke();
    }

    // 3. Pink nose triangle
    ctx.beginPath();
    const noseSize = eyeDist * 0.15;
    ctx.moveTo(noseC.x, noseC.y - noseSize);
    ctx.lineTo(noseC.x - noseSize * 0.6, noseC.y + noseSize * 0.5);
    ctx.lineTo(noseC.x + noseSize * 0.6, noseC.y + noseSize * 0.5);
    ctx.closePath();
    ctx.fillStyle = '#FF69B4';
    ctx.fill();

    // 4. Cat-eye outlines (almond shape over each eye)
    const catEyeW = eyeDist * 0.28;
    const catEyeH = eyeDist * 0.22;

    for (const eye of [leftEyeC, rightEyeC]) {
      ctx.beginPath();
      ctx.ellipse(eye.x, eye.y, catEyeW, catEyeH, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Vertical pupil slit
      ctx.beginPath();
      ctx.ellipse(eye.x, eye.y, catEyeW * 0.12, catEyeH * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#111';
      ctx.fill();
    }

    ctx.restore();
  },
};

const robotFilter: FilterDefinition = {
  id: 'robot',
  name: 'Robot',
  label: 'Robot',
  icon: '🤖',
  drawMask(ctx, landmarks, targetRect, videoWidth, videoHeight, time) {
    const { faceOval, leftEye, rightEye, mouth, foreheadTop, chinBottom } = landmarks;

    const faceCenter = mapAvg(faceOval, videoWidth, videoHeight, targetRect);
    const forehead = mapLandmark(foreheadTop.x, foreheadTop.y, videoWidth, videoHeight, targetRect);
    const chin = mapLandmark(chinBottom.x, chinBottom.y, videoWidth, videoHeight, targetRect);
    const leftEyeC = mapLandmark(leftEye.x, leftEye.y, videoWidth, videoHeight, targetRect);
    const rightEyeC = mapLandmark(rightEye.x, rightEye.y, videoWidth, videoHeight, targetRect);
    const mouthC = mapLandmark(mouth.x, mouth.y, videoWidth, videoHeight, targetRect);

    const faceHeight = Math.abs(chin.y - forehead.y);
    const faceWidth = faceHeight * 0.8;
    const eyeDist = Math.abs(rightEyeC.x - leftEyeC.x);

    // 1. Metallic face frame
    ctx.save();
    const frameX = faceCenter.x - faceWidth * 0.55;
    const frameY = forehead.y - faceHeight * 0.1;
    const frameW = faceWidth * 1.1;
    const frameH = faceHeight * 1.15;
    const frameR = faceWidth * 0.08;

    // Draw rounded rectangle frame
    ctx.beginPath();
    ctx.moveTo(frameX + frameR, frameY);
    ctx.lineTo(frameX + frameW - frameR, frameY);
    ctx.arcTo(frameX + frameW, frameY, frameX + frameW, frameY + frameR, frameR);
    ctx.lineTo(frameX + frameW, frameY + frameH - frameR);
    ctx.arcTo(frameX + frameW, frameY + frameH, frameX + frameW - frameR, frameY + frameH, frameR);
    ctx.lineTo(frameX + frameR, frameY + frameH);
    ctx.arcTo(frameX, frameY + frameH, frameX, frameY + frameH - frameR, frameR);
    ctx.lineTo(frameX, frameY + frameR);
    ctx.arcTo(frameX, frameY, frameX + frameR, frameY, frameR);
    ctx.closePath();

    // Metallic gradient
    const metalGrad = ctx.createLinearGradient(frameX, frameY, frameX + frameW, frameY + frameH);
    metalGrad.addColorStop(0, '#A8B8C8');
    metalGrad.addColorStop(0.3, '#D0D8E0');
    metalGrad.addColorStop(0.5, '#8090A0');
    metalGrad.addColorStop(0.7, '#C0C8D0');
    metalGrad.addColorStop(1, '#708090');
    ctx.fillStyle = metalGrad;
    ctx.fill();
    ctx.strokeStyle = '#506070';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // 2. LED eyes (glowing circles)
    const ledSize = eyeDist * 0.22;
    const blink = Math.sin(time * 0.002) > 0.92; // blink every few seconds

    for (const eye of [leftEyeC, rightEyeC]) {
      ctx.save();
      // Glow
      const glowGrad = ctx.createRadialGradient(eye.x, eye.y, ledSize * 0.1, eye.x, eye.y, ledSize * 1.3);
      if (blink) {
        glowGrad.addColorStop(0, 'rgba(0,255,200,0.1)');
        glowGrad.addColorStop(1, 'rgba(0,255,200,0)');
      } else {
        glowGrad.addColorStop(0, 'rgba(0,255,200,0.6)');
        glowGrad.addColorStop(0.5, 'rgba(0,200,150,0.2)');
        glowGrad.addColorStop(1, 'rgba(0,255,200,0)');
      }
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, ledSize * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // LED ring
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, ledSize, 0, Math.PI * 2);
      ctx.fillStyle = blink ? '#334' : '#00FFC8';
      ctx.fill();

      // Inner bright spot
      if (!blink) {
        ctx.beginPath();
        ctx.arc(eye.x, eye.y, ledSize * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }

      ctx.restore();
    }

    // 3. Gear/bolt cheeks
    const cheekRadius = eyeDist * 0.12;
    for (const cheek of [
      { x: leftEyeC.x - eyeDist * 0.4, y: leftEyeC.y + eyeDist * 0.5 },
      { x: rightEyeC.x + eyeDist * 0.4, y: rightEyeC.y + eyeDist * 0.5 },
    ]) {
      ctx.save();
      ctx.translate(cheek.x, cheek.y);
      const rotation = time * 0.001; // slow rotation

      // Gear shape
      const teeth = 6;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const angle = (i / (teeth * 2)) * Math.PI * 2 + rotation;
        const r = i % 2 === 0 ? cheekRadius : cheekRadius * 0.6;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#506070';
      ctx.fill();
      ctx.strokeStyle = '#8090A0';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Mouth grill (horizontal lines)
    const grillW = eyeDist * 0.6;
    const grillH = faceHeight * 0.12;
    const grillLines = 4;

    ctx.save();
    for (let i = 0; i < grillLines; i++) {
      const ly = mouthC.y - grillH * 0.5 + (i / (grillLines - 1)) * grillH;
      ctx.beginPath();
      ctx.moveTo(mouthC.x - grillW * 0.5, ly);
      ctx.lineTo(mouthC.x + grillW * 0.5, ly);
      ctx.strokeStyle = '#304050';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    // 5. Antenna on top
    const antennaBaseX = faceCenter.x;
    const antennaBaseY = frameY;
    const antennaHeight = faceHeight * 0.3;
    const antennaBallR = eyeDist * 0.1;

    ctx.save();
    // Antenna pole
    ctx.beginPath();
    ctx.moveTo(antennaBaseX, antennaBaseY);
    ctx.lineTo(antennaBaseX, antennaBaseY - antennaHeight);
    ctx.strokeStyle = '#607080';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Blinking light at top
    const blinkPhase = Math.sin(time * 0.005) * 0.5 + 0.5;
    const lightGrad = ctx.createRadialGradient(
      antennaBaseX, antennaBaseY - antennaHeight,
      antennaBallR * 0.1,
      antennaBaseX, antennaBaseY - antennaHeight,
      antennaBallR * 1.2,
    );
    lightGrad.addColorStop(0, `rgba(255,${Math.floor(50 + blinkPhase * 200)},50,1)`);
    lightGrad.addColorStop(0.5, `rgba(255,${Math.floor(50 + blinkPhase * 200)},50,0.6)`);
    lightGrad.addColorStop(1, 'rgba(255,100,50,0)');

    ctx.beginPath();
    ctx.arc(antennaBaseX, antennaBaseY - antennaHeight, antennaBallR * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = lightGrad;
    ctx.fill();

    // Antenna ball
    ctx.beginPath();
    ctx.arc(antennaBaseX, antennaBaseY - antennaHeight, antennaBallR, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(255,${Math.floor(50 + blinkPhase * 200)},50)`;
    ctx.fill();
    ctx.restore();
  },
};

const astronautFilter: FilterDefinition = {
  id: 'astronaut',
  name: 'Astronaut',
  label: 'Astronaut',
  icon: '🧑‍🚀',
  drawMask(ctx, landmarks, targetRect, videoWidth, videoHeight, time) {
    const { faceOval, foreheadTop, chinBottom } = landmarks;

    const faceCenter = mapAvg(faceOval, videoWidth, videoHeight, targetRect);
    const forehead = mapLandmark(foreheadTop.x, foreheadTop.y, videoWidth, videoHeight, targetRect);
    const chin = mapLandmark(chinBottom.x, chinBottom.y, videoWidth, videoHeight, targetRect);

    const faceHeight = Math.abs(chin.y - forehead.y);
    const helmetRx = faceHeight * 0.65;
    const helmetRy = faceHeight * 0.7;

    // 1. Starfield background
    ctx.save();
    ctx.fillStyle = '#0A0A1A';
    ctx.fillRect(targetRect.x, targetRect.y, targetRect.w, targetRect.h);

    // Stars with proper hash distribution (no visible pattern)
    const numStars = 40;
    for (let i = 0; i < numStars; i++) {
      const sx = targetRect.x + hash(i * 2) * targetRect.w;
      const sy = targetRect.y + hash(i * 2 + 1) * targetRect.h;
      const sr = 0.5 + hash(i * 3) * 2.5;
      const twinkle = (Math.sin(time * 0.002 + i * 1.7) + 1) / 2; // 0 to 1
      const alpha = 0.3 + twinkle * 0.7;

      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,${200 + Math.floor(twinkle * 55)},${alpha})`;
      ctx.fill();
    }
    ctx.restore();

    // 2. White helmet frame
    ctx.save();
    // Outer helmet
    ctx.beginPath();
    ctx.ellipse(faceCenter.x, faceCenter.y, helmetRx * 1.15, helmetRy * 1.15, 0, 0, Math.PI * 2);
    const helmetGrad = ctx.createLinearGradient(
      faceCenter.x - helmetRx, faceCenter.y - helmetRy,
      faceCenter.x + helmetRx, faceCenter.y + helmetRy,
    );
    helmetGrad.addColorStop(0, '#E8E8E8');
    helmetGrad.addColorStop(0.3, '#FFFFFF');
    helmetGrad.addColorStop(0.5, '#D0D0D0');
    helmetGrad.addColorStop(0.7, '#F0F0F0');
    helmetGrad.addColorStop(1, '#C0C0C0');
    ctx.fillStyle = helmetGrad;
    ctx.fill();
    ctx.strokeStyle = '#909090';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // 3. Visor (transparent face area — shows the real person inside)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(faceCenter.x, faceCenter.y, helmetRx, helmetRy, 0, 0, Math.PI * 2);

    // Semi-transparent blue tint for the visor
    ctx.fillStyle = 'rgba(100,150,255,0.12)';
    ctx.fill();

    // Visor rim
    ctx.strokeStyle = '#7080A0';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // 4. Visor reflection highlight (moving arc)
    ctx.save();
    const reflectAngle = time * 0.0003; // slowly rotating
    const reflectRadius = helmetRx * 0.65;

    ctx.beginPath();
    ctx.arc(
      faceCenter.x + Math.cos(reflectAngle) * helmetRx * 0.2,
      faceCenter.y - helmetRy * 0.15,
      reflectRadius,
      -Math.PI * 0.7 + reflectAngle,
      -Math.PI * 0.3 + reflectAngle,
    );
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = helmetRy * 0.12;
    ctx.stroke();
    ctx.restore();

    // 5. Oxygen tube lines (small curved lines at bottom of helmet)
    ctx.save();
    const tubeY = faceCenter.y + helmetRy * 0.9;
    const tubeStartX = faceCenter.x - helmetRx * 0.4;
    const tubeEndX = faceCenter.x + helmetRx * 0.4;

    ctx.beginPath();
    ctx.moveTo(tubeStartX, tubeY);
    ctx.quadraticCurveTo(
      faceCenter.x - helmetRx * 0.2,
      tubeY + helmetRy * 0.2,
      faceCenter.x,
      tubeY + helmetRy * 0.08,
    );
    ctx.strokeStyle = '#909090';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(faceCenter.x, tubeY + helmetRy * 0.08);
    ctx.quadraticCurveTo(
      faceCenter.x + helmetRx * 0.2,
      tubeY + helmetRy * 0.2,
      tubeEndX,
      tubeY,
    );
    ctx.stroke();
    ctx.restore();
  },
};

// ─── Filter Registry ───────────────────────────────────────────────

export const FILTER_DEFINITIONS: Record<string, FilterDefinition> = {
  none: {
    id: 'none',
    name: 'None',
    label: 'None',
    icon: '🚫',
    drawMask() {
      // no-op
    },
  },
  potato: potatoFilter,
  cat: catFilter,
  robot: robotFilter,
  astronaut: astronautFilter,
};

// ─── Public API ────────────────────────────────────────────────────

/**
 * Draw a filter effect on a canvas.
 *
 * @param ctx - Canvas 2D rendering context
 * @param landmarks - Face landmarks (normalized 0-1 coordinates)
 * @param filterId - Which filter to apply
 * @param targetRect - The rectangle on the canvas where the actor is (with object-fit:contain already applied)
 * @param videoWidth - Native width of the source video
 * @param videoHeight - Native height of the source video
 * @param time - Current time in ms (from performance.now()) for animation
 */
export function drawFilter(
  ctx: CanvasRenderingContext2D,
  landmarks: FaceLandmarks,
  filterId: string,
  targetRect: FilterTargetRect,
  videoWidth: number,
  videoHeight: number,
  time: number,
): void {
  const def = FILTER_DEFINITIONS[filterId];
  if (!def || filterId === 'none') return;

  // Draw background first (if defined)
  def.drawBackground?.(ctx, landmarks, targetRect, videoWidth, videoHeight, time);

  // Draw the main filter mask
  def.drawMask(ctx, landmarks, targetRect, videoWidth, videoHeight, time);
}

/**
 * Draw only the persistent background for a filter (no face data needed).
 * Called when the face has left the frame but the background should remain visible.
 */
export function drawPersistentBackground(
  ctx: CanvasRenderingContext2D,
  filterId: string,
  targetRect: FilterTargetRect,
  _videoWidth: number,
  _videoHeight: number,
  time: number,
): void {
  if (filterId === 'potato') {
    // Dirt/soil background
    ctx.save();
    const bgGrad = ctx.createLinearGradient(targetRect.x, targetRect.y, targetRect.x, targetRect.y + targetRect.h);
    bgGrad.addColorStop(0, '#5C3D1A');
    bgGrad.addColorStop(0.5, '#4A2E0F');
    bgGrad.addColorStop(1, '#3B2208');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(targetRect.x, targetRect.y, targetRect.w, targetRect.h);

    const numPebbles = 15;
    for (let i = 0; i < numPebbles; i++) {
      const px = targetRect.x + hash(i * 2) * targetRect.w;
      const py = targetRect.y + hash(i * 2 + 1) * targetRect.h;
      const pr = 3 + hash(i * 3 + 2) * 6;

      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = hash(i * 3) < 0.33 ? '#6B4F12' : hash(i * 3) < 0.66 ? '#3E2A0C' : '#8B6914';
      ctx.fill();
    }
    ctx.restore();
  } else if (filterId === 'astronaut') {
    // Starfield background
    ctx.save();
    ctx.fillStyle = '#0A0A1A';
    ctx.fillRect(targetRect.x, targetRect.y, targetRect.w, targetRect.h);

    const numStars = 40;
    for (let i = 0; i < numStars; i++) {
      const sx = targetRect.x + hash(i * 2) * targetRect.w;
      const sy = targetRect.y + hash(i * 2 + 1) * targetRect.h;
      const sr = 0.5 + hash(i * 3) * 2.5;
      const twinkle = (Math.sin(time * 0.002 + i * 1.7) + 1) / 2;
      const alpha = 0.3 + twinkle * 0.7;

      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,${200 + Math.floor(twinkle * 55)},${alpha})`;
      ctx.fill();
    }
    ctx.restore();
  }
}
