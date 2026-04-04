import { randomUUID } from "node:crypto";
import { SignJWT, importJWK } from "jose";

export const runtime = "nodejs";

const DEFAULT_CONVEX_AUTH_ISSUER = "https://auth.arc-counting.local";
const DEFAULT_CONVEX_AUTH_AUDIENCE = "arc-counting";
const REOWN_AUTH_URL = "https://api.web3modal.org/auth/v1";

type ReownSessionAccount = {
  sub: string;
  email?: string;
  address: string;
  chainId: number | string;
  chainNamespace: string;
  caip2Network: string;
  projectUuid: string;
  projectIdKey: string;
  profileUuid: string;
  iss: string;
  aud: string;
};

function requireJsonEnv<T>(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not defined`);
  }

  return JSON.parse(value) as T;
}

function getBearerToken(header: string | null) {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

async function fetchReownSessionAccount(reownToken: string) {
  const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

  if (!projectId) {
    throw new Error("NEXT_PUBLIC_PROJECT_ID is not defined");
  }

  const url = new URL(`${REOWN_AUTH_URL}/me`);
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("includeAppKitAccount", "true");
  url.searchParams.set("st", "appkit");
  url.searchParams.set("sv", "nextjs-convex");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${reownToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as ReownSessionAccount;
}

async function mintConvexToken(session: ReownSessionAccount) {
  const issuer = process.env.CONVEX_AUTH_ISSUER ?? DEFAULT_CONVEX_AUTH_ISSUER;
  const audience =
    process.env.CONVEX_AUTH_AUDIENCE ?? DEFAULT_CONVEX_AUTH_AUDIENCE;
  const privateJwk = requireJsonEnv<JsonWebKey>("CONVEX_AUTH_PRIVATE_JWK_JSON");

  const privateKey = await importJWK(privateJwk, "ES256");
  const now = Math.floor(Date.now() / 1000);
  const alias = session.email
    ? session.email.split("@")[0]
    : `${session.address.slice(0, 6)}...${session.address.slice(-4)}`;

  return new SignJWT({
    email: session.email,
    name: alias,
    preferred_username: alias,
    walletAddress: session.address,
    walletAddressLower: session.address.toLowerCase(),
    chainId: String(session.chainId),
    chainNamespace: session.chainNamespace,
    caip2Network: session.caip2Network,
    reownProjectUuid: session.projectUuid,
    reownProjectIdKey: session.projectIdKey,
    reownSubject: session.sub,
    reownIssuer: session.iss,
    reownAudience: session.aud,
    reownProfileUuid: session.profileUuid,
  })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(session.profileUuid || session.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60)
    .setJti(randomUUID())
    .sign(privateKey);
}

export async function POST(request: Request) {
  try {
    const reownToken = getBearerToken(request.headers.get("authorization"));

    if (!reownToken) {
      return Response.json(
        { error: "Missing Reown authorization token" },
        { status: 401 },
      );
    }

    const session = await fetchReownSessionAccount(reownToken);

    if (!session) {
      return Response.json(
        { error: "Unable to validate Reown session" },
        { status: 401 },
      );
    }

    const token = await mintConvexToken(session);
    return Response.json({ token });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to mint Convex token";

    return Response.json({ error: message }, { status: 500 });
  }
}
