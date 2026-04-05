"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ADMIN_PASSWORD = "password";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Admin Access</CardTitle>
            <CardDescription>Arc Counting fund dispatch panel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && password === ADMIN_PASSWORD) {
                    setAuthenticated(true);
                  }
                }}
                placeholder="Enter admin password"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (password === ADMIN_PASSWORD) {
                  setAuthenticated(true);
                } else {
                  toast.error("Wrong password");
                }
              }}
            >
              Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AdminPanel />;
}

function AdminPanel() {
  const dispatchAll = useAction(api.dispatch.dispatchAll);
  const [isDispatching, setIsDispatching] = useState(false);
  const [results, setResults] = useState<{
    dispatched: number;
    failed: number;
    transfers: Array<{ to: string; amountCents: number; txHash?: string; error?: string }>;
  } | null>(null);

  const handleDispatch = async () => {
    setIsDispatching(true);
    try {
      const result = await dispatchAll({});
      setResults(result);
      if (result.dispatched > 0) {
        toast.success(`Dispatched ${result.dispatched} transfer(s)`);
      } else if (result.transfers.length === 0) {
        toast.info("No pending payments to dispatch");
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} transfer(s) failed`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Fund Dispatch</h1>
          <p className="text-sm text-muted-foreground">
            Send collected USDC from Arc Counting&apos;s wallet to companies and referrers
          </p>
        </div>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>1. WalletConnect Pay collects USDC from customers → arrives at Arc Counting&apos;s wallet on Arbitrum/Base</p>
            <p>2. Click &quot;Dispatch All&quot; → reads all paid-but-undispatched payments</p>
            <p>3. For each payment, resolves destination: custom recipient address &gt; company settlement address</p>
            <p>4. Calculates referral splits (if checkout link has referral %)</p>
            <p>5. Signs &amp; sends USDC ERC20 transfers using the backend private key</p>
            <p>6. Records dispatch + marks payments as dispatched</p>
          </CardContent>
        </Card>

        {/* Dispatch action */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dispatch Funds</CardTitle>
            <CardDescription>
              Sends USDC from Arc Counting&apos;s master wallet to all pending destinations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => void handleDispatch()}
              disabled={isDispatching}
              size="lg"
              className="w-full"
            >
              {isDispatching ? "Dispatching..." : "Dispatch All Pending"}
            </Button>

            {results && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Badge variant="default">{results.dispatched} sent</Badge>
                  {results.failed > 0 && (
                    <Badge variant="destructive">{results.failed} failed</Badge>
                  )}
                  {results.transfers.length === 0 && (
                    <Badge variant="secondary">Nothing to dispatch</Badge>
                  )}
                </div>

                {results.transfers.length > 0 && (
                  <div className="rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="p-3">Destination</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.transfers.map((t, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="p-3 font-mono text-xs">
                              {t.to ? `${t.to.slice(0, 10)}...${t.to.slice(-6)}` : "—"}
                            </td>
                            <td className="p-3 tabular-nums">
                              ${(t.amountCents / 100).toFixed(2)}
                            </td>
                            <td className="p-3">
                              {t.txHash ? (
                                <div>
                                  <Badge variant="default">Sent</Badge>
                                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                                    {t.txHash.slice(0, 18)}...
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <Badge variant="destructive">Failed</Badge>
                                  <p className="mt-1 text-xs text-destructive">{t.error}</p>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Arc Counting Admin · Hackathon Mode
        </p>
      </div>
    </div>
  );
}
