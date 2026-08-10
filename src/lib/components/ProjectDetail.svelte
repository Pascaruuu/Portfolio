<script lang="ts">
	import type { Component } from 'svelte';
	import type { Picture } from '@sveltejs/enhanced-img';
	import { getProjects } from '$lib/content.js';
	import type { BodyImageLoader, ProjectItem } from '$lib/content/projects/types.js';
	import type { Lang } from '$lib/types.js';

	let { project, lang }: { project: ProjectItem; lang: Lang } = $props();

	const c = $derived(getProjects(lang));

	/**
	 * 'idle' covers both "no detail file for this language" (loader is null,
	 * never attempted) and "not asked for yet" -- both render nothing extra,
	 * so they don't need separate states. 'failed' covers the loader existing
	 * but its dynamic import() rejecting; the panel degrades the same way
	 * either way -- see CONTENT.md's "detail file" section.
	 */
	type DetailState =
		| { status: 'idle' }
		| { status: 'loading' }
		| { status: 'loaded'; Comp: Component<{ images: Record<string, BodyImageLoader> }> }
		| { status: 'failed' };

	let detailState = $state<DetailState>({ status: 'idle' });

	$effect(() => {
		const loader = project.detail[lang];
		if (!loader) {
			detailState = { status: 'idle' };
			return;
		}

		let cancelled = false;
		detailState = { status: 'loading' };

		loader()
			.then((mod) => {
				if (!cancelled) detailState = { status: 'loaded', Comp: mod.default };
			})
			.catch(() => {
				if (!cancelled) detailState = { status: 'failed' };
			});

		return () => {
			cancelled = true;
		};
	});

	/**
	 * PHASE 5G: project.detailImage (loader.ts) is now a lazy loader instead
	 * of the card's already-resolved `image` -- same idle/loading/loaded/
	 * failed shape as detailState above, for the same non-eager reasoning
	 * (loader.ts's bodyImageModules comment).
	 * PHASE 6: unlike detailState, 'idle'/'loading'/'failed' no longer mean
	 * "render nothing" -- the header strip itself (.project-detail-media)
	 * always renders, title included, so the strip's position never jumps
	 * once the image arrives; only the `<enhanced:img>` inside it is
	 * conditional on 'loaded'. Before the image resolves (or if it never
	 * does), the strip falls back to a flat surface tint (app.css) with the
	 * scrim and title still on top -- a plain colored banner rather than an
	 * empty gap.
	 */
	type ImageState =
		| { status: 'idle' }
		| { status: 'loading' }
		| { status: 'loaded'; picture: Picture }
		| { status: 'failed' };

	let imageState = $state<ImageState>({ status: 'idle' });

	$effect(() => {
		const loader = project.detailImage;
		if (!loader) {
			imageState = { status: 'idle' };
			return;
		}

		let cancelled = false;
		imageState = { status: 'loading' };

		loader()
			.then((picture) => {
				if (!cancelled) imageState = { status: 'loaded', picture };
			})
			.catch(() => {
				if (!cancelled) imageState = { status: 'failed' };
			});

		return () => {
			cancelled = true;
		};
	});
</script>

<div
	class="project-detail-media"
	style={project.focalPoint
		? `--focal-x: ${project.focalPoint.x}%; --focal-y: ${project.focalPoint.y}%`
		: undefined}
>
	{#if imageState.status === 'loaded'}
		<enhanced:img src={imageState.picture} alt="" class="project-detail-img" loading="lazy" />
	{/if}
	<h3 class="project-detail-title">{project.title ?? '—'}</h3>
</div>
<p class="project-detail-desc">{project.description[lang] ?? '—'}</p>
<div class="project-tags">
	{#each project.tags[lang] as tag, i (i)}
		<span class="tag">{tag}</span>
	{/each}
</div>
{#if project.url}
	<a
		href={project.url}
		target="_blank"
		rel="external noopener noreferrer"
		class="pill project-detail-link"
	>
		{c.viewRepo}
	</a>
{/if}
{#if detailState.status === 'loading'}
	<p class="project-detail-status">{c.loadingDetail}</p>
{:else if detailState.status === 'loaded'}
	{@const DetailBody = detailState.Comp}
	<div class="project-detail-markdown">
		<DetailBody images={project.bodyImages} />
	</div>
{/if}
