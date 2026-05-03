import type { HotspotDef } from '../types.js';
import { portfolioColors } from '../theme.js';

export const HOTSPOT_DEFS: HotspotDef[] = [
	{ id: 'about',      lat:  22, lon:   0 },
	{ id: 'skills',     lat:  -12, lon:  76 },
	{ id: 'projects',   lat:  10, lon: 124 },
	{ id: 'experience', lat: -22, lon: 216 },
	{ id: 'contact',    lat:  10, lon: 288 },
];

export const SPHERE_R      = 158;
export const AUTO_SPEED    = 0.0004;
export const SENSITIVITY   = 0.0042;
export const INERTIA       = 0.93;
export const X_CLAMP       = Math.PI / 3.2;
export const DRAG_THRESHOLD = 7; // px - below this on pointerup = click
export const ROTATION_LERP = 0.06;
export const HOVER_RADIUS_SQ = 52 * 52; // screen-space px^2

export const ACCENT = portfolioColors.accentNumber;
export const ASCII_COLOR = portfolioColors.ascii;
