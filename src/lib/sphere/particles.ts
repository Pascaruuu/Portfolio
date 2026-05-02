import * as THREE from 'three';
import {
	FLOW_MAX,
	PARTICLE_DRIFT_RADIUS,
	PARTICLE_RADIAL_AMPLITUDE,
	SPHERE_R,
	WAVE_AMPLITUDE,
	WAVE_DECAY,
	WAVE_SPEED,
	WAVE_WIDTH,
} from './constants.js';
import type { WaveState } from './types.js';
import { buildParticles } from './helpers.js';

type ParticleShaderMaterial = THREE.ShaderMaterial & {
	size: number;
	uniforms: THREE.ShaderMaterial['uniforms'] & {
		uTime: THREE.IUniform<number>;
		uSize: THREE.IUniform<number>;
	};
};

export interface ParticleSystem {
	particlePoints: THREE.Points;
	particleMaterial: ParticleShaderMaterial;
	particlePositions: THREE.BufferAttribute;
	particleColors: THREE.BufferAttribute;
	particlePositionArray: Float32Array;
	baseParticlePositions: Float32Array;
	baseParticleColors: Float32Array;
	particleNormals: Float32Array;
	particleTangents: Float32Array;
	particleBitangents: Float32Array;
	particlePhases: Float32Array;
	particleSpeeds: Float32Array;
	particleAmplitudes: Float32Array;
	particleTwists: Float32Array;
	particleClusterWeight: Float32Array;
	waveSurface: THREE.Mesh;
	depthOccluder: THREE.Mesh;
}

export interface UpdateParticlesParams {
	pulse: number;
	flowVelX: number;
	flowVelY: number;
	waveStates: WaveState[];
	now: number;
	particleMaterial: ParticleShaderMaterial;
	particlePositions: THREE.BufferAttribute;
	particleColors: THREE.BufferAttribute;
	particlePositionArray: Float32Array;
	baseParticlePositions: Float32Array;
	baseParticleColors: Float32Array;
	particleNormals: Float32Array;
	particleTangents: Float32Array;
	particleBitangents: Float32Array;
	particlePhases: Float32Array;
	particleSpeeds: Float32Array;
	particleAmplitudes: Float32Array;
	particleTwists: Float32Array;
	particleClusterWeight: Float32Array;
}

