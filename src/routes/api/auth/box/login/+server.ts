import { redirect } from '@sveltejs/kit';
import { generateState } from 'arctic';
import { boxClient, boxScopes } from '$lib/server/oauth';
import { setOAuthState } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const state = generateState();
	const url = boxClient().createAuthorizationURL(state, boxScopes);

	setOAuthState(cookies, 'box', state);
	throw redirect(302, url.toString());
};
