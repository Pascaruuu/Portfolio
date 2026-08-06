import * as THREE from 'three';
import type { SectionId } from '../types.js';

export interface HotspotEntry {
	id:        SectionId;
	core:      THREE.Sprite;
	clickMesh: THREE.Mesh;
	worldPos:  THREE.Vector3;
	/**
	 * Divisor for worldPos.z when computing camera-facing "dot" (see
	 * sphere/index.ts animate() and sphere/interaction.ts onPointerMove).
	 * Deliberately the nominal placement radius, not |worldPos| -- clickMesh
	 * is placed at 1.08x that radius (see buildHotspots), so this constant
	 * preserves the existing facing-value math rather than the true distance.
	 */
	radius:    number;
	screenX:   number;
	screenY:   number;
	hoverMix:  number;
}