function buildLandBiasedParticles(targetCount: number): { geometry: THREE.BufferGeometry; terrainValues: Float32Array } {
	const candidateCount = Math.ceil(targetCount * 3.2);
	const { geometry: candidateGeometry, terrainValues: candidateTerrainValues } = buildParticles(candidateCount, SPHERE_R);
	const candidatePositions = candidateGeometry.getAttribute('position') as THREE.BufferAttribute;
	const candidateColors = candidateGeometry.getAttribute('color') as THREE.BufferAttribute;
	const candidatePositionArray = candidatePositions.array as ArrayLike<number>;
	const candidateColorArray = candidateColors.array as ArrayLike<number>;
	const landIndices: number[] = [];
	const sparseWaterIndices: number[] = [];

	for (let i = 0; i < candidateCount; i++) {
		const terrain = candidateTerrainValues[i] ?? -1;
		if (terrain >= 0.05) {
			landIndices.push(i);
		} else if (terrain >= -0.08 && Math.random() < 0.018) {
			sparseWaterIndices.push(i);
		}
	}

	const selectedIndices = landIndices.slice(0, Math.max(0, targetCount - sparseWaterIndices.length));
	selectedIndices.push(...sparseWaterIndices.slice(0, Math.max(0, targetCount - selectedIndices.length)));
	if (selectedIndices.length < targetCount) {
		const fallbackIndices = Array.from({ length: candidateCount }, (_, i) => i)
			.filter((i) => !selectedIndices.includes(i))
			.sort((a, b) => (candidateTerrainValues[b] ?? -1) - (candidateTerrainValues[a] ?? -1));
		selectedIndices.push(...fallbackIndices.slice(0, targetCount - selectedIndices.length));
	}

	const selectedCount = selectedIndices.length;
	const positions = new Float32Array(selectedCount * 3);
	const colors = new Float32Array(selectedCount * 3);
	const selectedTerrainValues = new Float32Array(selectedCount);
	for (let i = 0; i < selectedCount; i++) {
		const sourceIndex = selectedIndices[i] ?? 0;
		const sourceI3 = sourceIndex * 3;
		const targetI3 = i * 3;
		positions[targetI3] = candidatePositionArray[sourceI3] ?? 0;
		positions[targetI3 + 1] = candidatePositionArray[sourceI3 + 1] ?? 0;
		positions[targetI3 + 2] = candidatePositionArray[sourceI3 + 2] ?? 0;
		colors[targetI3] = candidateColorArray[sourceI3] ?? 0;
		colors[targetI3 + 1] = candidateColorArray[sourceI3 + 1] ?? 0;
		colors[targetI3 + 2] = candidateColorArray[sourceI3 + 2] ?? 0;
		selectedTerrainValues[i] = Math.max(0.05, candidateTerrainValues[sourceIndex] ?? 0.05);
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
	candidateGeometry.dispose();
	return { geometry, terrainValues: selectedTerrainValues };
}

export function createParticleSystem(sphereGroup: THREE.Group, particleCount: number): ParticleSystem {
	const { geometry: particleGeometry, terrainValues } = buildLandBiasedParticles(particleCount);
	const particlePositions = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
	const particleColors = particleGeometry.getAttribute('color') as THREE.BufferAttribute;
	particleGeometry.setAttribute('terrain', new THREE.BufferAttribute(terrainValues, 1));
	const flickerPhases = new Float32Array(particleCount);
	for (let i = 0; i < particleCount; i++) flickerPhases[i] = Math.random() * 6.28;
	particleGeometry.setAttribute('flickerPhase', new THREE.BufferAttribute(flickerPhases, 1));
	const driftPhases = new Float32Array(particleCount);
	for (let i = 0; i < particleCount; i++) driftPhases[i] = Math.random() * 6.28;
	particleGeometry.setAttribute('driftPhase', new THREE.BufferAttribute(driftPhases, 1));
	const particlePositionArray = particlePositions.array as Float32Array;
	const baseParticleColors = new Float32Array(particleColors.array as ArrayLike<number>);
	const baseParticlePositions = new Float32Array(particlePositionArray);
	const particleNormals = new Float32Array(particleCount * 3);
	const particleTangents = new Float32Array(particleCount * 3);
	const particleBitangents = new Float32Array(particleCount * 3);
	const particlePhases = new Float32Array(particleCount);
	const particleSpeeds = new Float32Array(particleCount);
	const particleAmplitudes = new Float32Array(particleCount);
	const particleTwists = new Float32Array(particleCount);
	const particleClusterWeight = new Float32Array(particleCount);
	const hotspotStartIndex = particleCount - Math.floor(particleCount * 0.72);

	for (let i = 0; i < particleCount; i++) {
		const i3 = i * 3;
		const px = baseParticlePositions[i3] ?? 0;
		const py = baseParticlePositions[i3 + 1] ?? 0;
		const pz = baseParticlePositions[i3 + 2] ?? 0;
		const len = Math.hypot(px, py, pz) || 1;
		const nx = px / len;
		const ny = py / len;
		const nz = pz / len;
		particleNormals[i3] = nx;
		particleNormals[i3 + 1] = ny;
		particleNormals[i3 + 2] = nz;

		const ref = Math.abs(ny) < 0.92
			? new THREE.Vector3(0, 1, 0)
			: new THREE.Vector3(1, 0, 0);
		const tangent = new THREE.Vector3(nx, ny, nz).cross(ref).normalize();
		const bitangent = new THREE.Vector3(nx, ny, nz).cross(tangent).normalize();
		particleTangents[i3] = tangent.x;
		particleTangents[i3 + 1] = tangent.y;
		particleTangents[i3 + 2] = tangent.z;
		particleBitangents[i3] = bitangent.x;
		particleBitangents[i3 + 1] = bitangent.y;
		particleBitangents[i3 + 2] = bitangent.z;

		particlePhases[i] = Math.random() * Math.PI * 2;
		particleSpeeds[i] = 0.55 + Math.random() * 0.75;
		particleAmplitudes[i] = 0.45 + Math.random() * 0.85;
		particleTwists[i] = Math.random() * Math.PI * 2;
		particleClusterWeight[i] = i >= hotspotStartIndex ? 1 : 0;
	}

	const FLICKER_CHARS = ' .,·:;+x';
	const CHAR_COUNT = FLICKER_CHARS.length;
	const CELL = 10;
	const atlas = document.createElement('canvas');
	atlas.width = CELL * CHAR_COUNT;
	atlas.height = CELL;
	const ctx = atlas.getContext('2d')!;
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, atlas.width, atlas.height);
	ctx.fillStyle = '#fff';
	ctx.font = `bold ${Math.floor(CELL * 0.85)}px "Courier New", monospace`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	for (let i = 0; i < CHAR_COUNT; i++) {
		ctx.fillText(FLICKER_CHARS[i]!, i * CELL + CELL / 2, CELL / 2);
	}
	const charTex = new THREE.CanvasTexture(atlas);
	charTex.minFilter = THREE.NearestFilter;
	charTex.magFilter = THREE.NearestFilter;

	const particleMaterial = new THREE.ShaderMaterial({
		uniforms: {
			uCharacters: { value: charTex },
			uCharCount: { value: CHAR_COUNT },
			uTime: { value: 0 },
			uOpacity: { value: 0.9 },
			uSize: { value: 10.0 },
		},
		vertexShader: `
			attribute float terrain;
			attribute vec3 color;
			attribute float flickerPhase;
			attribute float driftPhase;
			uniform float uTime;
			uniform float uCharCount;
			uniform float uSize;
			varying vec3 vColor;
			varying float vTerrain;
			varying float vFlicker;
			varying vec2 vDrift;

			void main() {
				vColor = color;
				vTerrain = terrain;
				// Flicker: slow phase-offset sine mapped to char index
				vFlicker = mod(floor((sin(uTime * 0.8 + flickerPhase) * 0.5 + 0.5) * float(uCharCount - 1.0) + 0.5), float(uCharCount));
				vDrift = vec2(0.0);
				vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
				gl_PointSize = uSize * (300.0 / -mvPosition.z);
				gl_Position = projectionMatrix * mvPosition;
			}
		`,
		fragmentShader: `
			uniform sampler2D uCharacters;
			uniform float uCharCount;
			uniform float uOpacity;
			varying vec3 vColor;
			varying float vTerrain;
			varying float vFlicker;

			void main() {
				if (vTerrain < 0.05) discard;
				float charIndex = vFlicker;
				vec2 atlasUV = vec2((charIndex + gl_PointCoord.x) / uCharCount, gl_PointCoord.y);
				float alpha = texture2D(uCharacters, atlasUV).r;
				if (alpha < 0.2) discard;
				gl_FragColor = vec4(vColor, uOpacity * alpha);
			}
		`,
		transparent: true,
		blending: THREE.NormalBlending,
		depthWrite: false,
	}) as ParticleShaderMaterial;
	Object.defineProperty(particleMaterial, 'size', {
		get() {
			return this.uniforms.uSize.value as number;
		},
		set(value: number) {
			this.uniforms.uSize.value = value;
		},
	});
	const particlePoints = new THREE.Points(
		particleGeometry,
		particleMaterial
	);
	particlePoints.renderOrder = 1;
	particlePoints.layers.set(1);
	sphereGroup.add(particlePoints);

	const waveSurface = new THREE.Mesh(
		new THREE.SphereGeometry(SPHERE_R, 32, 32),
		new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
	);
	sphereGroup.add(waveSurface);

	const depthOccluder = new THREE.Mesh(
		new THREE.SphereGeometry(SPHERE_R * 0.985, 36, 36),
		new THREE.MeshBasicMaterial({
			colorWrite: false,
			depthWrite: true,
			depthTest: true,
		})
	);
	depthOccluder.renderOrder = 2;
	sphereGroup.add(depthOccluder);

	return {
		particlePoints,
		particleMaterial,
		particlePositions,
		particleColors,
		particlePositionArray,
		baseParticlePositions,
		baseParticleColors,
		particleNormals,
		particleTangents,
		particleBitangents,
		particlePhases,
		particleSpeeds,
		particleAmplitudes,
		particleTwists,
		particleClusterWeight,
		waveSurface,
		depthOccluder,
	};
}

