import { redirect } from '@sveltejs/kit';
import { generateState } from 'arctic';
import { dropboxClient, dropboxScopes } from '$lib/server/oauth';
import { setOAuthState } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const state = generateState();
	const url = dropboxClient().createAuthorizationURL(state, dropboxScopes);
	url.searchParams.set('token_access_type', 'offline');

	setOAuthState(cookies, 'dropbox', state);
	throw redirect(302, url.toString());
};
