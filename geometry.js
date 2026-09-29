import * as THREE from 'three';

// Star shape parameters.
const STAR_ARMS = 5;
const STAR_OUTER_RADIUS = 35;
const STAR_INNER_RADIUS = 15;
const STAR_DEPTH = 4;

// Heart shape parameters.
const HEART_SCALE = 2.2;

// The star is sampled as a closed polygon; building it once keeps
// per-particle sampling allocation-free at setup time.
const starPolygon = buildStarPolygon();

function buildStarPolygon() {
  const vertices = [];
  for (let arm = 0; arm < STAR_ARMS; arm++) {
    const outerAngle = (arm / STAR_ARMS) * Math.PI * 2 - Math.PI / 2;
    vertices.push(
      new THREE.Vector2(
        STAR_OUTER_RADIUS * Math.cos(outerAngle),
        STAR_OUTER_RADIUS * Math.sin(outerAngle)
      )
    );

    const innerAngle = outerAngle + Math.PI / STAR_ARMS;
    vertices.push(
      new THREE.Vector2(
        STAR_INNER_RADIUS * Math.cos(innerAngle),
        STAR_INNER_RADIUS * Math.sin(innerAngle)
      )
    );
  }
  return vertices;
}

/**
 * Samples the five-pointed star outline at a normalized parameter t in
 * [0, 1). The outline is walked proportionally, so every edge receives
 * an equal share of particles. A gentle z ripple gives the shape depth.
 */
export function sampleStar(t) {
  const edgeCount = starPolygon.length;
  const edge = t * edgeCount;
  const edgeIndex = Math.floor(edge) % edgeCount;
  const edgeProgress = edge - Math.floor(edge);

  const from = starPolygon[edgeIndex];
  const to = starPolygon[(edgeIndex + 1) % edgeCount];

  return new THREE.Vector3(
    THREE.MathUtils.lerp(from.x, to.x, edgeProgress),
    THREE.MathUtils.lerp(from.y, to.y, edgeProgress),
    Math.sin(t * Math.PI * 4) * (STAR_DEPTH / 2)
  );
}

/**
 * Samples the classic parametric heart curve:
 *
 *   x = 16 sin^3(theta)
 *   y = 13 cos(theta) - 5 cos(2 theta) - 2 cos(3 theta) - cos(4 theta)
 *
 * The z term keeps the heart from reading as a flat plane.
 */
export function sampleHeart(t) {
  const theta = t * Math.PI * 2;
  const x = 16 * Math.pow(Math.sin(theta), 3);
  const y =
    13 * Math.cos(theta) -
    5 * Math.cos(2 * theta) -
    2 * Math.cos(3 * theta) -
    Math.cos(4 * theta);
  const z = Math.sin(theta * 4) * 2;

  return new THREE.Vector3(x * HEART_SCALE, y * HEART_SCALE, z);
}

/**
 * Scatters a point slightly around its home position so the field reads
 * as organic instead of a mathematically perfect outline.
 */
export function jitter(point, strength) {
  return new THREE.Vector3(
    point.x + (Math.random() - 0.5) * strength,
    point.y + (Math.random() - 0.5) * strength,
    point.z + (Math.random() - 0.5) * strength * 0.5
  );
}