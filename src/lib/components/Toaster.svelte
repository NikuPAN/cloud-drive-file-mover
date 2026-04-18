<script lang="ts">
	import { CheckCircle, XCircle, Info, X } from 'lucide-svelte';
	import { toastStore } from '$lib/stores/toast.svelte';

	const icons = {
		success: CheckCircle,
		error: XCircle,
		info: Info
	};

	const styles = {
		success: {
			bar: 'background-color: rgb(var(--success));',
			icon: 'color: rgb(var(--success));',
			border: 'border-color: rgb(var(--success) / 0.3);'
		},
		error: {
			bar: 'background-color: rgb(var(--danger));',
			icon: 'color: rgb(var(--danger));',
			border: 'border-color: rgb(var(--danger) / 0.3);'
		},
		info: {
			bar: 'background-color: rgb(var(--accent));',
			icon: 'color: rgb(var(--accent));',
			border: 'border-color: rgb(var(--border));'
		}
	};
</script>

<div class="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2" aria-live="polite">
	{#each toastStore.items as toast (toast.id)}
		{@const s = styles[toast.variant]}
		{@const Icon = icons[toast.variant]}
		<div
			class="pointer-events-auto flex w-80 items-start gap-3 overflow-hidden rounded-xl border px-4 py-3 shadow-lg"
			style="background-color: rgb(var(--surface-2)); {s.border}"
			role="alert"
		>
			<!-- Colour accent bar -->
			<div class="absolute left-0 top-0 h-full w-1 rounded-l-xl" style={s.bar}></div>

			<Icon class="mt-0.5 size-4 shrink-0" style={s.icon} />

			<p class="flex-1 text-sm leading-snug" style="color: rgb(var(--text));">
				{toast.message}
			</p>

			<button
				type="button"
				class="shrink-0 cursor-pointer rounded p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
				style="color: rgb(var(--text-muted));"
				onclick={() => toastStore.dismiss(toast.id)}
				aria-label="Dismiss"
			>
				<X class="size-3.5" />
			</button>
		</div>
	{/each}
</div>
