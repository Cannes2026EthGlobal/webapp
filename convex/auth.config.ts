import type { AuthConfig } from "convex/server";

const DEFAULT_CONVEX_AUTH_ISSUER = "https://auth.arc-counting.local";
const DEFAULT_CONVEX_AUTH_AUDIENCE = "arc-counting";

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not defined`);
  }

  return value;
}

const issuer = process.env.CONVEX_AUTH_ISSUER ?? DEFAULT_CONVEX_AUTH_ISSUER;
const audience =
  process.env.CONVEX_AUTH_AUDIENCE ?? DEFAULT_CONVEX_AUTH_AUDIENCE;
const jwks = `data:application/json,${encodeURIComponent(
  JSON.stringify({
    keys: [JSON.parse(requireEnv("CONVEX_AUTH_PUBLIC_JWK_JSON"))],
  }),
)}`;

export default {
  providers: [
    {
      type: "customJwt",
      issuer,
      applicationID: audience,
      algorithm: "ES256",
      jwks,
    },
  ],
} satisfies AuthConfig;
