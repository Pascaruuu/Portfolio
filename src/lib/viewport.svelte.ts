/** Single source of truth for the mobile/desktop breakpoint (px). */
export const BP_DESKTOP = 760;

/**
 * Below this viewport height, the camera zooms out (compact camera profile).
 * CSS layout compaction is a separate, stricter tier at 640px height
 * (see app.css). 641-680px = camera compact only, by design — do not unify.
 */
export const COMPACT_H = 680;

function createViewport() {
	let vw = $state(0);
	let vh = $state(0);

	const isDesktop = $derived(vw >= BP_DESKTOP);
	const isCompact = $derived(vh < COMPACT_H);

	function handleResize(): void {
		vw = window.innerWidth;
		vh = window.innerHeight;
	}

	function init(): void {
		if (typeof window === 'undefined') return;
		vw = window.innerWidth;
		vh = window.innerHeight;
		window.addEventListener('resize', handleResize);
	}

	function teardown(): void {
		if (typeof window === 'undefined') return;
		window.removeEventListener('resize', handleResize);
	}

	return {
		get vw() { return vw; },
		get vh() { return vh; },
		get isDesktop() { return isDesktop; },
		get isCompact() { return isCompact; },
		init,
		teardown,
	};
}

export const viewport = createViewport();
