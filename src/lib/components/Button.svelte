<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
		size?: 'sm' | 'md';
		children: Snippet;
	}

	let { variant = 'secondary', size = 'md', children, class: klass = '', ...rest }: Props = $props();

	const base =
		'inline-flex items-center justify-center gap-2 font-medium rounded-lg border transition-all duration-150 cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-40';

	const sizes = {
		sm: 'px-3 py-1.5 text-xs',
		md: 'px-4 py-2 text-sm'
	};

	const variants = {
		primary: {
			style: 'background-color: rgb(var(--accent)); color: rgb(var(--accent-contrast)); border-color: transparent;',
			hover: 'hover:brightness-110 active:brightness-95'
		},
		secondary: {
			style: 'background-color: rgb(var(--surface-2)); color: rgb(var(--text)); border-color: rgb(var(--border));',
			hover: 'hover:brightness-95 dark:hover:brightness-125 active:scale-[0.98]'
		},
		danger: {
			style: 'background-color: rgb(var(--danger)); color: white; border-color: transparent;',
			hover: 'hover:brightness-110 active:brightness-95'
		},
		ghost: {
			style: 'background-color: transparent; color: rgb(var(--text-muted)); border-color: transparent;',
			hover: 'hover:bg-black/8 dark:hover:bg-white/10 hover:text-[rgb(var(--text))] active:scale-[0.98]'
		}
	};
</script>

<button
	{...rest}
	class="{base} {sizes[size]} {variants[variant].hover} {klass}"
	style={variants[variant].style}
>
	{@render children()}
</button>
