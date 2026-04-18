<script lang="ts">
	import { Languages } from 'lucide-svelte';
	import { getLocale, setLocale, locales, type Locale } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';

	const labels: Record<Locale, string> = {
		en: 'English',
		'zh-Hant': '繁體中文',
		'zh-Hans': '简体中文',
		ja: '日本語'
	};

	let current = $state<Locale>(getLocale());

	function onChange(e: Event) {
		const value = (e.currentTarget as HTMLSelectElement).value as Locale;
		current = value;
		setLocale(value);
	}
</script>

<label class="inline-flex items-center gap-2 text-sm">
	<Languages class="size-4" aria-hidden="true" />
	<span class="sr-only">{m.language_label()}</span>
	<select
		value={current}
		onchange={onChange}
		class="cursor-pointer rounded-md border px-2 py-1 text-sm"
		style="background-color: rgb(var(--surface-2)); color: rgb(var(--text)); border-color: rgb(var(--border));"
	>
		{#each locales as loc (loc)}
			<option value={loc}>{labels[loc]}</option>
		{/each}
	</select>
</label>
