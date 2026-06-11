import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { getDatabase } from "@/infrastructure/db/mongo-client";

const SESSION_COOKIE = "cs2t_session";
const OAUTH_STATE_COOKIE = "cs2t_oauth_state";
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

export function isGoogleAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  return verifySession(token);
}

export async function getPortfolioOwnerId(): Promise<string> {
  const user = await getCurrentUser();
  return user ? `google:${user.id}` : "guest";
}

export async function createGoogleAuthorizationUrl(): Promise<string> {
  if (!isGoogleAuthConfigured()) {
    throw new Error("Chưa cấu hình GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET.");
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: await getGoogleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function handleGoogleCallback(
  code: string,
  state: string,
): Promise<SessionUser> {
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!expectedState || expectedState !== state) {
    throw new Error("Phiên đăng nhập Google không hợp lệ. Hãy thử lại.");
  }

  const tokens = await exchangeCodeForTokens(code);
  if (!tokens.access_token) {
    throw new Error(
      tokens.error_description ??
        tokens.error ??
        "Không lấy được access token từ Google.",
    );
  }

  const profile = await fetchGoogleUserInfo(tokens.access_token);
  if (!profile.email || profile.email_verified === false) {
    throw new Error("Gmail chưa được xác minh nên không thể đăng nhập.");
  }

  const user = await upsertUser(profile);
  await setSessionCookie(user);
  return user;
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

async function exchangeCodeForTokens(
  code: string,
): Promise<GoogleTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: await getGoogleRedirectUri(),
    }),
  });

  const data = (await response.json()) as GoogleTokenResponse;
  if (!response.ok) {
    throw new Error(
      data.error_description ?? data.error ?? "Google token exchange thất bại.",
    );
  }

  return data;
}

async function fetchGoogleUserInfo(
  accessToken: string,
): Promise<GoogleUserInfo> {
  const response = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    throw new Error("Không lấy được thông tin Gmail từ Google.");
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

  await db.collection("users").updateOne(
    { provider: "google", providerAccountId: profile.sub },
    {
      $set: {
        ...user,
        provider: "google",
        providerAccountId: profile.sub,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  return user;
}

async function getGoogleRedirectUri(): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (appUrl) {
    return `${appUrl.replace(/\/+$/, "")}/api/auth/google/callback`;
  }

  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "localhost:3000";
  const proto =
    headerStore.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/api/auth/google/callback`;
}

async function setSessionCookie(user: SessionUser) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, signSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

function signSession(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifySession(token: string): SessionUser | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
  if (signature.length !== expected.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as SessionUser;
    if (!parsed.id || !parsed.email) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getSessionSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET hoặc NEXTAUTH_SECRET phải được cấu hình trong production.",
      );
    }
    return "dev-only-cs2-tracker-secret";
  }
  return secret;
}
