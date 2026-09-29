// Central configuration: every tunable value of the scene lives here so
// the rest of the code stays focused on behaviour.

// Number of particles that make up the field.
export const PARTICLE_COUNT = 10000;

// Camera setup.
export const CAMERA = {
  fov: 60,
  near: 0.1,
  far: 1500,
  startZ: 90,
};

// Post-processing bloom tuning.
export const BLOOM = {
  strength: 1.5,
  radius: 0.4,
  threshold: 0.85,
};

// Motion tuning. All rates are expressed per second so the animation
// behaves identically on displays with different refresh rates.
export const MOTION = {
  morphRate: 1.8, // star -> heart morph smoothing
  settleRate: 4.2, // return to home position
  particleDuration: 1.5, // seconds each particle takes to move in/out
  scatterHold: 3, // seconds fully scattered before assembling
  assembleWindow: 10, // seconds for the assembly sweep
  holdWindow: 8, // seconds fully assembled
  breakWindow: 2, // seconds for the quick break sweep
  trailingScatter: 2, // seconds scattered before the cycle restarts
  brightnessPulse: 1.1, // slow colour pulse
  brightnessFlicker: 4, // per-particle flicker
  sizeShimmer: 3.5, // per-particle size shimmer
};

// Seconds each theme keeps the screen while the shape is forming
// (assemble window), in the same order as THEMES. The values sum to
// the assemble window so the theme cycle stays aligned with the shape
// animation. Jade is kept intentionally short — just two seconds.
export const THEME_SEGMENTS = [5.5, 5.5, 2];

// Colour themes. `swatches` are hex values walked as a gradient, `bloom`
// overrides the global bloom pass for the theme's look.
export const THEMES = [
  {
    id: 'molten',
    label: 'Inferno',
    swatches: [0xff4800, 0xff8c00, 0xd73a00, 0x3d1005, 0xffc600],
    bloom: { strength: 0.35, radius: 0.45, threshold: 0.7 },
  },
  {
    id: 'cosmic',
    label: 'Aurora',
    swatches: [0x6a0dad, 0x9370db, 0x4b0082, 0x8a2be2, 0xdda0dd],
    bloom: { strength: 0.4, radius: 0.5, threshold: 0.65 },
  },
  {
    id: 'emerald',
    label: 'Jade',
    swatches: [0x00ff7f, 0x3cb371, 0x2e8b57, 0x00fa9a, 0x98fb98],
    bloom: { strength: 0.3, radius: 0.6, threshold: 0.75 },
  },
];