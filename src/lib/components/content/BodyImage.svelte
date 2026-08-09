<script lang="ts">
	import type { Picture } from '@sveltejs/enhanced-img';

	/**
	 * `image` is a lazy loader, not a resolved `Picture` -- matches how the
	 * `images` prop this reads from (see ProjectDetail.svelte / loader.ts's
	 * `bodyImages`) keeps every body image out of the bundle until the
	 * write-up that uses it is actually open. `undefined` covers both "no
	 * entry for this filename" (typo, or the filename is the project's own
	 * card image, see CONTENT.md's "Body images" section) and "prop not
	 * passed" -- both degrade the same way: render nothing, never break the
	 * write-up around it.
	 */
	let {
		image,
		alt = '',
		caption
	}: {
		image: (() => Promise<Picture>) | undefined;
		alt?: string;
		caption?: string;
	} = $props();

	type LoadState =
		| { status: 'idle' }
		| { status: 'loading' }
		| { status: 'loaded'; picture: Picture }
		| { status: 'failed' };

	let state = $state<LoadState>({ status: 'idle' });

	$effect(() => {
		if (!image) {
			state = { status: 'idle' };
			return;
		}

		let cancelled = false;
		state = { status: 'loading' };

		image()
			.then((picture) => {
				if (!cancelled) state = { status: 'loaded', picture };
			})
			.catch(() => {
				if (!cancelled) state = { status: 'failed' };
			});

		return () => {
			cancelled = true;
		};
	});
</script>

{#if state.status === 'loaded'}
	<figure class="body-image">
		<enhanced:img src={state.picture} {alt} class="body-image-img" loading="lazy" />
		{#if caption}
			<figcaption class="body-image-caption">{caption}</figcaption>
		{/if}
	</figure>
{/if}
