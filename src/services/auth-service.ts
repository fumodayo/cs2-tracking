import crypto from 'crypto';
import { cookies, headers } from 'next/headers';
import '@/env';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import { encrypt, decrypt } from './crypto-service';

const SESSION_COOKIE = 'cs2t_session';
const OAUTH_STATE_COOKIE = 'cs2t_oauth_state';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
};

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

type SessionPayload = {
  v: 1;
  iat: number;
  exp: number;
  user: SessionUser;
};

export function isGoogleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getAdminEmails(): string[] {
  const emailsEnv = process.env.ADMIN_EMAILS || '';
  return emailsEnv
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export function isAdminAccessAllowed(user?: SessionUser | null): boolean {
  if (isGoogleAuthConfigured()) {
    return isAdminUser(user?.email);
  }

  return process.env.NODE_ENV !== 'production';
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  return verifySession(token);
}

export async function getGuestId(): Promise<string> {
  const cookieStore = await cookies();
  let guestId = cookieStore.get('cs2t_guest_id')?.value;
  if (!guestId || !guestId.startsWith('guest:')) {
    const uuid = crypto.randomUUID();
    guestId = `guest:${uuid}`;
    try {
      cookieStore.set('cs2t_guest_id', guestId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: '/',
      });
    } catch {
      // Ignore set cookie error during page render / GET requests
    }
  }
  return guestId;
}

export async function getPortfolioOwnerId(): Promise<string> {
  const user = await getCurrentUser();
  if (user) {
    return `google:${user.id}`;
  }
  return getGuestId();
}

export async function checkAuth(): Promise<{ authorized: boolean; ownerId: string }> {
  if (isGoogleAuthConfigured()) {
    const user = await getCurrentUser();
    if (!user) {
      const guestId = await getGuestId();
      return { authorized: false, ownerId: guestId };
    }
    return { authorized: true, ownerId: `google:${user.id}` };
  }
  const guestId = await getGuestId();
  return { authorized: true, ownerId: guestId };
}

export async function createGoogleAuthorizationUrl(): Promise<string> {
  if (!isGoogleAuthConfigured()) {
    throw new Error('missingGoogleOAuthConfig');
  }

  const state = crypto.randomBytes(24).toString('base64url');
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10,
    path: '/',
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: await getGoogleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function handleGoogleCallback(code: string, state: string): Promise<SessionUser> {
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!expectedState || expectedState !== state) {
    throw new Error('invalidGoogleSession');
  }

  const tokens = await exchangeCodeForTokens(code);
  if (!tokens.access_token) {
    throw new Error(tokens.error_description ?? tokens.error ?? 'failedToGetGoogleAccessToken');
  }

  const profile = await fetchGoogleUserInfo(tokens.access_token);
  if (!profile.email || profile.email_verified === false) {
    throw new Error('gmailNotVerified');
  }

  const user = await upsertUser(profile);

  // Gộp dữ liệu guest vào user nếu có cookie guest ID
  const guestId = cookieStore.get('cs2t_guest_id')?.value;
  if (guestId && guestId.startsWith('guest:')) {
    try {
      await mergeGuestDataToUser(guestId, user.id);
      cookieStore.delete('cs2t_guest_id');
    } catch (mergeErr) {
      console.error('Failed to merge guest data to user:', mergeErr);
    }
  }

  await setSessionCookie(user);
  return user;
}

async function mergeGuestDataToUser(guestId: string, googleUserId: string): Promise<void> {
  const db = await getDatabase();
  const targetOwnerId = `google:${googleUserId}`;

  // 1. Gộp portfolio_items: cập nhật ownerId
  await db
    .collection('portfolio_items')
    .updateMany({ ownerId: guestId }, { $set: { ownerId: targetOwnerId, updatedAt: new Date() } });

  // 2. Gộp storage_units: cập nhật ownerId
  await db
    .collection('storage_units')
    .updateMany({ ownerId: guestId }, { $set: { ownerId: targetOwnerId, updatedAt: new Date() } });

  // 3. Gộp portfolio_accounts: cập nhật ownerId, tránh trùng steamId64
  const guestAccounts = await db
    .collection('portfolio_accounts')
    .find({ ownerId: guestId })
    .toArray();
  for (const account of guestAccounts) {
    if (account.steamId64) {
      const duplicate = await db.collection('portfolio_accounts').findOne({
        ownerId: targetOwnerId,
        steamId64: account.steamId64,
      });
      if (duplicate) {
        await db.collection('portfolio_accounts').deleteOne({ _id: account._id });
      } else {
        await db
          .collection('portfolio_accounts')
          .updateOne(
            { _id: account._id },
            { $set: { ownerId: targetOwnerId, updatedAt: new Date() } }
          );
      }
    }
  }
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete('cs2t_guest_id');
}

async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: await getGoogleRedirectUri(),
    }),
  });

  const data = (await response.json()) as GoogleTokenResponse;
  if (!response.ok) {
    throw new Error(data.error_description ?? data.error ?? 'googleTokenExchangeFailed');
  }

  return data;
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('failedToGetGoogleUserInfo');
  }

  return (await response.json()) as GoogleUserInfo;
}

