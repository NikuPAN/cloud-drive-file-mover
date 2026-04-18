import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { readSession } from '$lib/server/session';

export const load: PageServerLoad = async ({ cookies }) => {
	const session = await readSession(cookies);
	if (!session.google || !session.microsoft) throw redirect(303, '/');
	return {};
};
