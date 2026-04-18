import { error, redirect } from '@sveltejs/kit';
import { microsoftClient } from '$lib/server/oauth';
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
	const { state: expectedState, codeVerifier } = readOAuthFlowCookies(cookies, 'microsoft');

	if (!code || !state || !expectedState || !codeVerifier || state !== expectedState) {
		clearOAuthFlowCookies(cookies, 'microsoft');
		throw error(400, 'Invalid OAuth callback');
	}

	let tokens;
	try {
		tokens = await microsoftClient().validateAuthorizationCode(code, codeVerifier);
	} catch {
		clearOAuthFlowCookies(cookies, 'microsoft');
		throw error(400, 'Failed to exchange authorization code');
	}

	const session = await readSession(cookies);
	session.microsoft = {
		accessToken: tokens.accessToken(),
		refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : undefined,
		expiresAt: tokens.accessTokenExpiresAt().getTime()
	};
	await writeSession(cookies, session);
	clearOAuthFlowCookies(cookies, 'microsoft');

	throw redirect(302, '/?connected=microsoft');
};
