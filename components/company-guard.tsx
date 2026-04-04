"use client";

import { useCompany } from "@/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function CompanyGuard({ children }: { children: React.ReactNode }) {
  const { company, isLoading, seed, isConnected } = useCompany();

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
        <div className="text-center">
          <h2 className="text-lg font-semibold">Welcome to Arc Counting</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isConnected
              ? "No workspace found for this wallet. Create a demo workspace to get started."
              : "Connect your wallet to access the operator desk."}
          </p>
        </div>
        {isConnected && (
          <Button onClick={() => void seed()} size="lg">
            Create demo workspace
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
