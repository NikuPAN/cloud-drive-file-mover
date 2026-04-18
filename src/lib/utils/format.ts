const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

export function formatBytes(bytes: number | null | undefined, locale = 'en'): string {
	if (bytes == null) return '—';
	if (bytes === 0) return '0 B';
	const i = Math.min(Math.floor(Math.log10(bytes) / 3), UNITS.length - 1);
	const value = bytes / Math.pow(1000, i);
	const formatted = new Intl.NumberFormat(locale, {
		maximumFractionDigits: i === 0 ? 0 : 1
	}).format(value);
	return `${formatted} ${UNITS[i]}`;
}

export function formatDate(iso: string, locale = 'en'): string {
	try {
		return new Intl.DateTimeFormat(locale, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(iso));
	} catch {
		return iso;
	}
}
