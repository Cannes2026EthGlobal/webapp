import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { DashboardAuthGuard } from "@/components/dashboard-auth-guard";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const AUTH_COOKIE = "arc-counting-auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();

  if (cookieStore.get(AUTH_COOKIE)?.value !== "1") {
    redirect("/");
  }

  return (
    <DashboardAuthGuard>
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
    </DashboardAuthGuard>
  );
}
