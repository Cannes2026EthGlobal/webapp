import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

type PrivacyState = "Pseudonymous" | "Verified" | "Shielded" | "Multi-wallet";

function toAlias(email: string | undefined, walletAddress: string | undefined) {
  if (email) {
    return email.split("@")[0];
  }

  if (walletAddress) {
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }

  return "Arc operator";
}

function toPrivacyState(email: string | undefined): PrivacyState {
  return email ? "Verified" : "Pseudonymous";
}

function toWorkspaceSlug(
  walletAddress: string | undefined,
  tokenIdentifier: string,
) {
  const raw = walletAddress
    ? `wallet-${walletAddress.toLowerCase().slice(2, 10)}`
    : tokenIdentifier.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");

  return raw.slice(0, 48);
}

export const viewerWorkspace = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    const operator = await ctx.db
      .query("operators")
      .withIndex("by_token_identifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    const workspace = await ctx.db
      .query("businesses")
      .withIndex("by_owner_token_identifier", (q) =>
        q.eq("ownerTokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    return {
      auth: {
        caip2Network:
          (identity.caip2Network as string | undefined) ?? "unknown",
        email: identity.email ?? null,
        issuer: identity.issuer,
        privacyState:
          operator?.privacyState ?? toPrivacyState(identity.email ?? undefined),
        tokenIdentifier: identity.tokenIdentifier,
        walletAddress: (identity.walletAddress as string | undefined) ?? null,
      },
      operator: operator
        ? {
            alias: operator.alias,
            email: operator.email ?? null,
            lastSeenAt: operator.lastSeenAt,
            walletAddress: operator.walletAddress ?? null,
          }
        : null,
      workspace: workspace
        ? {
            createdAt: workspace.createdAt,
            name: workspace.name,
            privacyState: workspace.privacyState,
            slug: workspace.slug,
          }
        : null,
    };
  },
});

export const syncViewer = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new ConvexError("Unauthorized");
    }

    const now = Date.now();
    const email = identity.email ?? undefined;
    const walletAddress =
      (identity.walletAddress as string | undefined) ?? undefined;
    const tokenIdentifier = identity.tokenIdentifier;
    const privacyState = toPrivacyState(email);
    const alias = toAlias(email, walletAddress);

    const existingOperator = await ctx.db
      .query("operators")
      .withIndex("by_token_identifier", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier),
      )
      .unique();

    const operatorPatch = {
      alias,
      caip2Network: (identity.caip2Network as string | undefined) ?? undefined,
      email,
      lastSeenAt: now,
      privacyState,
      reownProfileUuid:
        (identity.reownProfileUuid as string | undefined) ?? undefined,
      reownProjectIdKey:
        (identity.reownProjectIdKey as string | undefined) ?? undefined,
      reownProjectUuid:
        (identity.reownProjectUuid as string | undefined) ?? undefined,
      reownSubject: (identity.reownSubject as string | undefined) ?? undefined,
      tokenIdentifier,
      updatedAt: now,
      walletAddress,
      walletAddressLower: walletAddress?.toLowerCase(),
    };

    let operatorId = existingOperator?._id;

    if (existingOperator) {
      await ctx.db.patch(existingOperator._id, operatorPatch);
    } else {
      operatorId = await ctx.db.insert("operators", {
        ...operatorPatch,
        createdAt: now,
      });
    }

    const existingWorkspace = await ctx.db
      .query("businesses")
      .withIndex("by_owner_token_identifier", (q) =>
        q.eq("ownerTokenIdentifier", tokenIdentifier),
      )
      .unique();

    const businessName = email
      ? `${alias} workspace`
      : "Arc Counting workspace";
    const workspacePatch = {
      name: businessName,
      ownerTokenIdentifier: tokenIdentifier,
      privacyState,
      slug: toWorkspaceSlug(walletAddress, tokenIdentifier),
      updatedAt: now,
    };

    let workspaceId = existingWorkspace?._id;

    if (existingWorkspace) {
      await ctx.db.patch(existingWorkspace._id, workspacePatch);
    } else {
      workspaceId = await ctx.db.insert("businesses", {
        ...workspacePatch,
        createdAt: now,
      });
    }

    return {
      operatorId,
      workspaceId,
    };
  },
});
