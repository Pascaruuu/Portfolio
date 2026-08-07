<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	type Props = {
		items: readonly T[];
		itemKey: (item: T) => string | number;
		itemLabel: (item: T) => string;
		/** Optional per-item icon, shown instead of the label below the icon-mode container threshold. */
		itemIcon?: Snippet<[T]>;
		activeItem: T | null;
		onSelect: (item: T) => void;
		ariaCurrentOnActive?: boolean;
	};

	let {
		items,
		itemKey,
		itemLabel,
		itemIcon,
		activeItem,
		onSelect,
		ariaCurrentOnActive = false,
	}: Props = $props();
</script>

{#each items as item (itemKey(item))}
	<button
		class="segmented-control-btn"
		class:active={item === activeItem}
		aria-current={ariaCurrentOnActive && item === activeItem ? 'page' : undefined}
		aria-label={itemIcon ? itemLabel(item) : undefined}
		onclick={() => onSelect(item)}
	>
		{#if itemIcon}
			<span class="segmented-control-icon" aria-hidden="true">
				{@render itemIcon(item)}
			</span>
		{/if}
		<span class="segmented-control-label">{itemLabel(item)}</span>
	</button>
{/each}
