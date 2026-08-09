import { tick } from 'svelte';

/**
 * Sub-view state for the Projects section: which project's detail is open
 * (by slug), or null for the list. Lives here, not as component-local state
 * in Projects.svelte, for the same reason as artFilter and lightbox: the
 * controls that drive it (the back arrow and the "view all" button, both
 * rendered in +page.svelte's pinned header) and the consumers (Projects.svelte,
 * swapping list/detail visibility; ProjectDetail.svelte, rendering the
 * selected project) are different components with no other shared parent to
 * hold this as local state.
 *
 * Unlike artFilter, this does NOT persist across close/section-change —
 * see the doc comment on artFilter for why *it* persists (a low-stakes
 * arrangement preference). Which project's detail is open is a navigational
 * position, not a preference: a user who closes the panel, or switches to a
 * different section and comes back, expects Projects to show its list again,
 * not resume mid-detail. +page.svelte enforces this with a single effect —
 * `if (currentSection !== 'projects') projectDetail.reset()` — which covers
 * both panel close (closePanel sets currentSection to null) and switching to
 * a different section, since both are just "currentSection is no longer
 * 'projects'" from this module's point of view.
 */
function createProjectDetail() {
	let selectedSlug = $state<string | null>(null);
	let savedScrollTop = 0;
	let triggerEl: HTMLElement | null = null;

	/**
	 * The project grid stays mounted the whole time (hidden via CSS, not
	 * destroyed by an {#if}) specifically so `trigger` stays a live, attached
	 * DOM node across the round trip — the same guarantee the art lightbox's
	 * trigger element relies on (see lightbox.svelte.ts), which is what makes
	 * `trigger.focus()` in back() below actually work instead of focusing a
	 * detached node.
	 */
	function open(slug: string, trigger: HTMLElement): void {
		const panelBody = trigger.closest<HTMLElement>('.panel-body');
		savedScrollTop = panelBody?.scrollTop ?? 0;
		triggerEl = trigger;
		selectedSlug = slug;

		// Detail view should start scrolled to its own top, not wherever the
		// list happened to be scrolled — scrollTop is a raw pixel offset that
		// doesn't reset itself just because the content underneath changed.
		// Wait for Svelte to actually swap in the detail markup first.
		tick().then(() => {
			if (panelBody) panelBody.scrollTop = 0;
		});
	}

	function back(): void {
		selectedSlug = null;
		const trigger = triggerEl;
		triggerEl = null;

		// Wait for the list to be visible again before restoring scroll and
		// focus — .panel-body's scrollHeight reflects the detail view's
		// (likely shorter) content until Svelte re-shows the list.
		tick().then(() => {
			const panelBody = trigger?.closest<HTMLElement>('.panel-body');
			if (panelBody) panelBody.scrollTop = savedScrollTop;
			trigger?.focus();
		});
	}

	function reset(): void {
		selectedSlug = null;
		triggerEl = null;
	}

	return {
		get selectedSlug() { return selectedSlug; },
		open,
		back,
		reset,
	};
}

export const projectDetail = createProjectDetail();
