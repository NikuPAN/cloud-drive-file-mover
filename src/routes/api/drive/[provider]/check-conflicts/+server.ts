import { error, json } from '@sveltejs/kit';
import { getProvider } from '$lib/server/providers';
import type { Provider } from '$lib/types';
import type { RequestHandler } from './$types';

// Quick top-level conflict check — returns names that already exist at destination root
export const POST: RequestHandler = async ({ params, request, cookies }) => {
	const provider = params.provider as Provider;
	if (!['google', 'microsoft', 'dropbox', 'box'].includes(provider)) throw error(400, 'Unknown provider');

	const p = await getProvider(provider, cookies);
	if (!p) throw error(401, 'Not connected');

	const { names, parentId } = (await request.json()) as {
		names: string[];
		parentId: string;
	};

	if (!Array.isArray(names) || names.length === 0) return json({ conflicts: [] });

	const conflicts: string[] = [];
	await Promise.all(
		names.map(async (name) => {
			const hit = await p.findChildByName(parentId ?? 'root', name);
			if (hit) conflicts.push(name);
		})
	);

	return json({ conflicts });
};
