<script lang="ts">
	import { getProjects } from '$lib/content.js';
	import type { Lang } from '$lib/types.js';

	let { lang }: { lang: Lang } = $props();

	const c = $derived(getProjects(lang));
</script>

{#each c.items as project (project.url)}
	<a
		href={project.url}
		target="_blank"
		rel="external noopener noreferrer"
		class="project-card"
	>
		<img src={project.img} alt={project.title} class="project-img" loading="lazy" />
		<div class="project-body">
			<div class="project-title">{project.title}</div>
			<p class="project-desc">{project.desc}</p>
			<div class="project-tags">
				{#each project.tags as tag, i (i)}
					<span class="tag">{tag}</span>
				{/each}
			</div>
		</div>
	</a>
{/each}
<a
	href="https://github.com/Pascaruuu?tab=repositories"
	target="_blank"
	rel="noopener noreferrer"
	class="view-all"
>
	{c.viewAll}
</a>
