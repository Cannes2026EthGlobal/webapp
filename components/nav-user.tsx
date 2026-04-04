"use client";

import {
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
} from "@reown/appkit/react";
import { useDisconnect } from "@reown/appkit-controllers/react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  CreditCardIcon,
  Logout01Icon,
  MoreVerticalCircle01Icon,
  Notification03Icon,
  UserCircle02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

function formatAddress(address?: string) {
  if (!address) {
    return "Connect wallet";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function NavUser() {
  const { isMobile } = useSidebar();
  const { open } = useAppKit();
  const { address, isConnected, status } = useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();
  const { disconnect } = useDisconnect();

  const isBusy = status === "connecting" || status === "reconnecting";
  const walletLabel = formatAddress(address);
  const networkLabel = caipNetwork?.name ?? "Arc Testnet";

  if (!isConnected) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" onClick={() => open()} disabled={isBusy}>
            <Avatar className="size-8 rounded-lg border border-sidebar-border">
              <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                AR
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">
                {isBusy ? "Checking wallet..." : "Connect wallet"}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                Reown AppKit authentication
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg border border-sidebar-border">
                <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                  AR
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{walletLabel}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {networkLabel} · Pseudonymous
                </span>
              </div>
              <HugeiconsIcon
                icon={MoreVerticalCircle01Icon}
                strokeWidth={2}
                className="ml-auto"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg border border-border">
                  <AvatarFallback className="rounded-lg bg-muted text-foreground">
                    AR
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{address}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {networkLabel} workspace session
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  open();
                }}
              >
                <HugeiconsIcon icon={UserCircle02Icon} strokeWidth={2} />
                Manage wallet
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  open({ view: "Networks" });
                }}
              >
                <HugeiconsIcon icon={Notification03Icon} strokeWidth={2} />
                Open network modal
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <HugeiconsIcon icon={CreditCardIcon} strokeWidth={2} />
                Privacy: Pseudonymous
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void disconnect();
              }}
            >
              <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
