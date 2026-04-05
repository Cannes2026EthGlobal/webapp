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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const SETTLEMENT_NETWORKS: Record<
  string,
  { chainId: number; cctpDomain: number | undefined }
> = {
  arc: { chainId: 5042002, cctpDomain: undefined },
  ethereum: { chainId: 1, cctpDomain: 0 },
  arbitrum: { chainId: 42161, cctpDomain: 3 },
  base: { chainId: 8453, cctpDomain: 6 },
  polygon: { chainId: 137, cctpDomain: 7 },
  avalanche: { chainId: 43114, cctpDomain: 1 },
};

function SettingsContent() {
  const { company, companyId, walletAddress } = useCompany();
  const updateCompany = useMutation(api.companies.update);
  const removeCompany = useMutation(api.companies.remove);

  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [editingSettlement, setEditingSettlement] = useState(false);
  const [editingConfig, setEditingConfig] = useState(false);

  const [workspaceForm, setWorkspaceForm] = useState({
    name: "",
    industry: "",
    website: "",
    treasuryAddress: "",
  });

  const [settlementForm, setSettlementForm] = useState({
    settlementAddress: "",
    settlementNetwork: "",
  });

  const [configForm, setConfigForm] = useState({
    defaultCurrency: "USD" as "USD" | "EUR",
    webhookUrl: "",
    brandColor: "",
    supportEmail: "",
  });

  if (!company) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  const startEditWorkspace = () => {
    setWorkspaceForm({
      name: company.name ?? "",
      industry: company.industry ?? "",
      website: company.website ?? "",
      treasuryAddress: company.treasuryAddress ?? "",
    });
    setEditingWorkspace(true);
  };

  const saveWorkspace = async () => {
    if (!companyId) return;
    try {
      await updateCompany({
        id: companyId,
        name: workspaceForm.name || undefined,
        industry: workspaceForm.industry || undefined,
        website: workspaceForm.website || undefined,
        treasuryAddress: workspaceForm.treasuryAddress || undefined,
      });
      toast.success("Workspace updated");
      setEditingWorkspace(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update workspace");
    }
  };

  const startEditSettlement = () => {
    setSettlementForm({
      settlementAddress: (company as Record<string, unknown>).settlementAddress as string ?? "",
      settlementNetwork: (company as Record<string, unknown>).settlementNetwork as string ?? "",
    });
    setEditingSettlement(true);
  };

  const saveSettlement = async () => {
    if (!companyId) return;
    const network = settlementForm.settlementNetwork;
    const networkConfig = network ? SETTLEMENT_NETWORKS[network] : undefined;
    try {
      await updateCompany({
        id: companyId,
        settlementAddress: settlementForm.settlementAddress || undefined,
        settlementNetwork: network || undefined,
        settlementChainId: networkConfig?.chainId,
        cctpDomain: networkConfig?.cctpDomain,
      });
      toast.success("Settlement settings updated");
      setEditingSettlement(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update settlement");
    }
  };

  const startEditConfig = () => {
    setConfigForm({
      defaultCurrency: ((company as Record<string, unknown>).defaultCurrency as "USD" | "EUR") ?? "USD",
      webhookUrl: (company as Record<string, unknown>).webhookUrl as string ?? "",
      brandColor: (company as Record<string, unknown>).brandColor as string ?? "",
      supportEmail: (company as Record<string, unknown>).supportEmail as string ?? "",
    });
    setEditingConfig(true);
  };

  const saveConfig = async () => {
    if (!companyId) return;
    try {
      await updateCompany({
        id: companyId,
        defaultCurrency: configForm.defaultCurrency,
        webhookUrl: configForm.webhookUrl || undefined,
        brandColor: configForm.brandColor || undefined,
        supportEmail: configForm.supportEmail || undefined,
      });
      toast.success("Configuration updated");
      setEditingConfig(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update configuration");
    }
  };

  const companyData = company as Record<string, unknown>;
  const selectedNetwork = settlementForm.settlementNetwork;
  const networkConfig = selectedNetwork ? SETTLEMENT_NETWORKS[selectedNetwork] : undefined;

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* ─── Workspace ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Workspace</CardTitle>
              <CardDescription>
                Company details and configuration
              </CardDescription>
            </div>
            {!editingWorkspace && (
              <Button variant="outline" size="sm" onClick={startEditWorkspace}>
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingWorkspace ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="ws-name">Company name</Label>
                  <Input
                    id="ws-name"
                    value={workspaceForm.name}
                    onChange={(e) =>
                      setWorkspaceForm({ ...workspaceForm, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ws-industry">Industry</Label>
                  <Input
                    id="ws-industry"
                    value={workspaceForm.industry}
                    onChange={(e) =>
                      setWorkspaceForm({ ...workspaceForm, industry: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ws-website">Website</Label>
                  <Input
                    id="ws-website"
                    value={workspaceForm.website}
                    onChange={(e) =>
                      setWorkspaceForm({ ...workspaceForm, website: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ws-treasury">Treasury address</Label>
                  <Input
                    id="ws-treasury"
                    className="font-mono"
                    value={workspaceForm.treasuryAddress}
                    onChange={(e) =>
                      setWorkspaceForm({
                        ...workspaceForm,
                        treasuryAddress: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void saveWorkspace()}>
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingWorkspace(false)}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Company name</p>
                <p className="text-sm text-muted-foreground">{company.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Slug</p>
                <p className="text-sm text-muted-foreground">{company.slug}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Owner</p>
                <p className="text-sm text-muted-foreground font-mono">
                  {walletAddress ?? company.ownerId}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Industry</p>
                <p className="text-sm text-muted-foreground">
                  {company.industry ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Website</p>
                <p className="text-sm text-muted-foreground">
                  {company.website ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Treasury address</p>
                <p className="text-sm text-muted-foreground font-mono">
                  {company.treasuryAddress ?? "Not configured"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Settlement ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Settlement</CardTitle>
              <CardDescription>
                Settlement address and network configuration
              </CardDescription>
            </div>
            {!editingSettlement && (
              <Button variant="outline" size="sm" onClick={startEditSettlement}>
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingSettlement ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="settle-address">Settlement address</Label>
                  <Input
                    id="settle-address"
                    className="font-mono"
                    value={settlementForm.settlementAddress}
                    onChange={(e) =>
                      setSettlementForm({
                        ...settlementForm,
                        settlementAddress: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Settlement network</Label>
                  <Select
                    value={settlementForm.settlementNetwork}
                    onValueChange={(v) =>
                      setSettlementForm({ ...settlementForm, settlementNetwork: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="arc">Arc</SelectItem>
                      <SelectItem value="ethereum">Ethereum</SelectItem>
                      <SelectItem value="arbitrum">Arbitrum</SelectItem>
                      <SelectItem value="base">Base</SelectItem>
                      <SelectItem value="polygon">Polygon</SelectItem>
                      <SelectItem value="avalanche">Avalanche</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Chain ID</Label>
                  <Input
                    disabled
                    className="font-mono"
                    value={networkConfig?.chainId ?? "-"}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>CCTP Domain</Label>
                  <Input
                    disabled
                    className="font-mono"
                    value={networkConfig?.cctpDomain ?? "-"}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void saveSettlement()}>
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingSettlement(false)}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Settlement address</p>
                <p className="text-sm text-muted-foreground font-mono">
                  {(companyData.settlementAddress as string) ?? "Not configured"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Settlement network</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {(companyData.settlementNetwork as string) ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Chain ID</p>
                <p className="text-sm text-muted-foreground font-mono">
                  {(companyData.settlementChainId as number) ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">CCTP Domain</p>
                <p className="text-sm text-muted-foreground font-mono">
                  {(companyData.cctpDomain as number) ?? "-"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Configuration ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>
                Currency, webhook, branding, and support settings
              </CardDescription>
            </div>
            {!editingConfig && (
              <Button variant="outline" size="sm" onClick={startEditConfig}>
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingConfig ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Default currency</Label>
                  <Select
                    value={configForm.defaultCurrency}
                    onValueChange={(v) =>
                      setConfigForm({
                        ...configForm,
                        defaultCurrency: v as "USD" | "EUR",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cfg-webhook">Webhook URL</Label>
                  <Input
                    id="cfg-webhook"
                    type="url"
                    value={configForm.webhookUrl}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, webhookUrl: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cfg-brand">Brand color</Label>
                  <Input
                    id="cfg-brand"
                    placeholder="#000000"
                    value={configForm.brandColor}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, brandColor: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cfg-support">Support email</Label>
                  <Input
                    id="cfg-support"
                    type="email"
                    value={configForm.supportEmail}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, supportEmail: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void saveConfig()}>
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingConfig(false)}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Default currency</p>
                <p className="text-sm text-muted-foreground">
                  {(companyData.defaultCurrency as string) ?? "USD"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Webhook URL</p>
                <p className="text-sm text-muted-foreground break-all">
                  {(companyData.webhookUrl as string) ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Brand color</p>
                <div className="flex items-center gap-2">
                  {(companyData.brandColor as string) ? (
                    <>
                      <div
                        className="h-4 w-4 rounded border"
                        style={{ backgroundColor: companyData.brandColor as string }}
                      />
                      <p className="text-sm text-muted-foreground font-mono">
                        {companyData.brandColor as string}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">-</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Support email</p>
                <p className="text-sm text-muted-foreground">
                  {(companyData.supportEmail as string) ?? "-"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Privacy ─── */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>
            Workspace privacy state and identity configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant="secondary">Pseudonymous</Badge>
            <p className="text-sm text-muted-foreground">
              This workspace operates in pseudonymous mode. Identity verification
              and shielded transactions will be available with the Chainlink
              integration.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Integrations ─── */}
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Connected services and payment rails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">WalletConnect Pay</p>
              <p className="text-xs text-muted-foreground">
                Customer payment surface and checkout
              </p>
            </div>
            <Badge variant="outline">Not connected</Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Chainlink</p>
              <p className="text-xs text-muted-foreground">
                Payment routing, automation, and price feeds
              </p>
            </div>
            <Badge variant="outline">Not connected</Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Reown Auth</p>
              <p className="text-xs text-muted-foreground">
                Wallet-based operator authentication
              </p>
            </div>
            <Badge variant="default">Connected</Badge>
          </div>
        </CardContent>
      </Card>

      {/* ─── Tour ─── */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Tour</CardTitle>
          <CardDescription>Walk through the dashboard features</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => {
              localStorage.removeItem("arc-counting-tour-completed");
              window.location.href = "/dashboard";
            }}
          >
            Replay Tour
          </Button>
        </CardContent>
      </Card>

      {/* ─── Danger Zone ─── */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Irreversible actions for this workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => {
              if (
                companyId &&
                window.confirm(
                  "Are you sure? This will delete the workspace and all data."
                )
              ) {
                void removeCompany({ id: companyId });
              }
            }}
          >
            Delete workspace
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Workspace configuration" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <SettingsContent />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