async function upsertUser(profile: GoogleUserInfo): Promise<SessionUser> {
  const db = await getDatabase();
  const now = new Date();
  const user: SessionUser = {
    id: profile.sub,
    email: profile.email,
    name: profile.name ?? profile.email,
    image: profile.picture ?? null,
  };

  await db.collection('users').updateOne(
    { provider: 'google', providerAccountId: profile.sub },
    {
      $set: {
        ...user,
        provider: 'google',
        providerAccountId: profile.sub,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  return user;
}

async function getGoogleRedirectUri(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost:3000';
  const proto =
    headerStore.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (appUrl) {
    const isAppUrlLocal = appUrl.includes('localhost') || appUrl.includes('127.0.0.1');
    const isRequestLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');

    // Chỉ dùng appUrl đã cấu hình nếu không bị lệch localhost
    if (!isAppUrlLocal || isRequestLocal) {
      return `${appUrl.replace(/\/+$/, '')}/api/auth/google/callback`;
    }
  }

  return `${proto}://${host}/api/auth/google/callback`;
}

async function setSessionCookie(user: SessionUser) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, signSession(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
}

function signSession(user: SessionUser): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    v: 1,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
    user,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifySession(token: string): SessionUser | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  if (signature.length !== expected.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (
      parsed.v !== 1 ||
      typeof parsed.exp !== 'number' ||
      parsed.exp <= Math.floor(Date.now() / 1000) ||
      !parsed.user?.id ||
      !parsed.user.email
    ) {
      return null;
    }
    return parsed.user;
  } catch {
    return null;
  }
}

function getSessionSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('authSecretRequired');
    }
    return 'dev-only-cs2-tracker-secret';
  }
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('authSecretTooShort');
  }
  return secret;
}

export async function getUserCs2capApiKey(userId: string): Promise<string | null> {
  try {
    const db = await getDatabase();
    const userDoc = await db.collection('users').findOne({ id: userId });
    return userDoc?.cs2capApiKey ? decrypt(userDoc.cs2capApiKey) : null;
  } catch (err) {
    console.error('Error fetching user CS2Cap API Key:', err);
    return null;
  }
}

export async function updateUserCs2capApiKey(userId: string, apiKey: string | null): Promise<void> {
  const db = await getDatabase();
  const encryptedKey = apiKey ? encrypt(apiKey.trim()) : null;
  await db.collection('users').updateOne(
    { id: userId },
    {
      $set: {
        cs2capApiKey: encryptedKey,
        updatedAt: new Date(),
      },
    }
  );
}

export async function getUserCs2capApiKeys(userId: string): Promise<string[]> {
  try {
    const db = await getDatabase();
    const userDoc = await db.collection('users').findOne({ id: userId });
    const keys: string[] = userDoc?.cs2capApiKeys || [];
    // Migrate nếu chỉ có cs2capApiKey
    if (keys.length === 0 && userDoc?.cs2capApiKey) {
      return [decrypt(userDoc.cs2capApiKey)];
    }
    return keys.map((k) => decrypt(k)).filter(Boolean);
  } catch (err) {
    console.error('Error fetching user CS2Cap API Keys:', err);
    return [];
  }
}

export async function addUserCs2capApiKey(userId: string, apiKey: string): Promise<void> {
  const db = await getDatabase();
  const trimmed = apiKey.trim();

  const userDoc = await db.collection('users').findOne({ id: userId });
  const keys: string[] = userDoc?.cs2capApiKeys || [];
  const decryptedKeys = keys.map((k) => decrypt(k));

  if (decryptedKeys.includes(trimmed)) {
    const existingEncryptedKey = keys[decryptedKeys.indexOf(trimmed)];
    await db.collection('users').updateOne(
      { id: userId },
      {
        $set: { cs2capApiKey: existingEncryptedKey, updatedAt: new Date() },
      }
    );
  } else {
    const encrypted = encrypt(trimmed);
    await db.collection('users').updateOne(
      { id: userId },
      {
        $addToSet: { cs2capApiKeys: encrypted },
        $set: { cs2capApiKey: encrypted, updatedAt: new Date() },
      }
    );
  }
}

export async function selectUserCs2capApiKey(userId: string, apiKey: string): Promise<void> {
  const db = await getDatabase();
  const userDoc = await db.collection('users').findOne({ id: userId });
  const keys: string[] = userDoc?.cs2capApiKeys || [];
  const match = keys.find((k) => decrypt(k) === apiKey);

  if (match) {
    await db.collection('users').updateOne(
      { id: userId },
      {
        $set: { cs2capApiKey: match, updatedAt: new Date() },
      }
    );
  }
}

export async function removeUserCs2capApiKey(userId: string, apiKey: string): Promise<void> {
  const db = await getDatabase();
  const userDoc = await db.collection('users').findOne({ id: userId });
  const keys: string[] = userDoc?.cs2capApiKeys || [];

  const targetEncryptedKey = keys.find((k) => decrypt(k) === apiKey);
  if (!targetEncryptedKey) return;

  const newKeys = keys.filter((k) => k !== targetEncryptedKey);
  let newActiveKey = userDoc?.cs2capApiKey;

  if (newActiveKey === targetEncryptedKey) {
    newActiveKey = newKeys.length > 0 ? newKeys[0] : null;
  }

  await db.collection('users').updateOne(
    { id: userId },
    {
      $set: {
        cs2capApiKeys: newKeys,
        cs2capApiKey: newActiveKey,
        updatedAt: new Date(),
      },
    }
  );
}
