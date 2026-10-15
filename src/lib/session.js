import { ethers } from 'ethers';

/**
 * Signed sign-in session (Sign-In with Ethereum style).
 *
 * The wallet signs a message that names this site, the address, a random nonce and an
 * expiry. The app keeps the message and the signature in sessionStorage and checks the
 * signature again on every protected page.
 *
 * LIMIT: this check runs in the browser. It stops a user from posing as another wallet in
 * the app, but it does not protect the database. The database needs a server-side check
 * (see supabase/schema.sql and docs/regulatory-position.md).
 */

const SESSION_KEY = 'tl_session';
const WALLET_KEY = 'tl_wallet';
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function randomNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildSignInMessage(address) {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + TTL_MS);
  return (
    `${window.location.host} wants you to sign in with your Ethereum account:\n${address}\n\n` +
    `Sign in to TrustLend. This does not cost gas and does not move any funds.\n\n` +
    `URI: ${window.location.origin}\nVersion: 1\nNonce: ${randomNonce()}\n` +
    `Issued At: ${issuedAt.toISOString()}\nExpiration Time: ${expiresAt.toISOString()}`
  );
}

/** Returns the lower-case address when the session is valid, otherwise null. */
export function verifySession(session) {
  try {
    if (!session?.message || !session?.signature || !session?.address) return null;
    const { message, signature, address } = session;

    // Same site, same address, not expired.
    if (!message.startsWith(`${window.location.host} wants you to sign in`)) return null;
    if (!message.includes(`\n${address}\n`) && !message.toLowerCase().includes(`\n${address.toLowerCase()}\n`)) return null;
    const exp = /Expiration Time: (.+)$/m.exec(message)?.[1];
    if (!exp || Number.isNaN(Date.parse(exp)) || Date.now() > Date.parse(exp)) return null;

    const recovered = ethers.verifyMessage(message, signature).toLowerCase();
    return recovered === address.toLowerCase() ? recovered : null;
  } catch {
    return null;
  }
}

export function saveSession({ address, message, signature }) {
  const lower = address.toLowerCase();
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ address: lower, message, signature }));
  sessionStorage.setItem(WALLET_KEY, lower);
}

/** The current valid session address, or null. Clears a bad or expired session. */
export function getValidSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const session = raw ? JSON.parse(raw) : null;
    const address = verifySession(session);
    const wallet = sessionStorage.getItem(WALLET_KEY);
    if (address && wallet === address) return address;
  } catch {
    // fall through
  }
  clearSession();
  return null;
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(WALLET_KEY);
}
