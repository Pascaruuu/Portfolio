import * as THREE from 'three';
import type { SectionId } from '../types.js';

export interface HotspotEntry {
	id:        SectionId;
	sprite:    THREE.Sprite;
	core:      THREE.Sprite;
	clickMesh: THREE.Mesh;
	worldPos:  THREE.Vector3;
	screenX:   number;
	screenY:   number;
	hoverMix:  number;
}

export interface WaveState {
	origin: THREE.Vector3;
	startTime: number;
}
