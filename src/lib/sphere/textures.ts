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

export function makeGlowTex(): THREE.CanvasTexture {
	const c    = document.createElement('canvas');
	c.width    = 128;
	c.height   = 128;
	const ctx  = c.getContext('2d')!;
	ctx.clearRect(0, 0, 128, 128);

	const horizontal = ctx.createLinearGradient(8, 64, 120, 64);
	horizontal.addColorStop(0, 'rgba(255, 123, 53, 0)');
	horizontal.addColorStop(0.18, 'rgba(255, 153, 91, 0.12)');
	horizontal.addColorStop(0.5, 'rgba(255, 208, 166, 0.42)');
	horizontal.addColorStop(0.82, 'rgba(255, 153, 91, 0.12)');
	horizontal.addColorStop(1, 'rgba(255, 123, 53, 0)');
	ctx.fillStyle = horizontal;
	ctx.fillRect(8, 58, 112, 12);

	const vertical = ctx.createLinearGradient(64, 18, 64, 110);
	vertical.addColorStop(0, 'rgba(255, 123, 53, 0)');
	vertical.addColorStop(0.3, 'rgba(255, 185, 130, 0.08)');
	vertical.addColorStop(0.5, 'rgba(255, 232, 205, 0.2)');
	vertical.addColorStop(0.7, 'rgba(255, 185, 130, 0.08)');
	vertical.addColorStop(1, 'rgba(255, 123, 53, 0)');
	ctx.fillStyle = vertical;
	ctx.fillRect(58, 18, 12, 92);

	const ember = ctx.createRadialGradient(64, 64, 0, 64, 64, 24);
	ember.addColorStop(0, 'rgba(255, 245, 232, 0.24)');
	ember.addColorStop(0.45, 'rgba(255, 180, 118, 0.12)');
	ember.addColorStop(1, 'rgba(255, 123, 53, 0)');
	ctx.fillStyle = ember;
	ctx.beginPath();
	ctx.arc(64, 64, 24, 0, Math.PI * 2);
	ctx.fill();

	return new THREE.CanvasTexture(c);
}

export function makeStreakTex(): THREE.CanvasTexture {
	const c = document.createElement('canvas');
	c.width = 128;
	c.height = 128;
	const ctx = c.getContext('2d')!;
	const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
	grad.addColorStop(0, 'rgba(255, 245, 232, 1)');
	grad.addColorStop(0.24, 'rgba(255, 182, 112, 0.9)');
	grad.addColorStop(0.5, 'rgba(255, 123, 53, 0.26)');
	grad.addColorStop(1, 'rgba(255, 123, 53, 0)');
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, 128, 128);
	return new THREE.CanvasTexture(c);
}
