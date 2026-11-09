import { describe, expect, it } from 'vitest';
import {
  api,
  PNG_BYTES,
  sessionCookie,
  setupAdmin,
  unique,
  type Session,
} from './helpers.ts';

interface AmbassadorSession extends Session {
  reference: string;
  applicationId: string;
}

async function applyAmbassador(
  overrides: Partial<{
    email: string;
    fullName: string;
    city: string;
    country: string;
    password: string;
  }> = {}
): Promise<AmbassadorSession> {
  const email = overrides.email ?? `${unique('ambassador')}@example.test`;
  const password = overrides.password ?? 'ambassador-password-123';
  const response = await api('/api/ambassadors/apply', {
    body: {
      fullName: overrides.fullName ?? 'Tariro Moyo',
      email,
      phone: '+263771234567',
      city: overrides.city ?? 'Harare',
      country: overrides.country ?? 'Zimbabwe',
      territory: 'Harare, SADC',
      languages: ['English', 'Shona'],
      sectors: ['Brand partnerships', 'Media buying'],
      experience: 'Eight years in brand partnerships and media sales.',
      motivation: 'I can introduce credible businesses to the MHOMHO network.',
      socialLinks: { linkedin: 'https://linkedin.com/in/tariro' },
      password,
      consentTerms: true,
      consentPrivacy: true,
    },
  });
  expect(response.status).toBe(200);
  const me = await api('/api/ambassadors/me', {
    method: 'GET',
    cookie: sessionCookie(response),
  });
  expect(me.status).toBe(200);
  return {
    cookie: sessionCookie(response),
    csrf: response.body.data.csrfToken,
    accountId: response.body.data.viewer.uid,
    email,
    status: response.body.data.viewer.status,
    reference: me.body.data.application.reference,
    applicationId: me.body.data.application.id,
  };
}

