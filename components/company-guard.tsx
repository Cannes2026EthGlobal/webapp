"use client";

import { useCompany } from "@/hooks/use-company";
import { Skeleton } from "@/components/ui/skeleton";

export function CompanyGuard({ children }: { children: React.ReactNode }) {
  const { company, isLoading } = useCompany();

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-muted-foreground">
          No workspace found. Please refresh or reconnect your wallet.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
