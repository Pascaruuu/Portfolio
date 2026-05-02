import * as THREE from 'three';
import { ACCENT, HOTSPOT_DEFS, SPHERE_R } from './constants.js';
import type { HotspotEntry } from './types.js';
import { makeCircleTex } from './textures.js';
import { latLonToVec3 } from './helpers.js';
import type { SectionId } from '../types.js';

export function buildHotspots(sphereGroup: THREE.Group): {
	hotspotEntries: HotspotEntry[];
	clickMeshes: THREE.Mesh[];
} {
	const dotTex = makeCircleTex(128);

	const hotspotEntries: HotspotEntry[] = HOTSPOT_DEFS.map(def => {
		const pos = latLonToVec3(def.lat, def.lon, SPHERE_R);

		const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
			transparent: true,
			opacity:     0,
			depthWrite:  false,
		}));

		const core = new THREE.Sprite(new THREE.SpriteMaterial({
			map:         dotTex,
			color:       ACCENT,
			transparent: true,
			opacity:     0.9,
			blending:    THREE.NormalBlending,
			depthTest:   false,
			depthWrite:  false,
		}));
		core.scale.set(12, 12, 1);
		core.position.copy(pos);
		sphereGroup.add(core);

		// Invisible sphere mesh used only for raycasting
		const clickMesh = new THREE.Mesh(
			new THREE.SphereGeometry(22, 10, 10),
			new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
		);
		clickMesh.position.copy(pos);
		clickMesh.position.multiplyScalar(1.08);
		(clickMesh.userData as { hotspotId: SectionId }).hotspotId = def.id;
		sphereGroup.add(clickMesh);

		return {
			id: def.id,
			sprite,
			core,
			clickMesh,
			worldPos: new THREE.Vector3(),
			screenX: 0,
			screenY: 0,
			hoverMix: 0,
		};
	});

	const clickMeshes = hotspotEntries.map(h => h.clickMesh);

	return { hotspotEntries, clickMeshes };
}
