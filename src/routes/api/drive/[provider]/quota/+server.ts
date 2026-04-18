import { error, json } from '@sveltejs/kit';
import { getProvider } from '$lib/server/providers';
import type { Provider } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, cookies }) => {
	const provider = params.provider as Provider;
	if (provider !== 'google' && provider !== 'microsoft') throw error(400, 'Unknown provider');

	const p = await getProvider(provider, cookies);
	if (!p) throw error(401, 'Not connected');

	try {
		return json(await p.quota());
	} catch (e) {
		throw error(500, (e as Error).message);
	}
};
