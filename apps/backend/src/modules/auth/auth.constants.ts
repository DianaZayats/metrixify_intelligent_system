export const SESSION_COOKIE_NAME = 'metrixify_session';

/** One-time Telegram login token lifetime (technical task §10.2). */
export const LOGIN_TOKEN_TTL_MS = 10 * 60 * 1000;

/** Browser session lifetime after successful login. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
