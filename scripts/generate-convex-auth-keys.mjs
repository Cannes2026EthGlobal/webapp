import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(".env.local");
const defaultIssuer = "https://auth.arc-counting.local";
const defaultAudience = "arc-counting";

function upsertEnvValue(source, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");

  if (pattern.test(source)) {
    return source.replace(pattern, line);
  }

  return source.trimEnd() ? `${source.trimEnd()}\n${line}\n` : `${line}\n`;
}

const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

if (
  existing.includes("CONVEX_AUTH_PRIVATE_JWK_JSON=") &&
  existing.includes("CONVEX_AUTH_PUBLIC_JWK_JSON=")
) {
  console.log("Convex auth keys already exist in .env.local");
  process.exit(0);
}

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});
const privateJwk = privateKey.export({ format: "jwk" });
const publicJwk = publicKey.export({ format: "jwk" });

let nextEnv = existing;
nextEnv = upsertEnvValue(nextEnv, "CONVEX_AUTH_ISSUER", defaultIssuer);
nextEnv = upsertEnvValue(nextEnv, "CONVEX_AUTH_AUDIENCE", defaultAudience);
nextEnv = upsertEnvValue(
  nextEnv,
  "CONVEX_AUTH_PRIVATE_JWK_JSON",
  `'${JSON.stringify(privateJwk)}'`
);
nextEnv = upsertEnvValue(
  nextEnv,
  "CONVEX_AUTH_PUBLIC_JWK_JSON",
  `'${JSON.stringify(publicJwk)}'`
);

writeFileSync(envPath, nextEnv);

console.log(`Generated Convex auth keys in ${envPath}`);
