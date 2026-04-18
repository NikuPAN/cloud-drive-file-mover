import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { getLocale } from '$lib/paraglide/runtime';

const paraglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%lang%', locale ?? 'en')
		});
	});

export const handle: Handle = async ({ event, resolve }) => {
	return paraglide({ event, resolve });
};

export { getLocale };
