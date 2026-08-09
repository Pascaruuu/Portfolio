import * as THREE from 'three';
import { ASCII_CELL_SIZE_DESKTOP, ASCII_CELL_SIZE_MOBILE } from '../sphere/constants.js';
import { viewport } from '../viewport.svelte.js';

const STREAK_COUNT = 900;
const FIELD_DEPTH = 1400;
const NEAR_RESPAWN_Z = -8;
const FAR_SPAWN_Z = NEAR_RESPAWN_Z - FIELD_DEPTH;
const RADIAL_SPREAD = 480;
const SPEED_VARIANCE = 0.6;
const TRAIL_LENGTH = 100;
const STREAK_WIDTH = 2;
const STREAK_COLOR = "#ffffff";
// Floor for a streak's projected length, in ASCII cells, so far-plane streaks still read as travel instead of sparkle.
const MIN_TRAIL_CELLS = 3;
// Inner spawn radius: the trail's world-space pull is at most TRAIL_LENGTH*uStretch (uStretch caps at 1), so any star with a smaller radial offset would have its tail pulled past the vanishing point and out the other side.
const INNER_RADIUS = TRAIL_LENGTH;

function buildStreakGeometry(): THREE.InstancedBufferGeometry {
	const geometry = new THREE.InstancedBufferGeometry();
	// Base quad in local space: x = width axis [-0.5, 0.5], y = trail fraction [0 = head, 1 = tail].
	const positions = new Float32Array([
		-0.5, 0, 0,
		 0.5, 0, 0,
		 0.5, 1, 0,
		-0.5, 0, 0,
		 0.5, 1, 0,
		-0.5, 1, 0,
	]);
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.instanceCount = STREAK_COUNT;

	const offsets = new Float32Array(STREAK_COUNT * 3);
	const speeds = new Float32Array(STREAK_COUNT);
	for (let i = 0; i < STREAK_COUNT; i++) {
		// Uniform-by-area annulus sample: sqrt of a uniform value in [innerR^2, outerR^2] avoids the centre-clustering a uniform radius would cause.
		const angle = Math.random() * Math.PI * 2;
		const radius = Math.sqrt(INNER_RADIUS * INNER_RADIUS + Math.random() * (RADIAL_SPREAD * RADIAL_SPREAD - INNER_RADIUS * INNER_RADIUS));
		offsets[i * 3]     = Math.cos(angle) * radius;
		offsets[i * 3 + 1] = Math.sin(angle) * radius;
		offsets[i * 3 + 2] = FAR_SPAWN_Z + Math.random() * FIELD_DEPTH;
		speeds[i] = 1 + (Math.random() * 2 - 1) * SPEED_VARIANCE;
	}
	geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
	geometry.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));

	return geometry;
}

function buildStreakMaterial(): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		uniforms: {
			uDistance: { value: 0 },
			uStretch: { value: 0.15 },
			uColor: { value: new THREE.Color(STREAK_COLOR) },
			uScreenHeightPx: { value: 0 },
			uCellPx: { value: 1 },
		},
		vertexShader: `
			attribute vec3 aOffset;
			attribute float aSpeed;
			uniform float uDistance;
			uniform float uStretch;
			uniform float uScreenHeightPx;
			uniform float uCellPx;
			varying float vTrailT;

			void main() {
				float span = ${FIELD_DEPTH.toFixed(1)};
				float localZ = mod(aOffset.z - (${FAR_SPAWN_Z.toFixed(1)}) + uDistance * aSpeed, span);
				vec3 headPos = vec3(aOffset.xy, (${FAR_SPAWN_Z.toFixed(1)}) + localZ);

				float trailT = position.y;
				vTrailT = trailT;

				vec4 headView = modelViewMatrix * vec4(headPos, 1.0);
				float dist = max(1.0, -headView.z);

				// projectionMatrix[1][1] is cot(fovY/2); scaling by screen height turns it into a device-px focal length.
				float focalPx = projectionMatrix[1][1] * uScreenHeightPx * 0.5;

				// Same world-space trail push as before, but its projected length is computed explicitly instead of left to fall out of the perspective divide.
				float worldLen = ${TRAIL_LENGTH.toFixed(1)} * uStretch;
				float naturalPx = worldLen / dist * focalPx;
				float floorPx = ${MIN_TRAIL_CELLS.toFixed(1)} * uCellPx;
				float pxLength = max(floorPx, naturalPx);

				// Pull the tail toward the vanishing point along the star's own radial direction (the same direction a pure Z-push already projects to); magnitude is solved from pxLength so it no longer depends on how far off-axis the star is.
				vec2 radial = headView.xy;
				float radialLen = length(radial);
				// Clamped denominator instead of a branch to a fixed direction: a near-zero offset now shrinks the pull toward zero instead of snapping to an arbitrary line through the vanishing point.
				vec2 dir = radial / max(radialLen, 0.0001);
				float viewMag = pxLength * dist / focalPx;

				vec4 viewPos = headView;
				viewPos.xy -= dir * viewMag * trailT;
				viewPos.x += position.x * ${STREAK_WIDTH.toFixed(2)} * (1.0 - trailT * 0.7);
				gl_Position = projectionMatrix * viewPos;
			}
		`,
		fragmentShader: `
			uniform vec3 uColor;
			varying float vTrailT;

			void main() {
				float alpha = 1.0 - vTrailT;
				gl_FragColor = vec4(uColor, alpha * alpha);
			}
		`,
		transparent: true,
		depthWrite: false,
		depthTest: false,
		blending: THREE.AdditiveBlending,
		side: THREE.DoubleSide,
	});
}

export interface LightspeedStreaks {
	mesh: THREE.Mesh;
	/** World units of travel per second; mirrors the old starfield's phase-driven speed value. */
	setSpeed(speed: number): void;
	update(deltaMs: number): void;
	/** Re-reads viewport height and ASCII cell size (device px); call after a resize. */
	resize(): void;
	dispose(): void;
}

export function createLightspeedStreaks(scene: THREE.Scene, renderer: THREE.WebGLRenderer): LightspeedStreaks {
	const geometry = buildStreakGeometry();
	const material = buildStreakMaterial();

	const mesh = new THREE.Mesh(geometry, material);
	mesh.frustumCulled = false;
	scene.add(mesh);

	let speed = 0;

	function syncViewportUniforms(): void {
		const cssCell = viewport.isDesktop ? ASCII_CELL_SIZE_DESKTOP : ASCII_CELL_SIZE_MOBILE;
		material.uniforms.uScreenHeightPx!.value = viewport.vh * renderer.getPixelRatio();
		material.uniforms.uCellPx!.value = cssCell * renderer.getPixelRatio();
	}
	syncViewportUniforms();

	return {
		mesh,
		setSpeed(next: number): void {
			speed = next;
			material.uniforms.uStretch!.value = 0.15 + Math.min(1, speed / 8) * 0.85;
		},
		update(deltaMs: number): void {
			material.uniforms.uDistance!.value += speed * (deltaMs / 1000);
		},
		resize: syncViewportUniforms,
		dispose(): void {
			scene.remove(mesh);
			geometry.dispose();
			material.dispose();
		},
	};
}
