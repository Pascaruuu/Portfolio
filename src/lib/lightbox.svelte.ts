import type { ArtPiece } from './content/art/types.js';

/**
 * Shared open/close state for the art lightbox. It lives here, not as
 * component-local state, because the trigger (a grid cell inside Art.svelte,
 * nested deep in the panel) and the mount point (a sibling of .popup-card in
 * +page.svelte, so it isn't clipped by the panel's scroll container) are in
 * different parts of the tree — see PHASE 8 report for why.
 */
function createLightbox() {
	let piece = $state<ArtPiece | null>(null);
	let index = $state(0);
	let triggerEl: HTMLElement | null = null;

	function open(p: ArtPiece, trigger: HTMLElement): void {
		piece = p;
		index = 0;
		triggerEl = trigger;
	}

	function close(): void {
		piece = null;
		index = 0;
		triggerEl?.focus();
		triggerEl = null;
	}

	function select(i: number): void {
		index = i;
	}

	return {
		get piece() { return piece; },
		get index() { return index; },
		open,
		close,
		select,
	};
}

export const lightbox = createLightbox();
