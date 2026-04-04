"use client";

import { useEffect, useEffectEvent, useState } from "react";
import {
  useAppKit,
  useAppKitAccount,
  useDisconnect,
} from "@reown/appkit/react";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";

function formatDate(value: number | null) {
  if (!value) {
    return "Not synced yet";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatWallet(address: string | null) {
  if (!address) {
    return "No wallet on file";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function DashboardContent() {
  const { open } = useAppKit();
  const { address } = useAppKitAccount();
  const { disconnect } = useDisconnect();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.operators.viewerWorkspace);
  const syncViewer = useMutation(api.operators.syncViewer);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const syncViewerWorkspace = useEffectEvent(async () => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      await syncViewer({});
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "Unable to sync operator",
      );
    } finally {
      setIsSyncing(false);
    }
  });

  useEffect(() => {
    if (
      !isAuthenticated ||
      isLoading ||
      viewer === undefined ||
      viewer === null ||
      viewer.operator ||
      viewer.workspace ||
      isSyncing
    ) {
      return;
    }

    void syncViewerWorkspace();
  }, [isAuthenticated, isLoading, isSyncing, viewer]);

  if (viewer === undefined || isLoading || viewer === null) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-16">
        <Card className="w-full max-w-xl border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>Connecting Arc Counting</CardTitle>
            <CardDescription>
              Verifying the WalletConnect session and opening the Convex
              workspace.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f3f4f6_40%,#eef2f7_100%)] px-6 py-10 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                Convex + Reown active
              </Badge>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  {viewer.workspace?.name ?? "Arc Counting Workspace"}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  WalletConnect authentication is issuing a verified session,
                  Convex is accepting that session through a signed exchange,
                  and the operator profile is being persisted in the linked
                  cloud deployment.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => open()}>
                Switch Wallet
              </Button>
              <Button variant="ghost" onClick={() => disconnect()}>
                Disconnect
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <Badge variant="outline">Privacy: {viewer.auth.privacyState}</Badge>
            <Badge variant="outline">
              Workspace slug: {viewer.workspace?.slug ?? "pending"}
            </Badge>
            <Badge variant="outline">
              Wallet: {formatWallet(viewer.auth.walletAddress)}
            </Badge>
            <Badge variant="outline">
              Convex auth: {isAuthenticated ? "Authenticated" : "Pending"}
            </Badge>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-slate-200/80 bg-white/90">
            <CardHeader>
              <CardTitle>Operator</CardTitle>
              <CardDescription>
                Session data sourced from Reown Authentication.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Alias
                </div>
                <div className="mt-1 font-medium text-slate-950">
                  {viewer.operator?.alias ?? "Provisioning operator"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Wallet
                </div>
                <div className="mt-1 font-medium text-slate-950">
                  {formatWallet(
                    address ?? viewer.operator?.walletAddress ?? null,
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Email
                </div>
                <div className="mt-1 font-medium text-slate-950">
                  {viewer.operator?.email ?? "Pseudonymous session"}
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-between text-xs text-slate-500">
              <span>Last sync</span>
              <span>{formatDate(viewer.operator?.lastSeenAt ?? null)}</span>
            </CardFooter>
          </Card>

          <Card className="border-slate-200/80 bg-white/90">
            <CardHeader>
              <CardTitle>WalletConnect Auth</CardTitle>
              <CardDescription>
                Claims exchanged into a Convex-compatible JWT.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Token identifier
                </div>
                <div className="mt-1 break-all font-medium text-slate-950">
                  {viewer.auth.tokenIdentifier}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Issuer
                </div>
                <div className="mt-1 break-all font-medium text-slate-950">
                  {viewer.auth.issuer}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Network
                </div>
                <div className="mt-1 font-medium text-slate-950">
                  {viewer.auth.caip2Network}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/90">
            <CardHeader>
              <CardTitle>Convex Deployment</CardTitle>
              <CardDescription>
                Live dev deployment selected for this worktree.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  URL
                </div>
                <div className="mt-1 break-all font-medium text-slate-950">
                  {process.env.NEXT_PUBLIC_CONVEX_URL}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Project
                </div>
                <div className="mt-1 font-medium text-slate-950">
                  arc-counting-convex-walletconnect
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Status
                </div>
                <div className="mt-1 font-medium text-slate-950">
                  {isSyncing ? "Syncing operator" : "Ready"}
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-between text-xs text-slate-500">
              <span>Cloud-backed</span>
              <span>
                {viewer.workspace
                  ? "Workspace persisted"
                  : "Awaiting first write"}
              </span>
            </CardFooter>
          </Card>
        </section>

        {syncError ? (
          <Card className="border-rose-200 bg-rose-50/90 text-rose-900">
            <CardHeader>
              <CardTitle>Sync failed</CardTitle>
              <CardDescription className="text-rose-800">
                Convex rejected the operator sync request.
              </CardDescription>
            </CardHeader>
            <CardContent>{syncError}</CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function DashboardUnauthenticated() {
  const { open } = useAppKit();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-16">
      <Card className="w-full max-w-xl border-slate-200 bg-white/90">
        <CardHeader>
          <Badge
            variant="outline"
            className="w-fit border-slate-200 bg-slate-50 text-slate-700"
          >
            Session required
          </Badge>
          <CardTitle>Authenticate with WalletConnect</CardTitle>
          <CardDescription>
            This dashboard now depends on a Reown-authenticated session so
            Convex can resolve the operator identity server-side.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-end">
          <Button onClick={() => open()}>Open WalletConnect</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export function DashboardClient() {
  return (
    <>
      <AuthLoading>
        <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-16">
          <Card className="w-full max-w-xl border-slate-200 bg-white/90">
            <CardHeader>
              <CardTitle>Loading authentication</CardTitle>
              <CardDescription>
                Waiting for Convex to accept the WalletConnect-backed JWT.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AuthLoading>

      <Unauthenticated>
        <DashboardUnauthenticated />
      </Unauthenticated>

      <Authenticated>
        <DashboardContent />
      </Authenticated>
    </>
  );
}
