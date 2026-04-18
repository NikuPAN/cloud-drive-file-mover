import { redirect } from '@sveltejs/kit';
import { clearSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	clearSession(cookies);
	throw redirect(303, '/');
};

export const GET: RequestHandler = async ({ cookies }) => {
	clearSession(cookies);
	throw redirect(303, '/');
};