export function updateParticles(params: UpdateParticlesParams): void {
	const {
		pulse,
		flowVelX,
		flowVelY,
		waveStates,
		now,
		particlePositions,
		particleColors,
		particlePositionArray,
		baseParticlePositions,
		baseParticleColors,
		particleNormals,
		particleTangents,
		particleBitangents,
		particlePhases,
		particleSpeeds,
		particleAmplitudes,
		particleTwists,
		particleClusterWeight,
	} = params;
	const activeWaveStates = waveStates.filter(
		(wave) => now - wave.startTime <= Math.PI / WAVE_SPEED + WAVE_DECAY
	);
	waveStates.splice(0, waveStates.length, ...activeWaveStates);

	for (let i = 0; i < particlePhases.length; i++) {
		const i3 = i * 3;
		const baseX = baseParticlePositions[i3] ?? 0;
		const baseY = baseParticlePositions[i3 + 1] ?? 0;
		const baseZ = baseParticlePositions[i3 + 2] ?? 0;
		const nx = particleNormals[i3] ?? 0;
		const ny = particleNormals[i3 + 1] ?? 0;
		const nz = particleNormals[i3 + 2] ?? 0;
		const tx = particleTangents[i3] ?? 0;
		const ty = particleTangents[i3 + 1] ?? 0;
		const tz = particleTangents[i3 + 2] ?? 0;
		const bx = particleBitangents[i3] ?? 0;
		const by = particleBitangents[i3 + 1] ?? 0;
		const bz = particleBitangents[i3 + 2] ?? 0;
		const phase = particlePhases[i] ?? 0;
		const speed = particleSpeeds[i] ?? 1;
		const driftAmp = particleAmplitudes[i] ?? 1;
		const twist = particleTwists[i] ?? 0;
		const clusterWeight = particleClusterWeight[i] ?? 0;

		const driftPhase = pulse * speed + phase;
		const radialOffset = Math.sin(driftPhase) * PARTICLE_RADIAL_AMPLITUDE * driftAmp;
		const tangentOffset = Math.cos(driftPhase * 0.9 + twist) * PARTICLE_DRIFT_RADIUS * driftAmp;
		const bitangentOffset = Math.sin(driftPhase * 1.15 - twist) * PARTICLE_DRIFT_RADIUS * 0.72 * driftAmp;

		const flowYx = nz;
		const flowYy = 0;
		const flowYz = -nx;
		const flowXx = 0;
		const flowXy = -nz;
		const flowXz = ny;
		const flowScale = 0.45 + Math.max(0, nz) * 0.58 + clusterWeight * 0.22;
		const cohesion = 1 + clusterWeight * 0.2;
		const waterX = (flowYx * flowVelX + flowXx * flowVelY) * driftAmp * flowScale;
		const waterY = (flowYy * flowVelX + flowXy * flowVelY) * driftAmp * flowScale;
		const waterZ = (flowYz * flowVelX + flowXz * flowVelY) * driftAmp * flowScale;
		const gooPulse = Math.sin(driftPhase * 0.55 + twist) * clusterWeight * 0.4;
		const surfaceClamp = 1 - clusterWeight * 0.86;

		let waveOffset = 0;
		for (const wave of waveStates) {
			const waveAge = now - wave.startTime;
			const waveDot = THREE.MathUtils.clamp(
				nx * wave.origin.x + ny * wave.origin.y + nz * wave.origin.z,
				-1,
				1
			);
			const angularDist = Math.acos(waveDot);
			const waveFront = waveAge * WAVE_SPEED;
			const bandDist = Math.abs(angularDist - waveFront);
			const band = Math.exp(-Math.pow(bandDist / WAVE_WIDTH, 2));
			const tail = Math.exp(-waveAge * WAVE_DECAY);
			waveOffset += band * tail * WAVE_AMPLITUDE;
		}

		particlePositionArray[i3] =
			baseX + nx * ((radialOffset + waveOffset + gooPulse) * surfaceClamp) + tx * (tangentOffset * cohesion) + bx * (bitangentOffset * cohesion) + waterX;
		particlePositionArray[i3 + 1] =
			baseY + ny * ((radialOffset + waveOffset + gooPulse) * surfaceClamp) + ty * (tangentOffset * cohesion) + by * (bitangentOffset * cohesion) + waterY;
		particlePositionArray[i3 + 2] =
			baseZ + nz * ((radialOffset + waveOffset + gooPulse) * surfaceClamp) + tz * (tangentOffset * cohesion) + bz * (bitangentOffset * cohesion) + waterZ;

		const frontDot = Math.max(0, nx * 0.3 + ny * 0.2 + nz * 0.9) * 0.6 + 0.4;
		const highlight = Math.pow(frontDot, 1.4) * 0.45;
		const waveGlow = waveOffset / WAVE_AMPLITUDE;
		const brightness = 0.55 + highlight + waveGlow * 0.55;
		const baseR = baseParticleColors[i3] ?? 0;
		const baseG = baseParticleColors[i3 + 1] ?? 0;
		const baseB = baseParticleColors[i3 + 2] ?? 0;
		// Clamp G and B channels tightly to preserve red hue under brightness
		particleColors.setXYZ(
			i,
			Math.min(1, baseR * brightness),
			Math.min(0.35, baseG * brightness),
			Math.min(0.35, baseB * brightness)
		);
	}
	particlePositions.needsUpdate = true;
	particleColors.needsUpdate = true;
}
