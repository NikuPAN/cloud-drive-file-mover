<script lang="ts">
	import { Sun, Moon, Monitor } from 'lucide-svelte';
	import { theme, setTheme, type Theme } from '$lib/stores/theme.svelte';
	import { m } from '$lib/paraglide/messages.js';

	const options: { value: Theme; Icon: typeof Sun; label: () => string }[] = [
		{ value: 'light', Icon: Sun, label: () => m.theme_light() },
		{ value: 'dark', Icon: Moon, label: () => m.theme_dark() },
		{ value: 'system', Icon: Monitor, label: () => m.theme_system() }
	];
</script>

<div
	role="radiogroup"
	aria-label={m.theme_toggle_label()}
	class="inline-flex rounded-full border p-0.5"
	style="border-color: rgb(var(--border));"
>
	{#each options as opt (opt.value)}
		{@const active = theme.value === opt.value}
		<button
			type="button"
			role="radio"
			aria-checked={active}
			aria-label={opt.label()}
			title={opt.label()}
			class="flex size-8 items-center justify-center rounded-full transition-colors"
			style={active
				? 'background-color: rgb(var(--accent)); color: rgb(var(--accent-contrast));'
				: 'color: rgb(var(--text-muted));'}
			onclick={() => setTheme(opt.value)}
		>
			<opt.Icon class="size-4" />
		</button>
	{/each}
</div>
