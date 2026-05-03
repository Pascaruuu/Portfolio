import * as THREE from 'three';

export function makeCircleTex(size: number): THREE.CanvasTexture {
	const c    = document.createElement('canvas');
	c.width    = size;
	c.height   = size;
	const ctx  = c.getContext('2d')!;
	const half = size * 0.5;
	ctx.beginPath();
	ctx.arc(half, half, half * 0.72, 0, Math.PI * 2);
	ctx.fillStyle = 'white';
	ctx.fill();
	return new THREE.CanvasTexture(c);
}
