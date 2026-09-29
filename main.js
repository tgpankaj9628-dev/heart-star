import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { BLOOM, CAMERA, MOTION, THEME_SEGMENTS, THEMES } from './config.js';
import { ParticleField } from './particles.js';

const clock = new THREE.Clock();
let animating = true;
let morphed = false;
let elapsed = 0;
let autoTheme = 0;

// Cycle boundaries derived from the motion config; colour themes step
// while the shape is forming (assemble window).
const ASSEMBLE_END = MOTION.scatterHold + MOTION.assembleWindow;
const CYCLE_LENGTH =
  ASSEMBLE_END + MOTION.holdWindow + MOTION.breakWindow + MOTION.trailingScatter;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  CAMERA.fov,
  window.innerWidth / window.innerHeight,
  CAMERA.near,
  CAMERA.far
);
camera.position.z = CAMERA.startZ;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('container').appendChild(renderer.domElement);

// Orbit so the field can be inspected from any angle.
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.04;
controls.rotateSpeed = 0.3;
controls.minDistance = 30;
controls.maxDistance = 300;
controls.enablePan = false;

// Bloom pass gives the particles their neon glow.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  BLOOM.strength,
  BLOOM.radius,
  BLOOM.threshold
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const field = new ParticleField(scene);

buildControls();
setTheme(THEMES[0].id);

window.addEventListener('resize', onResize);
renderer.setAnimationLoop(tick);

function tick() {
  // Clamp the delta so a long tab-switch gap doesn't jump the animation.
  const dt = Math.min(clock.getDelta(), 0.1);
  if (animating) {
    elapsed += dt;
  }

  // While the shape is forming, the colour theme steps through the
  // palette one by one using the per-theme screen times in config; the
  // rest of the cycle keeps the last colour until the next assembly.
  const cycleTime = elapsed % CYCLE_LENGTH;
  if (cycleTime < ASSEMBLE_END) {
    let step = 0;
    let cursor = 0;
    for (let s = 0; s < THEME_SEGMENTS.length; s++) {
      cursor += THEME_SEGMENTS[s];
      if (cycleTime < cursor) {
        step = s;
        break;
      }
    }
    if (step !== autoTheme) {
      autoTheme = step;
      setTheme(THEMES[step].id);
    }
  }

  field.update(dt, animating);
  controls.update();
  composer.render();
}

function buildControls() {
  const controlsDiv = document.getElementById('controls');
  controlsDiv.innerHTML = '';

  const morphButton = document.createElement('button');
  morphButton.className = 'action-btn';
  morphButton.setAttribute('aria-label', 'Transform between star and heart');
  morphButton.textContent = '\u21C4'; // ⇄
  morphButton.addEventListener('click', () => {
    morphed = !morphed;
    field.toggleMorph();
    morphButton.classList.toggle('active', morphed);
  });
  controlsDiv.appendChild(morphButton);

  controlsDiv.appendChild(makeSeparator());

  const motionButton = document.createElement('button');
  motionButton.className = 'action-btn';
  motionButton.setAttribute('aria-label', 'Pause and resume motion');
  motionButton.textContent = '\u23F8'; // ⏸
  motionButton.addEventListener('click', () => {
    animating = !animating;
    motionButton.textContent = animating ? '\u23F8' : '\u25B6'; // ⏸ / ▶
  });
  controlsDiv.appendChild(motionButton);
}

function makeSeparator() {
  const separator = document.createElement('div');
  separator.className = 'separator';
  return separator;
}

function setTheme(themeId) {
  const theme = field.applyTheme(themeId);

  bloomPass.strength = theme.bloom.strength;
  bloomPass.radius = theme.bloom.radius;
  bloomPass.threshold = theme.bloom.threshold;

  document.body.dataset.theme = themeId;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}