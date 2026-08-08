<script lang="ts">
	import { lightbox } from '$lib/lightbox.svelte.js';
	import { getArt } from '$lib/content.js';
	import type { Lang } from '$lib/types.js';
	import type { ArtCategory } from '$lib/content/art/types.js';

	let { lang }: { lang: Lang } = $props();

	const c = $derived(getArt(lang));

	let closeBtnEl = $state<HTMLButtonElement | null>(null);
	let imgEl = $state<HTMLImageElement | null>(null);
	let imageLoaded = $state(false);
	let imageError = $state(false);
	let thumbEl = $state<HTMLImageElement | null>(null);
	let thumbLoaded = $state(false);

	const activeImage = $derived(
		lightbox.piece
			? (lightbox.piece.images[lightbox.index] ?? lightbox.piece.images[0] ?? null)
			: null
	);

	// No [0] fallback here, unlike activeImage: thumbnails is built by an
	// independent .filter() over a separate glob (see loader.ts), so it can
	// in principle be shorter than images and this index lookup can miss —
	// falling back to thumbnails[0] would blur a *different* piece's
	// thumbnail behind this one's full-size image. null is handled below by
	// simply not rendering the blur layer, falling back to the plain
	// outline placeholder.
	const activeThumbnail = $derived(
		lightbox.piece
			? (lightbox.piece.thumbnails[lightbox.index] ?? null)
			: null
	);

	// Orientation for the loading box's aspect ratio — known synchronously, no load event needed.
	const isPortrait = $derived(activeImage ? activeImage.img.h > activeImage.img.w : false);

	// A fresh instance mounts each time lightbox.piece flips from null (the
	// {#if} in +page.svelte creates/destroys it), so this runs once per open.
	$effect(() => {
		closeBtnEl?.focus();
	});

	// The <enhanced:img> below has no {#key}, so an index change swaps its
	// src on the same DOM node rather than remounting it — reset load state
	// per activeImage. Also covers the cached-image case: if the browser
	// already has this image, it may resolve before onload/onerror can catch
	// it, so check the element's own `complete` (and `naturalWidth`, since a
	// failed load also leaves `complete` true) once this effect reruns after
	// the DOM reflects the new src.
	$effect(() => {
		if (!activeImage) return;
		imageLoaded = false;
		imageError = false;
		if (imgEl?.complete) {
			if (imgEl.naturalWidth > 0) imageLoaded = true;
			else imageError = true;
		}
	});

	function handleImageLoad(): void {
		imageLoaded = true;
		imageError = false;
	}

	function handleImageError(): void {
		imageError = true;
		imageLoaded = false;
	}

	// Mirrors the effect above: the thumbnail <enhanced:img> is also a
	// single un-keyed element reused across indices, and may itself already
	// be cached (only thumbnails[0] is preloaded per piece — other indices
	// are cached only if the grid rendered them) or not cached at all. No
	// separate error state: a failed/uncached thumbnail simply never sets
	// thumbLoaded, which already degrades correctly to the outline-only
	// placeholder underneath it.
	$effect(() => {
		if (!activeThumbnail) return;
		thumbLoaded = false;
		if (thumbEl?.complete && thumbEl.naturalWidth > 0) {
			thumbLoaded = true;
		}
	});

	function handleThumbLoad(): void {
		thumbLoaded = true;
	}

	function categoryLabel(category: ArtCategory | null): string {
		if (category === 'hand-drawn') return c.filters.handDrawn;
		if (category === 'digital') return c.filters.digital;
		return '—';
	}

	function imageLabel(index: number): string {
		return c.imageLabelTemplate.replace('{n}', String(index + 1));
	}
</script>

{#if lightbox.piece}
	{@const piece = lightbox.piece}
	<div
		class="lightbox-backdrop"
		onclick={() => lightbox.close()}
		role="presentation"
	>
		<button
			class="lightbox-close"
			onclick={() => lightbox.close()}
			aria-label={c.lightboxCloseLabel}
			bind:this={closeBtnEl}
		>
			<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor"
				fill="none" stroke-width="2" stroke-linecap="round">
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>

		<div class="lightbox-content" onclick={(e) => e.stopPropagation()} role="presentation">
			{#if activeImage}
				<div
					class="lightbox-image-wrap"
					class:is-portrait={isPortrait}
					class:is-loaded={imageLoaded}
				>
					{#if activeThumbnail}
						<enhanced:img
							class="lightbox-image-thumb"
							class:is-loaded={thumbLoaded && !imageLoaded}
							src={activeThumbnail}
							alt=""
							aria-hidden="true"
							bind:this={thumbEl}
							onload={handleThumbLoad}
						/>
					{/if}
					{#if !imageLoaded}
						<div
							class="lightbox-image-placeholder"
							class:is-error={imageError}
							class:has-thumb={!!activeThumbnail}
							class:thumb-loaded={thumbLoaded}
							aria-hidden="true"
						></div>
					{/if}
					<enhanced:img
						class="lightbox-image"
						class:is-loaded={imageLoaded}
						src={activeImage}
						alt=""
						bind:this={imgEl}
						onload={handleImageLoad}
						onerror={handleImageError}
					/>
				</div>
			{/if}

			<div class="lightbox-meta">
				<h3 class="lightbox-title">{piece.title[lang] ?? '—'}</h3>
				<p class="lightbox-desc">{piece.description[lang] ?? '—'}</p>
				<div class="lightbox-fields">
					<span>{piece.date ?? '—'}</span>
					<span>{categoryLabel(piece.category)}</span>
				</div>
			</div>

			{#if piece.images.length > 1}
				<div class="lightbox-strip" role="group" aria-label={c.imageStripLabel}>
					{#each piece.images as img, i (i)}
						<button
							class="lightbox-strip-thumb"
							class:active={i === lightbox.index}
							onclick={() => lightbox.select(i)}
							aria-label={imageLabel(i)}
							aria-current={i === lightbox.index}
						>
							<enhanced:img src={img} alt="" />
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
