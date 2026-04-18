import { redirect } from '@sveltejs/kit';
import { generateState, generateCodeVerifier } from 'arctic';
import { microsoftClient, microsoftScopes } from '$lib/server/oauth';
import { setOAuthFlowCookies } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const url = microsoftClient().createAuthorizationURL(state, codeVerifier, microsoftScopes);

	setOAuthFlowCookies(cookies, 'microsoft', state, codeVerifier);
	throw redirect(302, url.toString());
};
