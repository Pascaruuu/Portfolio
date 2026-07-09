import * as THREE from 'three';

const STREAK_COUNT = 900;
const FIELD_DEPTH = 1400;
const NEAR_RESPAWN_Z = -8;
const FAR_SPAWN_Z = NEAR_RESPAWN_Z - FIELD_DEPTH;
const RADIAL_SPREAD = 480;
const SPEED_VARIANCE = 0.6;
const TRAIL_LENGTH = 34;
const STREAK_WIDTH = 1.4;
const STREAK_COLOR = 0xffffff;

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
		offsets[i * 3]     = (Math.random() * 2 - 1) * RADIAL_SPREAD;
		offsets[i * 3 + 1] = (Math.random() * 2 - 1) * RADIAL_SPREAD;
		offsets[i * 3 + 2] = FAR_SPAWN_Z + Math.random() * FIELD_DEPTH;
		speeds[i] = 1 + (Math.random() * 2 - 1) * SPEED_VARIANCE;
	}
	// TEMP DEBUG — remove before commit
	{
		let xMin = Infinity, xMax = -Infinity, xSum = 0;
		let yMin = Infinity, yMax = -Infinity, ySum = 0;
		let zMin = Infinity, zMax = -Infinity;
		for (let i = 0; i < STREAK_COUNT; i++) {
			const x = offsets[i * 3]!;
			const y = offsets[i * 3 + 1]!;
			const z = offsets[i * 3 + 2]!;
			if (x < xMin) xMin = x;
			if (x > xMax) xMax = x;
			xSum += x;
			if (y < yMin) yMin = y;
			if (y > yMax) yMax = y;
			ySum += y;
			if (z < zMin) zMin = z;
			if (z > zMax) zMax = z;
		}
		console.log('[streaks debug] instanceCount =', offsets.length / 3);
		console.log('[streaks debug] X  min=%s max=%s mean=%s', xMin, xMax, xSum / STREAK_COUNT);
		console.log('[streaks debug] Y  min=%s max=%s mean=%s', yMin, yMax, ySum / STREAK_COUNT);
		console.log('[streaks debug] Z  min=%s max=%s', zMin, zMax);
	}
	// END TEMP DEBUG

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
		},
		vertexShader: `
			attribute vec3 aOffset;
			attribute float aSpeed;
			uniform float uDistance;
			uniform float uStretch;
			varying float vTrailT;

			void main() {
				float span = ${FIELD_DEPTH.toFixed(1)};
				float localZ = mod(aOffset.z - (${FAR_SPAWN_Z.toFixed(1)}) + uDistance * aSpeed, span);
				vec3 headPos = vec3(aOffset.xy, (${FAR_SPAWN_Z.toFixed(1)}) + localZ);

				float trailT = position.y;
				vTrailT = trailT;
				vec3 corePos = headPos - vec3(0.0, 0.0, trailT * ${TRAIL_LENGTH.toFixed(1)} * uStretch);

				vec4 viewPos = modelViewMatrix * vec4(corePos, 1.0);
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
	dispose(): void;
}

export function createLightspeedStreaks(scene: THREE.Scene): LightspeedStreaks {
	const geometry = buildStreakGeometry();
	const material = buildStreakMaterial();

	const mesh = new THREE.Mesh(geometry, material);
	mesh.frustumCulled = false;
	scene.add(mesh);

	let speed = 0;

	return {
		mesh,
		setSpeed(next: number): void {
			speed = next;
			material.uniforms.uStretch!.value = 0.15 + Math.min(1, speed / 8) * 0.85;
		},
		update(deltaMs: number): void {
			material.uniforms.uDistance!.value += speed * (deltaMs / 1000);
		},
		dispose(): void {
			scene.remove(mesh);
			geometry.dispose();
			material.dispose();
		},
	};
}
