"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCompany } from "@/hooks/use-company";
import { CreateCompanyDialog } from "@/components/create-company-dialog";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Add01Icon,
  Analytics01Icon,
  ArrowDown01Icon,
  CommandIcon,
  DashboardSquare01Icon,
  Database01Icon,
  HelpCircleIcon,
  Menu01Icon,
  SearchIcon,
  Settings05Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const navItems = [
  {
    title: "Overview",
    url: "/dashboard",
    icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />,
  },
  {
    title: "Employees",
    url: "/dashboard/employees",
    icon: <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />,
  },
  {
    title: "Customers",
    url: "/dashboard/customers",
    icon: <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />,
  },
  {
    title: "Products & SDK",
    url: "/dashboard/products",
    icon: <HugeiconsIcon icon={Database01Icon} strokeWidth={2} />,
  },
  {
    title: "Treasury",
    url: "/dashboard/treasury",
    icon: <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2} />,
  },
];

const secondaryItems = [
  {
    title: "Settings",
    url: "/dashboard/settings",
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
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { company, companies, switchCompany } = useCompany();
  const [showCreateCompany, setShowCreateCompany] = React.useState(false);

  const navWithActive = navItems.map((item) => ({
    ...item,
    isActive:
      item.url === "/dashboard"
        ? pathname === "/dashboard"
        : pathname.startsWith(item.url),
  }));

  return (
    <>
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {companies.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="data-[slot=sidebar-menu-button]:h-auto data-[slot=sidebar-menu-button]:p-2">
                    <HugeiconsIcon
                      icon={CommandIcon}
                      strokeWidth={2}
                      className="size-5!"
                    />
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-base font-semibold">
                        {company?.name ?? "Arc Counting"}
                      </span>
                      <span className="truncate text-xs text-sidebar-foreground/70">
                        {company?.slug ?? "Select workspace"}
                      </span>
                    </div>
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      strokeWidth={2}
                      className="ml-auto size-4"
                    />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
                  align="start"
                >
                  <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {companies.map((c) => (
                    <DropdownMenuItem
                      key={c._id}
                      onSelect={() => switchCompany(c._id)}
                    >
                      <HugeiconsIcon
                        icon={CommandIcon}
                        strokeWidth={2}
                        className="mr-2 size-4"
                      />
                      <div className="grid flex-1 text-left leading-tight">
                        <span className="text-sm font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.slug}
                        </span>
                      </div>
                      {c._id === company?._id && (
                        <span className="text-xs text-muted-foreground">Active</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setShowCreateCompany(true)}>
                    <HugeiconsIcon
                      icon={Add01Icon}
                      strokeWidth={2}
                      className="mr-2 size-4"
                    />
                    <span className="text-sm font-medium">New workspace</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
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
                      {company?.name ?? "Arc Counting"}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/70">
                      {company?.slug ?? "Arc testnet operator desk"}
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navWithActive} />
        <NavSecondary items={secondaryItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
    <CreateCompanyDialog
      open={showCreateCompany}
      onOpenChange={setShowCreateCompany}
    />
  </>
  );
}
