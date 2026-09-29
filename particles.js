import * as THREE from 'three';
import { MOTION, PARTICLE_COUNT, THEMES } from './config.js';
import { jitter, sampleHeart, sampleStar } from './geometry.js';

const POSITION_JITTER = 0.2;
const DRIFT_MIN_STRENGTH = 30;
const DRIFT_MAX_STRENGTH = 70;

// Derived cycle boundaries. The whole field stays in sync: assemble ->
// hold -> quick break -> scatter, so the shape always completes before
// it starts breaking apart.
const CYCLE = {
  assembleEnd: MOTION.scatterHold + MOTION.assembleWindow,
  holdEnd: MOTION.scatterHold + MOTION.assembleWindow + MOTION.holdWindow,
  breakEnd:
    MOTION.scatterHold + MOTION.assembleWindow + MOTION.holdWindow + MOTION.breakWindow,
  length:
    MOTION.scatterHold +
    MOTION.assembleWindow +
    MOTION.holdWindow +
    MOTION.breakWindow +
    MOTION.trailingScatter,
};

// Frame-rate independent exponential approach toward a target value.
// `rate` is expressed per second, so motion feels the same on 60 Hz and
// 120 Hz displays.
function approach(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

// Smoothstep easing used by the assembly and break phases.
function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

// Random outward direction used while the field breaks apart.
function randomDrift() {
  const strength =
    DRIFT_MIN_STRENGTH + Math.random() * (DRIFT_MAX_STRENGTH - DRIFT_MIN_STRENGTH);
  const azimuth = Math.random() * Math.PI * 2;
  const polar = Math.acos(2 * Math.random() - 1);

  return new THREE.Vector3(
    Math.sin(polar) * Math.cos(azimuth) * strength,
    Math.sin(polar) * Math.sin(azimuth) * strength,
    Math.cos(polar) * strength * 0.5
  );
}

/**
 * The particle field: one BufferGeometry holding every particle's home
 * positions (star + heart), base colours and drift vectors, plus the
 * per-frame logic that morphs, shimmers and cycles the cloud between
 * scattered and assembled states.
 */
export class ParticleField {
  constructor(scene) {
    this.count = PARTICLE_COUNT;
    this.elapsed = 0;
    // The field assembles into the heart first; toggling the morph
    // control sweeps it across to the star.
    this.morphProgress = 1;
    this.morphTarget = 1;
    this.palette = [];

    // Static per-particle values, recomputed only when the theme changes.
    this.baseColor = new Float32Array(this.count * 3);
    this.baseSize = new Float32Array(this.count);

    this.geometry = this.buildGeometry();
    this.material = this.buildMaterial();
    this.mesh = new THREE.Points(this.geometry, this.material);

    scene.add(this.mesh);
  }

  buildGeometry() {
    const { count } = this;
    const starHome = new Float32Array(count * 3);
    const heartHome = new Float32Array(count * 3);
    const driftOffset = new Float32Array(count * 3);
    const startPositions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const t = i / count;

      // Particles keep both shapes as home positions; the assembly
      // converges to whichever the morph progress points at, starting
      // with the heart.
      const star = jitter(sampleStar(t), POSITION_JITTER);
      const heart = jitter(sampleHeart(t), POSITION_JITTER);
      const drift = randomDrift();

      this.writeVector(starHome, i, star);
      this.writeVector(heartHome, i, heart);
      this.writeVector(driftOffset, i, drift);

      // The field starts fully scattered, offset from home by the full
      // drift vector, and converges during the opening sequence.
      this.writeVector(
        startPositions,
        i,
        new THREE.Vector3(star.x + drift.x, star.y + drift.y, star.z + drift.z)
      );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(startPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(count), 1));
    geometry.setAttribute('starHome', new THREE.BufferAttribute(starHome, 3));
    geometry.setAttribute('heartHome', new THREE.BufferAttribute(heartHome, 3));
    geometry.setAttribute('driftOffset', new THREE.BufferAttribute(driftOffset, 3));
    return geometry;
  }

  buildMaterial() {
    return new THREE.PointsMaterial({
      size: 2.8,
      map: this.createSpriteTexture(),
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      alphaTest: 0.01,
    });
  }

  // Renders a soft five-pointed spark sprite that every particle uses.
  createSpriteTexture() {
    const canvas = document.createElement('canvas');
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const center = size / 2;
    const outerRadius = size * 0.45;
    const innerRadius = size * 0.2;

    ctx.beginPath();
    ctx.moveTo(center, center - outerRadius);
    for (let arm = 0; arm < 5; arm++) {
      const outerAngle = (arm / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(
        center + outerRadius * Math.cos(outerAngle),
        center + outerRadius * Math.sin(outerAngle)
      );
      const innerAngle = outerAngle + Math.PI / 5;
      ctx.lineTo(
        center + innerRadius * Math.cos(innerAngle),
        center + innerRadius * Math.sin(innerAngle)
      );
    }
    ctx.closePath();

    const gradient = ctx.createRadialGradient(center, center, 0, center, center, outerRadius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 220, 0.9)');
    gradient.addColorStop(0.6, 'rgba(255, 200, 150, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Applies a theme by its id and retints the field. Returns the theme
   * object so the caller can also tune bloom and the page background.
   */
  applyTheme(themeId) {
    const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
    this.palette = theme.swatches.map((hex) => new THREE.Color(hex));
    this.retint();
    return theme;
  }

  // Recomputes every particle's base colour and size from the palette.
  // This runs once per theme change; the animation loop only modulates
  // brightness on top of these values.
  retint() {
    const { count, palette } = this;
    const work = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const t = i / count;
      const gradientPos = (t * palette.length * 1.5) % palette.length;
      const lower = Math.floor(gradientPos);
      const upper = (lower + 1) % palette.length;
      const blend = gradientPos - lower;

      work.lerpColors(palette[lower], palette[upper], blend);
      work.multiplyScalar(0.65 + Math.random() * 0.55);

      const i3 = i * 3;
      this.baseColor[i3] = work.r;
      this.baseColor[i3 + 1] = work.g;
      this.baseColor[i3 + 2] = work.b;
      this.baseSize[i] = 0.65 + Math.random() * 0.6;
    }

    this.refreshColorAttributes();
  }

  // Copies the static base values into the GPU-facing attributes.
  refreshColorAttributes() {
    this.geometry.attributes.color.array.set(this.baseColor);
    this.geometry.attributes.size.array.set(this.baseSize);
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }

  toggleMorph() {
    this.morphTarget = this.morphTarget === 0 ? 1 : 0;
  }

  update(dt, enabled) {
    if (!enabled) return;
    this.elapsed += dt;
    this.morphProgress = approach(this.morphProgress, this.morphTarget, MOTION.morphRate, dt);

    const { count, elapsed } = this;
    const morph = this.morphProgress;

    const attr = this.geometry.attributes;
    const positions = attr.position.array;
    const colors = attr.color.array;
    const sizes = attr.size.array;
    const starHome = attr.starHome.array;
    const heartHome = attr.heartHome.array;
    const driftOffset = attr.driftOffset.array;
    const baseColor = this.baseColor;
    const baseSize = this.baseSize;

    // The whole field runs one synchronised cycle: scattered -> slow
    // assembly sweep -> fully assembled hold -> quick break sweep ->
    // scattered again. Only the transitions sweep along the shape
    // (staggered by position), so the shape is always complete before
    // breaking starts.
    const cycleTime = elapsed % CYCLE.length;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const t = i / count;

      // Morph between the star and the heart.
      const homeX = THREE.MathUtils.lerp(starHome[i3], heartHome[i3], morph);
      const homeY = THREE.MathUtils.lerp(starHome[i3 + 1], heartHome[i3 + 1], morph);
      const homeZ = THREE.MathUtils.lerp(starHome[i3 + 2], heartHome[i3 + 2], morph);

      // Assembly progress for this particle. Inside the assemble and
      // break windows each particle gets a start time based on its
      // position along the shape, which creates the one-sided sweep.
      let assembly;
      if (cycleTime < MOTION.scatterHold) {
        assembly = 0;
      } else if (cycleTime < CYCLE.assembleEnd) {
        const start =
          MOTION.scatterHold + t * (MOTION.assembleWindow - MOTION.particleDuration);
        assembly = (cycleTime - start) / MOTION.particleDuration;
      } else if (cycleTime < CYCLE.holdEnd) {
        assembly = 1;
      } else if (cycleTime < CYCLE.breakEnd) {
        const start =
          CYCLE.holdEnd + t * (MOTION.breakWindow - MOTION.particleDuration);
        assembly = 1 - (cycleTime - start) / MOTION.particleDuration;
      } else {
        assembly = 0;
      }
      assembly = Math.min(Math.max(assembly, 0), 1);
      const scatter = 1 - smoothstep(assembly);

      // While scattered, each particle stays offset from its home point;
      // the cycle progress pulls it in and pushes it back out.
      const targetX = homeX + driftOffset[i3] * scatter;
      const targetY = homeY + driftOffset[i3 + 1] * scatter;
      const targetZ = homeZ + driftOffset[i3 + 2] * scatter;

      positions[i3] = approach(positions[i3], targetX, MOTION.settleRate, dt);
      positions[i3 + 1] = approach(positions[i3 + 1], targetY, MOTION.settleRate, dt);
      positions[i3 + 2] = approach(positions[i3 + 2], targetZ, MOTION.settleRate, dt);

      // Pulsing brightness that dims while scattered.
      const pulse = 0.65 + Math.sin(t * Math.PI * 7 + elapsed * MOTION.brightnessPulse) * 0.35;
      const flicker = 0.85 + Math.sin(elapsed * MOTION.brightnessFlicker + i * 0.5) * 0.15;
      const brightness = pulse * flicker * (1 - scatter * 0.75);

      colors[i3] = baseColor[i3] * brightness;
      colors[i3 + 1] = baseColor[i3 + 1] * brightness;
      colors[i3 + 2] = baseColor[i3 + 2] * brightness;

      // Size shrinks while scattered and grows past the base once the
      // shape is fully formed, ending noticeably bigger.
      const shimmer = 0.8 + Math.sin(elapsed * MOTION.sizeShimmer + i * 0.3) * 0.2;
      sizes[i] = Math.max(0.05, baseSize[i] * (1.2 - scatter * 0.9) * shimmer);
    }

    attr.position.needsUpdate = true;
    attr.color.needsUpdate = true;
    attr.size.needsUpdate = true;
  }

  writeVector(target, index, vector) {
    const i3 = index * 3;
    target[i3] = vector.x;
    target[i3 + 1] = vector.y;
    target[i3 + 2] = vector.z;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.material.map?.dispose();
  }
}