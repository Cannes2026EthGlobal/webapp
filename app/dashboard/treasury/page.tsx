"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useSendTransaction } from "wagmi";
import { parseEther } from "viem";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { useBusinessProfile } from "@/hooks/use-business-profile";
import { usePayrollBalance } from "@/hooks/use-payroll-contract";
import { useCctpBridge } from "@/hooks/use-cctp-bridge";
import { centsToWei } from "@/lib/contracts";
import { formatCents, formatDate } from "@/lib/format";
import { PAYROLL_ABI } from "@/lib/payroll-contract";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { CompanyGuard } from "@/components/company-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

function TreasuryContent() {
  const { companyId } = useCompany();
  const { payrollContractAddress } = useBusinessProfile();
  const {
    balanceUsdc: onChainBalance,
    isLoading: onChainLoading,
    refetch: refetchOnChain,
  } = usePayrollBalance(payrollContractAddress);

  const [showDeposit, setShowDeposit] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const { sendTransactionAsync } = useSendTransaction();
  const creditBalance = useMutation(api.balances.credit);

  const handleDeposit = async (amount: string) => {
    if (!payrollContractAddress || !companyId) return;
    const usdcFloat = parseFloat(amount);
    if (usdcFloat <= 0) return;
    // Store in cents, minimum 1 cent for sub-cent amounts
    const cents = Math.max(1, Math.round(usdcFloat * 100));

    setIsDepositing(true);
    try {
      const txHash = await sendTransactionAsync({
        to: payrollContractAddress,
        value: parseEther(amount),
      });

      toast.success("Transaction submitted, recording in ledger...");

      await creditBalance({
        companyId,
        amountCents: cents,
        currency: "USD" as const,
        reason: `Payroll contract deposit — ${amount} USDC`,
        relatedPaymentId: txHash,
      });

      toast.success("Deposit confirmed and recorded in ledger");
      void refetchOnChain();
      setShowDeposit(false);
    } catch (err: any) {
      toast.error(err?.message?.slice(0, 100) ?? "Deposit failed");
    } finally {
      setIsDepositing(false);
    }
  };

  const entries = useQuery(
    api.balances.getEntriesForCompany,
    companyId ? { companyId } : "skip"
  );
  const stats = useQuery(
    api.overview.stats,
    companyId ? { companyId } : "skip"
  );

  if (!entries || !stats) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* ─── On-Chain Contract ─── */}
      {payrollContractAddress && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>Payroll Contract</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {onChainLoading
                    ? "..."
                    : onChainBalance !== undefined
                      ? `${onChainBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} USDC`
                      : "N/A"}
                </CardTitle>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void refetchOnChain()}
                >
                  Refresh
                </Button>
                <Button size="sm" onClick={() => setShowDeposit(true)}>
                  Deposit
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}


      {/* ─── Obligations & Receivables ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment Obligations</CardTitle>
            <CardDescription>
              Upcoming outbound commitments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Payroll due</p>
                <p className="text-xs text-muted-foreground">
                  {stats.payrollDueCount} payment{stats.payrollDueCount !== 1 ? "s" : ""} in draft or approved
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums">
                {formatCents(stats.payrollDueCents)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active employees</p>
                <p className="text-xs text-muted-foreground">
                  Current active headcount
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums">
                {stats.activeEmployees}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inbound Collections</CardTitle>
            <CardDescription>
              Pending and expected revenue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Pending receivables</p>
                <p className="text-xs text-muted-foreground">
                  {stats.receivablesCount} payment{stats.receivablesCount !== 1 ? "s" : ""} awaiting settlement
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums">
                {formatCents(stats.receivablesCents)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Revenue today</p>
                <p className="text-xs text-muted-foreground">
                  Customer payments settled today
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums">
                {formatCents(stats.usageRevenueTodayCents)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Ledger Entries ─── */}
      <Card>
        <CardHeader>
          <CardTitle>Ledger Entries</CardTitle>
          <CardDescription>
            Audit trail of all balance movements
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No ledger entries yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry._id}>
                      <TableCell>
                        <Badge
                          variant={
                            entry.type === "credit" ? "default" : "secondary"
                          }
                          className="capitalize"
                        >
                          {entry.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums font-medium">
                        {entry.type === "credit" ? "+" : "-"}
                        {formatCents(entry.amountCents)}
                      </TableCell>
                      <TableCell>{entry.currency}</TableCell>
                      <TableCell className="max-w-64 truncate text-muted-foreground">
                        {entry.reason}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(entry.occurredAt ?? entry._creationTime)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── CCTP Bridge ─── */}
      <CctpBridgeCard />

      <DepositDialog
        open={showDeposit}
        onOpenChange={setShowDeposit}
        isDepositing={isDepositing}
        onDeposit={handleDeposit}
      />
    </div>
  );
}

function DepositDialog({
  open,
  onOpenChange,
  isDepositing,
  onDeposit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDepositing: boolean;
  onDeposit: (amount: string) => void;
}) {
  const [amount, setAmount] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deposit USDC to payroll contract</DialogTitle>
          <DialogDescription>
            Send native USDC to fund your payroll contract on Arc testnet.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Amount (USDC)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="5.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          {isDepositing && (
            <div className="flex items-center gap-2">
              <div className="size-2 animate-pulse rounded-full bg-yellow-500" />
              <span className="text-sm">Processing deposit...</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDepositing}>
            Cancel
          </Button>
          <Button
            onClick={() => onDeposit(amount)}
            disabled={isDepositing || !amount || parseFloat(amount) <= 0}
          >
            {isDepositing ? "Depositing..." : "Deposit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CctpBridgeCard() {
  const { bridge, state, reset } = useCctpBridge();
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [destination, setDestination] = useState<"arbitrum" | "base">("arbitrum");

  return (
    <Card>
      <CardHeader>
        <CardTitle>CCTP Bridge</CardTitle>
        <CardDescription>
          Bridge USDC from Arc to {destination === "arbitrum" ? "Arbitrum" : "Base"} via Circle CCTP V2
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Select value={destination} onValueChange={(v) => setDestination(v as "arbitrum" | "base")}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="arbitrum">Arbitrum</SelectItem>
              <SelectItem value="base">Base</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="USDC amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              const wei = centsToWei(Math.round(parseFloat(amount) * 100));
              bridge(wei, recipient as `0x${string}`, destination);
            }}
            disabled={state.step !== "idle" && state.step !== "done" && state.step !== "error"}
          >
            {state.step === "idle" || state.step === "done" || state.step === "error"
              ? "Bridge USDC"
              : `${state.step}...`}
          </Button>
          {(state.step === "done" || state.step === "error") && (
            <Button variant="outline" size="sm" onClick={reset}>Reset</Button>
          )}
        </div>
        {state.step === "error" && (
          <p className="text-xs text-destructive">{state.error}</p>
        )}
        {state.step === "done" && (
          <p className="text-xs text-green-600">
            Bridge complete! Burn tx: {state.burnTxHash?.slice(0, 14)}...
          </p>
        )}
        {state.step === "attesting" && (
          <p className="text-xs text-muted-foreground">
            Waiting for Circle attestation (may take 1-2 minutes)...
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function TreasuryPage() {
  return (
    <>
      <PageHeader
        title="Treasury"
        description="Business settlement layer and balance overview"
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <TreasuryContent />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
