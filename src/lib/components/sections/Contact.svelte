<script lang="ts">
	import { getContact } from '$lib/content.js';
	import type { Lang } from '$lib/types.js';

	let { lang }: { lang: Lang } = $props();

	const c = $derived(getContact(lang));

	let emailCopied = $state(false);
	function copyEmail(email: string): void {
		navigator.clipboard.writeText(email).then(() => {
			emailCopied = true;
			setTimeout(() => { emailCopied = false; }, 2000);
		});
	}
</script>

<p class="panel-eyebrow">{c.label}</p>
<h2 class="panel-heading">{c.heading}</h2>
<button
	class="email-copy"
	onclick={() => copyEmail(c.email)}
	aria-label={c.copyLabel}
>
	<span class="email-address">{c.email}</span>
	<span class="email-copy-label">{emailCopied ? c.copiedLabel : c.copyLabel}</span>
</button>
<div class="contact-links">
	{#each c.links as link (link.url)}
		<a href={link.url} target="_blank" rel="external noopener noreferrer" class="pill">
			{link.label}
		</a>
	{/each}
</div>
