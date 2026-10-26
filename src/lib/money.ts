/**
 * MHOMHO — client-facing money helpers.
 *
 * The rules themselves live in `shared/money.ts` so that the Cloudflare Worker
 * and the React client cannot drift apart. The client uses these functions for
 * *display only*; the Worker always recomputes authoritative amounts.
 */
export * from '../../shared/money.ts';
