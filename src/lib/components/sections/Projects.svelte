<script lang="ts">
	import { projectItems } from '$lib/content/projects/loader.js';
	import { projectDetail } from '$lib/projectDetail.svelte.js';
	import ProjectDetail from '$lib/components/ProjectDetail.svelte';
	import type { Lang } from '$lib/types.js';

	let { lang }: { lang: Lang } = $props();

	const selectedProject = $derived(
		projectDetail.selectedSlug !== null
			? (projectItems.find((p) => p.slug === projectDetail.selectedSlug) ?? null)
			: null
	);
</script>

<!-- The grid stays mounted (hidden via CSS, not an {#if}) while the detail
     view shows -- see projectDetail.svelte.ts for why the card element that
     opened a detail must stay a live DOM node for focus/scroll restore. -->
<div class="project-grid" class:project-grid-hidden={selectedProject !== null}>
	{#each projectItems as project (project.slug)}
		<button
			type="button"
			class="project-card"
			onclick={(e) => projectDetail.open(project.slug, e.currentTarget as HTMLElement)}
		>
			<enhanced:img src={project.image} alt={project.title ?? ''} class="project-img" loading="lazy" />
			<div class="project-body">
				<div class="project-title">{project.title ?? '—'}</div>
				<p class="project-desc">{project.description[lang] ?? '—'}</p>
				<div class="project-tags">
					{#each project.tags[lang] as tag, i (i)}
						<span class="tag">{tag}</span>
					{/each}
				</div>
			</div>
		</button>
	{/each}
</div>
{#if selectedProject}
	<ProjectDetail project={selectedProject} lang={lang} />
{/if}
