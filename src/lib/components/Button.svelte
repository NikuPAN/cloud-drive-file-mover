<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
		children: Snippet;
	}

	let { variant = 'secondary', children, class: klass = '', ...rest }: Props = $props();

	const styles = {
		primary: 'background-color: rgb(var(--accent)); color: rgb(var(--accent-contrast));',
		secondary: 'background-color: rgb(var(--surface-2)); color: rgb(var(--text));',
		danger: 'background-color: rgb(var(--danger)); color: white;',
		ghost: 'color: rgb(var(--text-muted));'
	};
</script>

<button
	{...rest}
	class="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90 {klass}"
	style={styles[variant]}
>
	{@render children()}
</button>
