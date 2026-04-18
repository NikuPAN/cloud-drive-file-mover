import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

const KEY = 'theme';

function mediaDark(): boolean {
	return browser && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(theme: Theme) {
	if (!browser) return;
	const dark = theme === 'dark' || (theme === 'system' && mediaDark());
	document.documentElement.classList.toggle('dark', dark);
}

function initial(): Theme {
	if (!browser) return 'system';
	const v = localStorage.getItem(KEY);
	return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export const theme = $state({ value: initial() });

export function setTheme(next: Theme) {
	theme.value = next;
	if (browser) {
		localStorage.setItem(KEY, next);
		apply(next);
	}
}

if (browser) {
	apply(theme.value);
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
		if (theme.value === 'system') apply('system');
	});
}
