/**
 * Client for the TrustLend ML API (ml-api/). The scores it returns are advisory.
 * They are never written to the contract, the database or the store.
 *
 * There is NO fake fallback. When the service is off, the caller shows "offline".
 */

const BASE = (import.meta.env.VITE_ML_API_URL || '').replace(/\/$/, '');
const TIMEOUT_MS = 12000;

export const isMlConfigured = () => Boolean(BASE);

/**
 * @returns {Promise<{state: 'not_configured'|'offline'|'error'|'ok', data?: object, message?: string}>}
 */
export async function fetchAssessment(address) {
  if (!BASE) return { state: 'not_configured' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/api/v1/wallet/${address}/assessment`, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { state: 'error', message: typeof body.detail === 'string' ? body.detail : `HTTP ${res.status}` };
    }
    return { state: 'ok', data: await res.json() };
  } catch {
    return { state: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
