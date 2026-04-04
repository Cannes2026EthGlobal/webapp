"use client";

import type { CSSProperties } from "react";
import { useBusinessProfile } from "@/hooks/use-business-profile";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { hasProfile, isLoading, isConnected, walletAddress } =
    useBusinessProfile();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  // No business profile — show wizard without sidebar
  if (!hasProfile && isConnected && walletAddress) {
    return (
      <OnboardingWizard
        walletAddress={walletAddress}
        onComplete={() => {
          // Convex query re-fires reactively
        }}
      />
    );
  }

  // Has profile — render full dashboard shell with sidebar
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
