"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { useBusinessProfile } from "@/hooks/use-business-profile";
import { usePayrollBalance } from "@/hooks/use-payroll-contract";
import { formatCents, formatDate } from "@/lib/format";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { CompanyGuard } from "@/components/company-guard";
import { DepositDialog } from "@/components/deposit-dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Skeleton } from "@/components/ui/skeleton";

function TreasuryContent() {
  const { companyId } = useCompany();
  const { payrollContractAddress } = useBusinessProfile();
  const {
    balanceUsdc: onChainBalance,
    isLoading: onChainLoading,
    refetch: refetchOnChain,
  } = usePayrollBalance(payrollContractAddress);

  const usdBalance = useQuery(
    api.balances.getForCompany,
    companyId ? { companyId, currency: "USD" } : "skip"
  );
  const eurBalance = useQuery(
    api.balances.getForCompany,
    companyId ? { companyId, currency: "EUR" } : "skip"
  );

  const [showDeposit, setShowDeposit] = useState(false);
  const [depositCurrency, setDepositCurrency] = useState<"USDC" | "EURC">("USDC");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawCurrency, setWithdrawCurrency] = useState<"USD" | "EUR">("USD");

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
      {/* ─── Balances ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-tour="treasury-balance">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>USDC Balance</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {usdBalance ? formatCents(usdBalance.availableCents, "USD") : "..."}
                </CardTitle>
              </div>
              <div className="flex gap-2">
                {payrollContractAddress && (
                  <Button size="sm" onClick={() => { setDepositCurrency("USDC"); setShowDeposit(true); }}>Deposit</Button>
                )}
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { setWithdrawCurrency("USD"); setShowWithdraw(true); }}>Withdraw</Button>
              </div>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>EURC Balance</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {eurBalance ? formatCents(eurBalance.availableCents, "EUR") : "€0"}
                </CardTitle>
              </div>
              <div className="flex gap-2">
                {payrollContractAddress && (
                  <Button size="sm" onClick={() => { setDepositCurrency("EURC"); setShowDeposit(true); }}>Deposit</Button>
                )}
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { setWithdrawCurrency("EUR"); setShowWithdraw(true); }}>Withdraw</Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>


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
                {formatCents(stats.payrollDueCents, "USD")}
                {stats.payrollDueEurCents > 0 && <span className="ml-1.5 text-xs opacity-70">{formatCents(stats.payrollDueEurCents, "EUR")}</span>}
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
                {formatCents(stats.receivablesCents, "USD")}
                {stats.receivablesEurCents > 0 && <span className="ml-1.5 text-xs opacity-70">{formatCents(stats.receivablesEurCents, "EUR")}</span>}
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
                {formatCents(stats.usageRevenueTodayCents, "USD")}
                {stats.usageRevenueTodayEurCents > 0 && <span className="ml-1.5 text-xs opacity-70">{formatCents(stats.usageRevenueTodayEurCents, "EUR")}</span>}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Ledger Entries ─── */}
      <Card data-tour="ledger-entries">
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

      <DepositDialog
        open={showDeposit}
        onOpenChange={setShowDeposit}
        contractAddress={payrollContractAddress}
        currency={depositCurrency}
        companyId={companyId}
        onSuccess={() => void refetchOnChain()}
      />

      {companyId && (
        <WithdrawDialog
          open={showWithdraw}
          onOpenChange={setShowWithdraw}
          companyId={companyId}
          initialCurrency={withdrawCurrency}
        />
      )}
    </div>
  );
}

const SUPPORTED_CHAINS = [
  { value: "arc", label: "Arc" },
  { value: "arbitrum", label: "Arbitrum" },
  { value: "base", label: "Base" },
  { value: "ethereum", label: "Ethereum" },
  { value: "optimism", label: "Optimism" },
  { value: "polygon", label: "Polygon" },
  { value: "avalanche", label: "Avalanche" },
];

function WithdrawDialog({
  open,
  onOpenChange,
  companyId,
  initialCurrency = "USD",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: any;
  initialCurrency?: "USD" | "EUR";
}) {
  const debitBalance = useMutation(api.balances.debit);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "EUR">(initialCurrency);
  useEffect(() => { setCurrency(initialCurrency); }, [initialCurrency]);
  const [chain, setChain] = useState("arc");
  const [description, setDescription] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleWithdraw = async () => {
    const cents = Math.round(parseFloat(amount || "0") * 100);
    if (!recipient || cents <= 0) return;

    setIsProcessing(true);
    try {
      // Debit the treasury and record as ledger entry
      await debitBalance({
        companyId,
        amountCents: cents,
        currency,
        reason: `Withdrawal via CCTP — ${amount} ${currency === "EUR" ? "EURC" : "USDC"} to ${recipient.slice(0, 10)}... on ${chain}`,
      });

      toast.success(`Withdrawal of ${amount} ${currency === "EUR" ? "EURC" : "USDC"} to ${chain} recorded`);
      onOpenChange(false);
      setRecipient("");
      setAmount("");
      setDescription("");
    } catch (e: any) {
      toast.error(e.message ?? "Withdrawal failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw via CCTP</DialogTitle>
          <DialogDescription>
            Send USDC or EURC to any address on any CCTP-supported chain
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Chain</Label>
              <Select value={chain} onValueChange={setChain}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CHAINS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as "USD" | "EUR")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USDC</SelectItem>
                  <SelectItem value="EUR">EURC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Recipient address</Label>
            <Input placeholder="0x..." value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Amount ({currency === "EUR" ? "EURC" : "USDC"})</Label>
            <Input type="number" step="any" min="0" placeholder="100.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Description (optional)</Label>
            <Input placeholder="e.g. Vendor payment, Treasury rebalance" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>Cancel</Button>
          <Button onClick={() => void handleWithdraw()} disabled={isProcessing || !recipient || !amount}>
            {isProcessing ? "Processing..." : `Withdraw ${currency === "EUR" ? "EURC" : "USDC"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
