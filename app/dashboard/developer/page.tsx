"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { CompanyGuard } from "@/components/company-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

const SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "https://your-deployment.convex.site";

function DeveloperContent() {
  const { companyId } = useCompany();
  const keys = useQuery(api.apiKeys.listByCompany, companyId ? { companyId } : "skip");
  const createKey = useMutation(api.apiKeys.create);
  const revokeKey = useMutation(api.apiKeys.revoke);

  const [label, setLabel] = useState("");
  const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);

  if (!keys) {
    return <div className="p-4 lg:p-6"><Skeleton className="h-96" /></div>;
  }

  const handleCreate = async () => {
    if (!companyId || !label.trim()) return;

    const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const plaintext = `arc_live_${secret}`;

    const data = new TextEncoder().encode(plaintext);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const keyHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    await createKey({
      companyId,
      keyHash,
      keyPrefix: plaintext.slice(0, 16) + "...",
      label: label.trim(),
    });

    setNewKeyPlaintext(plaintext);
    setLabel("");
    toast.success("API key created");
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-4 mt-4">
          {/* Create key */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Generate API Key</CardTitle>
              <CardDescription>
                Create a key to authenticate API requests from your application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label className="text-xs">Label</Label>
                  <Input
                    placeholder="e.g. Production, Staging, POS Terminal"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </div>
                <Button onClick={() => void handleCreate()} disabled={!label.trim()}>
                  Generate Key
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Show new key */}
          {newKeyPlaintext && (
            <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950">
              <CardContent className="pt-6">
                <p className="mb-2 text-sm font-medium">Copy this key now — it won't be shown again.</p>
                <code className="block break-all rounded bg-white px-3 py-2 font-mono text-xs dark:bg-black">
                  {newKeyPlaintext}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    navigator.clipboard.writeText(newKeyPlaintext);
                    toast.success("Copied to clipboard");
                  }}
                >
                  Copy to clipboard
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Key list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Active Keys</CardTitle>
            </CardHeader>
            <CardContent>
              {keys.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No API keys yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keys.map((k) => (
                      <TableRow key={k._id}>
                        <TableCell className="font-medium">{k.label}</TableCell>
                        <TableCell className="font-mono text-xs">{k.keyPrefix}</TableCell>
                        <TableCell>
                          <Badge variant={k.isActive ? "default" : "destructive"}>
                            {k.isActive ? "Active" : "Revoked"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                        </TableCell>
                        <TableCell>
                          {k.isActive && (
                            <Button variant="outline" size="sm" onClick={() => { void revokeKey({ id: k._id }); toast.success("Key revoked"); }}>
                              Revoke
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Arc Counting API</CardTitle>
              <CardDescription>
                Create payment requests, list transactions, and check balances programmatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Base URL */}
              <div>
                <h3 className="text-sm font-medium mb-1">Base URL</h3>
                <code className="block rounded bg-muted px-3 py-2 font-mono text-xs">
                  {SITE_URL}/api/v1
                </code>
              </div>

              {/* Auth */}
              <div>
                <h3 className="text-sm font-medium mb-1">Authentication</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  All requests require an <code className="text-xs bg-muted px-1 rounded">X-Api-Key</code> header with your API key.
                </p>
              </div>

              {/* Create payment */}
              <div>
                <h3 className="text-sm font-medium mb-1">Create Payment</h3>
                <code className="block rounded bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                  POST /api/v1/payments
                </code>
                <pre className="mt-2 rounded bg-muted p-3 font-mono text-xs leading-relaxed overflow-x-auto">
{`curl -X POST ${SITE_URL}/api/v1/payments \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: arc_live_YOUR_KEY" \\
  -d '{
    "amount": 5.00,
    "currency": "USD",
    "description": "Order #123",
    "mode": "invoice"
  }'`}
                </pre>
                <p className="mt-2 text-xs text-muted-foreground">
                  <strong>Response (201):</strong>{" "}
                  <code className="bg-muted px-1 rounded">
                    {"{ paymentId, amount, currency, mode, status }"}
                  </code>
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  <p><strong>mode</strong>: <code className="bg-muted px-1 rounded">invoice</code> | <code className="bg-muted px-1 rounded">usage</code> | <code className="bg-muted px-1 rounded">one-time</code> | <code className="bg-muted px-1 rounded">checkout</code></p>
                  <p><strong>currency</strong>: <code className="bg-muted px-1 rounded">USD</code> | <code className="bg-muted px-1 rounded">EUR</code></p>
                </div>
              </div>

              {/* List payments */}
              <div>
                <h3 className="text-sm font-medium mb-1">List Payments</h3>
                <code className="block rounded bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                  GET /api/v1/payments
                </code>
                <pre className="mt-2 rounded bg-muted p-3 font-mono text-xs leading-relaxed overflow-x-auto">
{`curl ${SITE_URL}/api/v1/payments \\
  -H "X-Api-Key: arc_live_YOUR_KEY"

# Filter by status:
curl "${SITE_URL}/api/v1/payments?status=paid" \\
  -H "X-Api-Key: arc_live_YOUR_KEY"`}
                </pre>
                <p className="mt-2 text-xs text-muted-foreground">
                  <strong>Response:</strong>{" "}
                  <code className="bg-muted px-1 rounded">{"{ data: Payment[] }"}</code>
                </p>
              </div>

              {/* Balance */}
              <div>
                <h3 className="text-sm font-medium mb-1">Get Balance</h3>
                <code className="block rounded bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                  GET /api/v1/balance
                </code>
                <pre className="mt-2 rounded bg-muted p-3 font-mono text-xs leading-relaxed overflow-x-auto">
{`curl ${SITE_URL}/api/v1/balance \\
  -H "X-Api-Key: arc_live_YOUR_KEY"`}
                </pre>
                <p className="mt-2 text-xs text-muted-foreground">
                  <strong>Response:</strong>{" "}
                  <code className="bg-muted px-1 rounded">{"{ availableCents, totalCreditedCents, totalDebitedCents }"}</code>
                </p>
              </div>

              {/* Errors */}
              <div>
                <h3 className="text-sm font-medium mb-1">Error Responses</h3>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><code className="bg-muted px-1 rounded">401</code> — Missing or invalid API key</p>
                  <p><code className="bg-muted px-1 rounded">400</code> — Invalid request body</p>
                  <p><code className="bg-muted px-1 rounded">500</code> — Internal server error</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function DeveloperPage() {
  return (
    <>
      <PageHeader
        title="Developer"
        description="API keys, documentation, and integration guide"
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <DeveloperContent />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
