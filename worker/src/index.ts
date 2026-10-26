import type { Env } from './env.ts';
import type { Ctx } from './context.ts';
import { readSession } from './auth.ts';
import { errorResponse, json, requestId as newRequestId } from './http.ts';
import { CONSOLE_PREFIX, isConfiguredConsolePath } from './console.ts';
import { Router } from './router.ts';
import {
  handleAdminLogin,
  handleBootstrap,
  handleChangePassword,
  handleCreatorLogin,
  handleLogout,
  handleRegister,
} from './routes/auth.ts';
import {
  handleDeleteAccount,
  handleJoinCampaign,
  handleRequestPayout,
  handleSaveCampaignZero,
  handleSubmitCampaignZero,
  handleSubmitClip,
  handleUpdateProfile,
} from './routes/creator.ts';
import { handleProofUpload, handleAssetRead } from './routes/assets.ts';
import {
  handleApproveCreator,
  handleCampaignMembers,
  handleCampaignPoster,
  handleCampaignStatus,
  handleCreateCampaign,
  handleEnquiryStatus,
  handleRecordPayout,
  handleRejectSubmission,
  handleSettlePayout,
  handleTopUpCampaign,
  handleVerifySubmission,
} from './routes/admin.ts';
import { handleActivity } from './routes/activity.ts';
import {
  handleCreateTicket,
  handleGetTicket,
  handleListTickets,
  handleReplyTicket,
  handleUpdateTicket,
} from './routes/support.ts';
import {
  handleCreateNotification,
  handleListNotifications,
  handleMarkAllNotificationsRead,
  handleMarkNotificationRead,
} from './routes/notifications.ts';
import {
  handleAdminCommunity,
  handleCommunityOverview,
  handleCreateCommunityThread,
  handleGetCommunityThread,
  handleListCommunityThreads,
  handleModerateCommunityReply,
  handleModerateCommunityThread,
  handleReplyToCommunityThread,
} from './routes/community.ts';
import {
  handleAdminSetup,
  handleBrandReport,
  handleCreateBrandToken,
  handleCreateEnquiry,
} from './routes/public.ts';
import { runScheduled } from './cron.ts';

const router = new Router();

router
  .get('/api/health', () => json({ ok: true }))
  .get('/api/bootstrap', handleBootstrap)
  .get('/api/activity', handleActivity)
  .get('/api/community', handleCommunityOverview)
  .get('/api/community/threads', handleListCommunityThreads)
  .post('/api/community/threads', handleCreateCommunityThread)
  .get('/api/community/threads/:id', handleGetCommunityThread)
  .post('/api/community/threads/:id/replies', handleReplyToCommunityThread)
  .get('/api/admin/community', handleAdminCommunity)
  .patch('/api/admin/community/threads/:id', handleModerateCommunityThread)
  .patch('/api/admin/community/replies/:id', handleModerateCommunityReply)
  .get('/api/notifications', handleListNotifications)
  .post('/api/notifications/read-all', handleMarkAllNotificationsRead)
  .post('/api/notifications/:id/read', handleMarkNotificationRead)
  .post('/api/admin/notifications', handleCreateNotification)
  .get('/api/support/tickets', handleListTickets)
  .post('/api/support/tickets', handleCreateTicket)
  .get('/api/support/tickets/:id', handleGetTicket)
  .post('/api/support/tickets/:id/messages', handleReplyTicket)
  .patch('/api/admin/support/tickets/:id', handleUpdateTicket)
  .post('/api/auth/register', handleRegister)
  .post('/api/auth/login', handleCreatorLogin)
  .post('/api/auth/admin/login', handleAdminLogin)
  .post('/api/auth/logout', handleLogout)
  .post('/api/auth/password', handleChangePassword)
  .post('/api/setup/admin', handleAdminSetup)
  .post('/api/payouts', handleRequestPayout)
  .post('/api/account/delete', handleDeleteAccount)
  .post('/api/campaigns/:id/join', handleJoinCampaign)
  .post('/api/submissions', handleSubmitClip)
  .post('/api/campaign-zero', handleSaveCampaignZero)
  .post('/api/campaign-zero/submit', handleSubmitCampaignZero)
  .patch('/api/profile', handleUpdateProfile)
  .post('/api/uploads/proof', handleProofUpload)
  .get('/api/assets/:id', handleAssetRead)
  .post('/api/enquiries', handleCreateEnquiry)
  .get('/api/brand/:token', handleBrandReport)
  .post('/api/admin/creators/:id/approve', handleApproveCreator)
  .post('/api/admin/submissions/:id/verify', handleVerifySubmission)
  .post('/api/admin/submissions/:id/reject', handleRejectSubmission)
  .post('/api/admin/payouts', handleRecordPayout)
  .patch('/api/admin/payouts/:id', handleSettlePayout)
  .post('/api/admin/campaigns', handleCreateCampaign)
  .post('/api/admin/campaigns/:id/top-up', handleTopUpCampaign)
  .get('/api/admin/campaigns/:id/members', handleCampaignMembers)
  .post('/api/admin/campaigns/:id/poster', handleCampaignPoster)
  .patch('/api/admin/campaigns/:id/status', handleCampaignStatus)
  .post('/api/admin/campaigns/:id/brand-token', handleCreateBrandToken)
  .patch('/api/admin/enquiries/:id', handleEnquiryStatus);

