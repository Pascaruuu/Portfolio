<script lang="ts" generics="T">
	type Props = {
		items: readonly T[];
		itemKey: (item: T) => string | number;
		itemLabel: (item: T) => string;
		activeItem: T | null;
		onSelect: (item: T) => void;
		ariaCurrentOnActive?: boolean;
	};

	let {
		items,
		itemKey,
		itemLabel,
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
		onclick={() => onSelect(item)}
	>
		{itemLabel(item)}
	</button>
{/each}
