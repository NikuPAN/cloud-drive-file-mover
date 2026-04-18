import { redirect } from '@sveltejs/kit';
import { readSession, writeSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const session = await readSession(cookies);
	delete session.box;
	await writeSession(cookies, session);
	throw redirect(303, '/');
};