const CONSOLE_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'";

function withSecurityHeaders(response: Response, env: Env): Response {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (env.ENVIRONMENT === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000');
  }
  return response;
}

function consoleNotFound(env: Env): Response {
  return withSecurityHeaders(
    new Response('Not found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    }),
    env
  );
}

async function serveConsoleShell(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return withSecurityHeaders(
      new Response('Method not allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' },
      }),
      env
    );
  }

  if (!(await isConfiguredConsolePath(url.pathname, env.ADMIN_PATH))) {
    return consoleNotFound(env);
  }

  let asset: Response;
  try {
    asset = await env.ASSETS.fetch(new Request(new URL('/', url), request));
  } catch {
    return consoleNotFound(env);
  }
  if (!asset.ok) return consoleNotFound(env);

  const headers = new Headers(asset.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('Content-Security-Policy', CONSOLE_CSP);
  return withSecurityHeaders(
    new Response(request.method === 'HEAD' ? null : asset.body, {
      status: 200,
      headers,
    }),
    env
  );
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const matched = router.match(request.method, url.pathname);
  if (!matched) {
    if (router.hasPath(url.pathname)) {
      const allowed = router.allowedMethods(url.pathname);
      return json(
        { error: { code: 'method_not_allowed', message: 'Method not allowed.' } },
        405,
        { Allow: allowed.join(', ') }
      );
    }
    return json({ error: { code: 'not_found', message: 'Not found.' } }, 404);
  }

  const id = newRequestId();
  const authenticated = await readSession(env, request);

  const ctx: Ctx = {
    request,
    env,
    url,
    params: matched.params,
    requestId: id,
    account: authenticated?.account ?? null,
    session: authenticated?.session ?? null,
  };

  return matched.handler(ctx);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // The operations console is a server-gated path rather than a client-side
    // hash, so the secret URL is not present in the JavaScript bundle.
    if (url.pathname.startsWith(CONSOLE_PREFIX)) {
      return serveConsoleShell(request, env, url);
    }

    if (!url.pathname.startsWith('/api/')) {
      // Static assets are normally served before the Worker (run_worker_first
      // includes /api/* and /console/*). This branch keeps direct Worker URLs
      // coherent for every other path.
      return env.ASSETS.fetch(request);
    }

    if (request.method === 'OPTIONS') {
      return withSecurityHeaders(
        json({ error: { code: 'cors_blocked', message: 'Cross-origin requests are not allowed.' } }, 405),
        env
      );
    }

    try {
      return withSecurityHeaders(await handleApi(request, env, url), env);
    } catch (error) {
      return withSecurityHeaders(errorResponse(error, newRequestId()), env);
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduled(env));
  },
};
