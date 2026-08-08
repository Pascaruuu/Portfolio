import type { Action } from 'svelte/action';

/**
 * Small, not zero — sub-pixel scroll offsets (fractional scrollTop from
 * non-integer zoom/DPR) must not leave a permanent sliver of fade visible
 * at rest.
 */
const THRESHOLD = 2;

/**
 * Drives .panel-fade-top / .panel-fade-bottom classes on the scroll
 * container from its scroll position, content height, and own size. All
 * three can change independently (see PHASE 6 investigation: section
 * switch, lang toggle, and art filter change resize the content without
 * scrolling; panel drag-resize resizes the container without scrolling) —
 * a scroll listener alone would leave the fade state stale after any of
 * them, so a ResizeObserver watches both the container and its content.
 *
 * Expects a single `.panel-body-content` child to observe for content-size
 * changes; the container's own overflow box doesn't expose scrollHeight
 * through ResizeObserver, so a stable content wrapper is the only way to
 * observe it without a MutationObserver.
 */
export const panelScrollFade: Action<HTMLElement> = (node) => {
	const content = node.querySelector<HTMLElement>(':scope > .panel-body-content');

	function recompute(): void {
		const { scrollTop, scrollHeight, clientHeight } = node;
		const canScroll = scrollHeight - clientHeight > THRESHOLD;
		const atTop = scrollTop <= THRESHOLD;
		const atBottom = scrollTop + clientHeight >= scrollHeight - THRESHOLD;
		node.classList.toggle('panel-fade-top', canScroll && !atTop);
		node.classList.toggle('panel-fade-bottom', canScroll && !atBottom);
	}

	node.addEventListener('scroll', recompute, { passive: true });

	const resizeObserver = new ResizeObserver(recompute);
	resizeObserver.observe(node);
	if (content) resizeObserver.observe(content);

	return {
		destroy(): void {
			node.removeEventListener('scroll', recompute);
			resizeObserver.disconnect();
		}
	};
};