describe('MHOMHO Ambassador applications', () => {
  it('saves an application, issues a reference and keeps the applicant private', async () => {
    const ambassador = await applyAmbassador();

    expect(ambassador.reference).toMatch(/^AMB-\d{4}-[A-Z0-9]{6}$/);
    expect(ambassador.status).toBe('applied');

    const me = await api('/api/ambassadors/me', {
      method: 'GET',
      cookie: ambassador.cookie,
    });
    expect(me.status).toBe(200);
    expect(me.body.data.application.status).toBe('submitted');
    expect(me.body.data.application.fullName).toBe('Tariro Moyo');
    expect(me.body.data.profile).toBeNull();
    expect(me.body.data.application.adminNotes).toBeUndefined();

    const publicProfile = await api('/api/public/ambassadors/tariro-moyo', {
      method: 'GET',
    });
    expect(publicProfile.status).toBe(404);

    const creatorLogin = await api('/api/auth/login', {
      body: { identifier: ambassador.email, password: 'ambassador-password-123' },
    });
    expect(creatorLogin.status).toBe(401);

    const ambassadorLogin = await api('/api/ambassadors/login', {
      body: { email: ambassador.email, password: 'ambassador-password-123' },
    });
    expect(ambassadorLogin.status).toBe(200);
  });

  it('lets an applicant upload private documents that only they and an admin can read', async () => {
    const ambassador = await applyAmbassador();

    const upload = await api('/api/ambassadors/documents?kind=document', {
      method: 'POST',
      cookie: ambassador.cookie,
      csrf: ambassador.csrf,
      rawBody: PNG_BYTES,
      headers: {
        'Content-Type': 'image/png',
        'X-File-Name': encodeURIComponent('company-profile.png'),
      },
    });
    expect(upload.status).toBe(201);
    const documentId = upload.body.data.document.id;
    expect(documentId).toBeTruthy();

    const ownerRead = await api(`/api/ambassador-assets/${documentId}`, {
      method: 'GET',
      cookie: ambassador.cookie,
    });
    expect(ownerRead.status).toBe(200);

    const publicRead = await api(`/api/ambassador-assets/${documentId}`, {
      method: 'GET',
    });
    expect(publicRead.status).toBe(403);

    const admin = await setupAdmin();
    const adminRead = await api(`/api/ambassador-assets/${documentId}`, {
      method: 'GET',
      cookie: admin.cookie,
    });
    expect(adminRead.status).toBe(200);

    const detail = await api(`/api/admin/ambassadors/applications/${ambassador.applicationId}`, {
      method: 'GET',
      cookie: admin.cookie,
    });
    expect(detail.status).toBe(200);
    expect(detail.body.data.documents).toHaveLength(1);
    expect(detail.body.data.documents[0].originalName).toBe('company-profile.png');
  });

  it('requires an administrator to review, request information and approve', async () => {
    const admin = await setupAdmin();
    const ambassador = await applyAmbassador();

    const creator = await api('/api/auth/register', {
      body: {
        name: 'Test Creator',
        email: `${unique('creator')}@example.test`,
        handle: unique('creator'),
        platform: 'TikTok',
        niche: 'Beauty',
        followers: 1000,
        whatsappNumber: '+263771234567',
        password: 'creator-password-123',
      },
    });
    expect(creator.status).toBe(200);
    const creatorCookie = sessionCookie(creator);

    const forbiddenList = await api('/api/admin/ambassadors/applications', {
      method: 'GET',
      cookie: creatorCookie,
    });
    expect(forbiddenList.status).toBe(403);

    const list = await api('/api/admin/ambassadors/applications', {
      method: 'GET',
      cookie: admin.cookie,
    });
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].reference).toBe(ambassador.reference);

    const requestInfo = await api(
      `/api/admin/ambassadors/applications/${ambassador.applicationId}/decision`,
      {
        method: 'POST',
        cookie: admin.cookie,
        csrf: admin.csrf,
        body: { action: 'request_info', note: 'Please send your company registration.' },
      }
    );
    expect(requestInfo.status).toBe(200);
    expect(requestInfo.body.data.application.status).toBe('needs_info');

    const applicant = await api('/api/ambassadors/me', {
      method: 'GET',
      cookie: ambassador.cookie,
    });
    expect(applicant.body.data.application.requestedInfo).toBe(
      'Please send your company registration.'
    );

    const update = await api('/api/ambassadors/application', {
      method: 'PATCH',
      cookie: ambassador.cookie,
      csrf: ambassador.csrf,
      body: {
        applicantResponse: 'Registration certificate attached.',
        city: 'Bulawayo',
      },
    });
    expect(update.status).toBe(200);
    expect(update.body.data.application.status).toBe('submitted');

    const approve = await api(
      `/api/admin/ambassadors/applications/${ambassador.applicationId}/decision`,
      {
        method: 'POST',
        cookie: admin.cookie,
        csrf: admin.csrf,
        body: { action: 'approve', note: 'Approved after review.' },
      }
    );
    expect(approve.status).toBe(200);
    expect(approve.body.data.application.status).toBe('approved');
    expect(approve.body.data.profile.ambassadorId).toMatch(/^MH-AMB-\d{6}$/);
    expect(approve.body.data.profile.status).toBe('draft');
    expect(approve.body.data.profile.title).toBe('MHOMHO Commercial Envoy');

    const applicantAfter = await api('/api/ambassadors/me', {
      method: 'GET',
      cookie: ambassador.cookie,
    });
    expect(applicantAfter.body.data.accountStatus).toBe('approved');
    expect(applicantAfter.body.data.profile.username).toBeTruthy();
  });

  it('publishes only after approval and removes the public page when suspended', async () => {
    const admin = await setupAdmin();
    const ambassador = await applyAmbassador();

    const approve = await api(
      `/api/admin/ambassadors/applications/${ambassador.applicationId}/decision`,
      {
        method: 'POST',
        cookie: admin.cookie,
        csrf: admin.csrf,
        body: { action: 'approve' },
      }
    );
    expect(approve.status).toBe(200);
    const username = approve.body.data.profile.username as string;

    const beforePublish = await api(`/api/public/ambassadors/${username}`, { method: 'GET' });
    expect(beforePublish.status).toBe(404);

    const photo = await api('/api/ambassadors/documents?kind=photo', {
      method: 'POST',
      cookie: ambassador.cookie,
      csrf: ambassador.csrf,
      rawBody: PNG_BYTES,
      headers: {
        'Content-Type': 'image/png',
        'X-File-Name': encodeURIComponent('portrait.png'),
      },
    });
    expect(photo.status).toBe(201);
    const photoUrl = photo.body.data.document.url as string;

    // A draft profile photograph is not public until the profile is published.
    const draftPhotoRead = await api(photoUrl, { method: 'GET' });
    expect(draftPhotoRead.status).toBe(403);

    const profile = await api('/api/ambassadors/profile', {
      method: 'PATCH',
      cookie: ambassador.cookie,
      csrf: ambassador.csrf,
      body: {
        publicName: 'Tariro Moyo',
        bio: 'I connect ambitious brands with trusted creators across Southern Africa.',
        country: 'Zimbabwe',
        city: 'Harare',
        languages: ['English', 'Shona'],
        sectors: ['Brand partnerships'],
        contactEmail: 'tariro@example.test',
        contactWhatsapp: '+263771234567',
        socialLinks: { linkedin: 'https://linkedin.com/in/tariro' },
      },
    });
    expect(profile.status).toBe(200);

    const publish = await api('/api/ambassadors/profile/publish', {
      method: 'POST',
      cookie: ambassador.cookie,
      csrf: ambassador.csrf,
      body: {},
    });
    expect(publish.status, JSON.stringify(publish.body)).toBe(200);
    expect(publish.body.data.profile.status).toBe('published');

    const publicProfile = await api(`/api/public/ambassadors/${username}`, { method: 'GET' });
    expect(publicProfile.status).toBe(200);
    expect(publicProfile.body.data.profile.publicName).toBe('Tariro Moyo');
    expect(publicProfile.body.data.profile.title).toBe('MHOMHO Commercial Envoy');
    expect(publicProfile.body.data.verified).toBe(true);
    expect(publicProfile.body.data.profile.photoUrl).toContain('/api/ambassador-assets/');

    const publishedPhotoRead = await api(photoUrl, { method: 'GET' });
    expect(publishedPhotoRead.status).toBe(200);

    const suspend = await api(
      `/api/admin/ambassadors/applications/${ambassador.applicationId}/decision`,
      {
        method: 'POST',
        cookie: admin.cookie,
        csrf: admin.csrf,
        body: { action: 'suspend', note: 'Appointment under review.' },
      }
    );
    expect(suspend.status).toBe(200);

    const afterSuspend = await api(`/api/public/ambassadors/${username}`, { method: 'GET' });
    expect(afterSuspend.status).toBe(404);

    const reinstate = await api(
      `/api/admin/ambassadors/applications/${ambassador.applicationId}/decision`,
      {
        method: 'POST',
        cookie: admin.cookie,
        csrf: admin.csrf,
        body: { action: 'reinstate', note: 'Reinstated.' },
      }
    );
    expect(reinstate.status).toBe(200);

    const afterReinstate = await api(`/api/public/ambassadors/${username}`, { method: 'GET' });
    expect(afterReinstate.status).toBe(200);
  });

  it('rejects a public profile before the applicant has published it', async () => {
    const admin = await setupAdmin();
    const ambassador = await applyAmbassador({ fullName: 'Rudo Ncube' });

    const approve = await api(
      `/api/admin/ambassadors/applications/${ambassador.applicationId}/decision`,
      {
        method: 'POST',
        cookie: admin.cookie,
        csrf: admin.csrf,
        body: { action: 'approve' },
      }
    );
    expect(approve.status).toBe(200);

    const publicProfile = await api('/api/public/ambassadors/rudo-ncube', { method: 'GET' });
    expect(publicProfile.status).toBe(404);
  });
});
