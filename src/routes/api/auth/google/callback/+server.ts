import { error, redirect } from '@sveltejs/kit';
import { googleClient } from '$lib/server/oauth';
import {
	clearOAuthFlowCookies,
	readOAuthFlowCookies,
	readSession,
	writeSession
} from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const { state: expectedState, codeVerifier } = readOAuthFlowCookies(cookies, 'google');

	if (!code || !state || !expectedState || !codeVerifier || state !== expectedState) {
		clearOAuthFlowCookies(cookies, 'google');
		throw error(400, 'Invalid OAuth callback');
	}

	let tokens;
	try {
		tokens = await googleClient().validateAuthorizationCode(code, codeVerifier);
	} catch {
		clearOAuthFlowCookies(cookies, 'google');
		throw error(400, 'Failed to exchange authorization code');
	}

	const session = await readSession(cookies);
	session.google = {
		accessToken: tokens.accessToken(),
		refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : undefined,
		expiresAt: tokens.accessTokenExpiresAt().getTime()
	};
	await writeSession(cookies, session);
	clearOAuthFlowCookies(cookies, 'google');

	throw redirect(302, '/?connected=google');
};
