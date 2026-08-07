<script lang="ts">
	import { getSkills } from '$lib/content.js';
	import type { Lang } from '$lib/types.js';

	let { lang }: { lang: Lang } = $props();

	const c = $derived(getSkills(lang));

	// Runs once on mount: this component only exists while
	// currentSection === 'skills' && panelOpen (the {:else if} branch that
	// renders it), so a fresh false→true flip on creation reproduces the
	// original effect's timing without re-reading that external state.
	let skillsAnimated = $state(false);
	$effect(() => {
		skillsAnimated = false;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				skillsAnimated = true;
			});
		});
	});
</script>

<p class="panel-eyebrow">{c.label}</p>
<h2 class="panel-heading">{c.heading}</h2>
{#each c.items as skill (skill.name)}
	<div class="skill-row">
		<div class="skill-row-header">
			<span class="skill-name">{skill.name}</span>
			<span class="skill-pct">{skill.pct}%</span>
		</div>
		<div class="skill-track">
			<div
				class="skill-fill"
				style:width={skillsAnimated ? `${skill.pct}%` : '0%'}
			></div>
		</div>
	</div>
{/each}
