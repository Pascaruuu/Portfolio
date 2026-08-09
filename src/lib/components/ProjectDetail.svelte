<script lang="ts">
	import type { Component } from 'svelte';
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
</script>

<div class="project-detail-media">
	<enhanced:img src={project.image} alt={project.title ?? ''} class="project-detail-img" loading="lazy" />
</div>
<h3 class="project-detail-title">{project.title ?? '—'}</h3>
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
