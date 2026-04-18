import { error, redirect } from '@sveltejs/kit';
import { dropboxClient } from '$lib/server/oauth';
import { clearOAuthState, readOAuthState, readSession, writeSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const expectedState = readOAuthState(cookies, 'dropbox');

	if (!code || !state || !expectedState || state !== expectedState) {
		clearOAuthState(cookies, 'dropbox');
		throw error(400, 'Invalid OAuth callback');
	}

	let tokens;
	try {
		tokens = await dropboxClient().validateAuthorizationCode(code);
	} catch {
		clearOAuthState(cookies, 'dropbox');
		throw error(400, 'Failed to exchange authorization code');
	}

	const session = await readSession(cookies);
	session.dropbox = {
		accessToken: tokens.accessToken(),
		refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : undefined,
		expiresAt: tokens.accessTokenExpiresAt().getTime()
	};
	await writeSession(cookies, session);
	clearOAuthState(cookies, 'dropbox');

	throw redirect(302, '/?connected=dropbox');
};
