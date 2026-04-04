"use client";

import * as React from "react";
import Link from "next/link";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Analytics01Icon,
  ChartHistogramIcon,
  CommandIcon,
  DashboardSquare01Icon,
  Database01Icon,
  File01Icon,
  Folder01Icon,
  HelpCircleIcon,
  Menu01Icon,
  SearchIcon,
  Settings05Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const data = {
  navMain: [
    {
      title: "Overview",
      url: "/dashboard",
      isActive: true,
      icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />,
    },
    {
      title: "Employees",
      url: "#",
      icon: <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />,
    },
    {
      title: "Customers",
      url: "#",
      icon: <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />,
    },
    {
      title: "Employee Payments",
      url: "#",
      icon: <HugeiconsIcon icon={ChartHistogramIcon} strokeWidth={2} />,
    },
    {
      title: "Customer Payments",
      url: "#",
      icon: <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />,
    },
    {
      title: "Products & SDK",
      url: "#",
      icon: <HugeiconsIcon icon={Database01Icon} strokeWidth={2} />,
    },
    {
      title: "Treasury",
      url: "#",
      icon: <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2} />,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: <HugeiconsIcon icon={Settings05Icon} strokeWidth={2} />,
    },
    {
      title: "Search",
      url: "#",
      icon: <HugeiconsIcon icon={SearchIcon} strokeWidth={2} />,
    },
    {
      title: "Support",
      url: "#",
      icon: <HugeiconsIcon icon={HelpCircleIcon} strokeWidth={2} />,
    },
  ],
  documents: [
    {
      name: "Settlement ledger",
      url: "#",
      icon: <HugeiconsIcon icon={Database01Icon} strokeWidth={2} />,
    },
    {
      name: "Privacy alerts",
      url: "#",
      icon: <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2} />,
    },
    {
      name: "Usage logs",
      url: "#",
      icon: <HugeiconsIcon icon={File01Icon} strokeWidth={2} />,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:h-auto data-[slot=sidebar-menu-button]:p-2"
            >
              <Link href="/dashboard">
                <HugeiconsIcon
                  icon={CommandIcon}
                  strokeWidth={2}
                  className="size-5!"
                />
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-base font-semibold">
                    Arc Counting
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    Arc testnet operator desk
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
