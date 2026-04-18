import { redirect } from '@sveltejs/kit';
import { generateState, generateCodeVerifier } from 'arctic';
import { googleClient, googleScopes } from '$lib/server/oauth';
import { setOAuthFlowCookies } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const url = googleClient().createAuthorizationURL(state, codeVerifier, googleScopes);
	// Request refresh token + force consent so we always get one on first login
	url.searchParams.set('access_type', 'offline');
	url.searchParams.set('prompt', 'consent');

	setOAuthFlowCookies(cookies, 'google', state, codeVerifier);
	throw redirect(302, url.toString());
};
