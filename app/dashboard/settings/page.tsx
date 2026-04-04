"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";

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
import { Skeleton } from "@/components/ui/skeleton";

function SettingsContent() {
  const { company, companyId, walletAddress } = useCompany();
  const removeCompany = useMutation(api.companies.remove);

  if (!company) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>
            Company details and configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <p className="text-sm font-medium">Owner wallet</p>
              <p className="text-sm text-muted-foreground font-mono">
                {company.ownerWallet}
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
        </CardContent>
      </Card>



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
        </CardContent>
      </Card>

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
