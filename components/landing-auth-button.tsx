"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Building01Icon, User02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";

export function LandingAuthButton() {
  const { open } = useAppKit();
  const { isConnected, status, address } = useAppKitAccount();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Smart role detection
  const user = useQuery(
    api.users.getByWallet,
    isConnected && address ? { walletAddress: address } : "skip"
  );
  const companies = useQuery(
    api.companies.getByUserId,
    user?._id ? { userId: user._id } : "skip"
  );
  const employeeRecords = useQuery(
    api.employees.listByWalletAddress,
    isConnected && address ? { walletAddress: address } : "skip"
  );

  const hasCompanies = (companies?.length ?? 0) > 0;
  const hasEmployeeRecords = (employeeRecords?.length ?? 0) > 0;

  const isResolvingSession = !isHydrated || status === "reconnecting";

  if (isResolvingSession) {
    return (
      <Button size="lg" disabled aria-busy="true">
        Checking session...
      </Button>
    );
  }

  if (isConnected) {
    const dashboardVariant =
      hasEmployeeRecords && !hasCompanies ? "outline" : "default";
    const portalVariant =
      hasCompanies && !hasEmployeeRecords ? "outline" : "default";

    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" variant={dashboardVariant}>
          <Link href="/dashboard">
            <HugeiconsIcon icon={Building01Icon} size={16} strokeWidth={2} />
            Company Dashboard
          </Link>
        </Button>
        <Button asChild size="lg" variant={portalVariant}>
          <Link href="/employee-portal">
            <HugeiconsIcon icon={User02Icon} size={16} strokeWidth={2} />
            Employee Portal
          </Link>
        </Button>
      </div>
    );
  }

  const isBusy = status === "connecting";

  return (
    <Button onClick={() => open()} size="lg" disabled={isBusy}>
      {isBusy ? "Connecting..." : "Login"}
    </Button>
  );
}
