import type { Cookies } from '@sveltejs/kit';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { serverEnv } from './env';
import type { SessionData } from '$lib/types';

const COOKIE_NAME = 'cdfm_session';
const MAX_AGE_SEC = 60 * 60 * 8; // 8 hours

function key(): Uint8Array {
	const raw = serverEnv.SESSION_SECRET;
	const bytes = Buffer.from(raw, 'base64url');
	if (bytes.length !== 32) {
		throw new Error('SESSION_SECRET must be a 32-byte base64url-encoded value');
	}
	return new Uint8Array(bytes);
}

export async function readSession(cookies: Cookies): Promise<SessionData> {
	const raw = cookies.get(COOKIE_NAME);
	if (!raw) return {};
	try {
		const { payload } = await jwtDecrypt(raw, key());
		return (payload.s as SessionData) ?? {};
	} catch {
		return {};
	}
}

export async function writeSession(cookies: Cookies, data: SessionData): Promise<void> {
	const token = await new EncryptJWT({ s: data })
		.setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
		.setIssuedAt()
		.setExpirationTime(`${MAX_AGE_SEC}s`)
		.encrypt(key());
	cookies.set(COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !serverEnv.PUBLIC_ORIGIN.startsWith('http://localhost'),
		maxAge: MAX_AGE_SEC
	});
}

export function clearSession(cookies: Cookies): void {
	cookies.delete(COOKIE_NAME, { path: '/' });
}

const STATE_COOKIE = 'cdfm_oauth_state';
const VERIFIER_COOKIE = 'cdfm_oauth_verifier';

export function setOAuthFlowCookies(
	cookies: Cookies,
	provider: 'google' | 'microsoft',
	state: string,
	codeVerifier: string
): void {
	const opts = {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: !serverEnv.PUBLIC_ORIGIN.startsWith('http://localhost'),
		maxAge: 60 * 10
	};
	cookies.set(`${STATE_COOKIE}_${provider}`, state, opts);
	cookies.set(`${VERIFIER_COOKIE}_${provider}`, codeVerifier, opts);
}

export function readOAuthFlowCookies(
	cookies: Cookies,
	provider: 'google' | 'microsoft'
): { state: string | undefined; codeVerifier: string | undefined } {
	return {
		state: cookies.get(`${STATE_COOKIE}_${provider}`),
		codeVerifier: cookies.get(`${VERIFIER_COOKIE}_${provider}`)
	};
}

export function clearOAuthFlowCookies(
	cookies: Cookies,
	provider: 'google' | 'microsoft'
): void {
	cookies.delete(`${STATE_COOKIE}_${provider}`, { path: '/' });
	cookies.delete(`${VERIFIER_COOKIE}_${provider}`, { path: '/' });
}
