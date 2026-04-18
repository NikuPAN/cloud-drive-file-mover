<script lang="ts">
	import { X } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		body?: string;
		onClose: () => void;
		actions?: Snippet;
	}

	let { open, title, body, onClose, actions }: Props = $props();

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={open ? onKey : undefined} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) onClose();
		}}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
			class="w-full max-w-md rounded-xl border p-6 shadow-2xl"
			style="background-color: rgb(var(--surface)); border-color: rgb(var(--border));"
		>
			<div class="mb-3 flex items-start justify-between gap-4">
				<h2 id="modal-title" class="text-lg font-semibold">{title}</h2>
				<button
					type="button"
					aria-label="Close"
					class="rounded-md p-1 transition-colors hover:bg-white/10"
					onclick={onClose}
				>
					<X class="size-4" />
				</button>
			</div>
			{#if body}
				<p class="mb-4 text-sm" style="color: rgb(var(--text-muted));">{body}</p>
			{/if}
			{#if actions}
				<div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
					{@render actions()}
				</div>
			{/if}
		</div>
	</div>
{/if}
