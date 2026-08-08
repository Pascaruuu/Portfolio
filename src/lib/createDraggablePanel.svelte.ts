import { viewport } from './viewport.svelte.js';
import { PANEL_GUTTER, PANEL_MAX_W, PANEL_H_GUTTER, PANEL_DEFAULT_H_VH, MIN_W, MIN_H } from './panelGeometry.js';

export const RESIZE_DIRS = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'] as const;
export type ResizeDir = typeof RESIZE_DIRS[number];

export function createDraggablePanel() {
	let x = $state(0);
	let y = $state(0);
	let w = $state(0);
	let h = $state(0);
	let initialized = $state(false);
	let el = $state<HTMLElement | null>(null);

	// ── Drag ───────────────────────────────────────────────
	let isPanelDragging = false;
	let dragStartX = 0, dragStartY = 0;
	let dragOriginX = 0, dragOriginY = 0;

	// ── Resize ─────────────────────────────────────────────
	let isResizing = false;
	let resizeDir: ResizeDir | null = null;
	let resizeStartX = 0, resizeStartY = 0;
	let resizeOrigin = { x: 0, y: 0, w: 0, h: 0 };

	function init(): void {
		const popupW = Math.min(PANEL_MAX_W, viewport.vw - PANEL_H_GUTTER);
		w = popupW;
		x = viewport.vw - PANEL_GUTTER - popupW;
		y = 0;
		h = 0;
		initialized = true;
		requestAnimationFrame(() => {
			if (!el) return;
			const measuredH = el.getBoundingClientRect().height;
			// Cap tall content at the default target (panel-body scrolls the
			// rest); shorter content keeps its own natural height rather than
			// being stretched up to fill the target.
			const targetH = Math.min(viewport.vh * PANEL_DEFAULT_H_VH, viewport.vh - PANEL_GUTTER * 2);
			h = Math.min(measuredH, targetH);
			y = Math.max(0, (viewport.vh - h) / 2);
		});
	}

	function onViewportResize(): void {
		if (initialized) {
			x = Math.min(x, viewport.vw - w);
			y = Math.min(y, viewport.vh - h);
			x = Math.max(0, x);
			y = Math.max(0, y);
		}
	}

	function onDragMove(e: PointerEvent): void {
		if (!isPanelDragging) return;
		const dx = e.clientX - dragStartX;
		const dy = e.clientY - dragStartY;
		const liveH = el?.getBoundingClientRect().height ?? h;
		x = Math.max(0, Math.min(viewport.vw - w, dragOriginX + dx));
		y = Math.max(0, Math.min(viewport.vh - liveH, dragOriginY + dy));
	}

	function onDragEnd(): void {
		isPanelDragging = false;
		window.removeEventListener('pointermove', onDragMove);
		window.removeEventListener('pointerup', onDragEnd);
	}

	function onDragStart(e: PointerEvent): void {
		if (!viewport.isDesktop) return;
		isPanelDragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		dragOriginX = x;
		dragOriginY = y;
		window.addEventListener('pointermove', onDragMove);
		window.addEventListener('pointerup', onDragEnd);
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onResizeMove(e: PointerEvent): void {
		if (!isResizing || !resizeDir) return;
		const dx = e.clientX - resizeStartX;
		const dy = e.clientY - resizeStartY;
		let { x: rx, y: ry, w: rw, h: rh } = resizeOrigin;

		if (resizeDir.includes('e')) rw = Math.max(MIN_W, rw + dx);
		if (resizeDir.includes('s')) rh = Math.max(MIN_H, rh + dy);
		if (resizeDir.includes('w')) {
			const newW = Math.max(MIN_W, rw - dx);
			rx = rx + rw - newW;
			rw = newW;
		}
		if (resizeDir.includes('n')) {
			const newH = Math.max(MIN_H, rh - dy);
			ry = ry + rh - newH;
			rh = newH;
		}

		rx = Math.max(0, rx);
		ry = Math.max(0, ry);
		if (rx + rw > viewport.vw) rw = viewport.vw - rx;
		if (ry + rh > viewport.vh) rh = viewport.vh - ry;

		x = rx; y = ry; w = rw; h = rh;
	}

	function onResizeEnd(): void {
		isResizing = false;
		resizeDir = null;
		window.removeEventListener('pointermove', onResizeMove);
		window.removeEventListener('pointerup', onResizeEnd);
	}

	function onResizeStart(e: PointerEvent, dir: ResizeDir): void {
		if (!viewport.isDesktop) return;
		e.stopPropagation();
		isResizing = true;
		resizeDir = dir;
		resizeStartX = e.clientX;
		resizeStartY = e.clientY;
		resizeOrigin = { x, y, w, h };
		window.addEventListener('pointermove', onResizeMove);
		window.addEventListener('pointerup', onResizeEnd);
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	return {
		get x() { return x; },
		get y() { return y; },
		get w() { return w; },
		get h() { return h; },
		get initialized() { return initialized; },
		get el() { return el; },
		set el(node: HTMLElement | null) { el = node; },
		init,
		onViewportResize,
		onDragStart,
		onResizeStart,
	};
}
