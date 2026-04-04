"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { formatCents, formatDate } from "@/lib/format";
import { usePayrollBalance, usePayrollDeposit, usePayrollPay } from "@/hooks/use-payroll-contract";
import { useCctpBridge } from "@/hooks/use-cctp-bridge";
import { centsToWei } from "@/lib/contracts";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { CompanyGuard } from "@/components/company-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const balance = useQuery(
    api.balances.getForCompany,
    companyId ? { companyId, currency: "USD" } : "skip"
  );
  const entries = useQuery(
    api.balances.getEntriesForCompany,
    companyId ? { companyId } : "skip"
  );

  if (!balance || !entries) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Available balance</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatCents(balance.availableCents)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Net of all credits and debits in USDC
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total credited</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCents(balance.totalCreditedCents)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Inbound collections from all sources
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total debited</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCents(balance.totalDebitedCents)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Payroll and outbound settlements
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ledger entries</CardTitle>
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
                        {formatDate(entry._creationTime)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PayrollContractCard />
      <CctpBridgeCard />
    </div>
  );
}

function PayrollContractCard() {
  const { balanceCents, isLoading, refetch } = usePayrollBalance();
  const { deposit, isPending: isDepositing, isSuccess: depositSuccess } = usePayrollDeposit();
  const { pay, isPending: isPaying, isSuccess: paySuccess } = usePayrollPay();
  const [depositAmount, setDepositAmount] = useState("");
  const [payAddress, setPayAddress] = useState("");
  const [payAmount, setPayAmount] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll Contract (On-Chain)</CardTitle>
        <CardDescription>
          Native USDC balance on Arc — {isLoading ? "..." : formatCents(balanceCents)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Amount (USD)"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
          <Button
            onClick={() => {
              const cents = Math.round(parseFloat(depositAmount) * 100);
              deposit(cents);
              toast.success("Deposit transaction submitted");
            }}
            disabled={isDepositing || !depositAmount}
          >
            {isDepositing ? "Depositing..." : "Deposit"}
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Recipient 0x..."
            value={payAddress}
            onChange={(e) => setPayAddress(e.target.value)}
            className="flex-1"
          />
          <Input
            type="number"
            placeholder="Amount (USD)"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />
          <Button
            onClick={() => {
              const cents = Math.round(parseFloat(payAmount) * 100);
              pay(payAddress as `0x${string}`, cents);
              toast.success("Pay transaction submitted");
            }}
            disabled={isPaying || !payAddress || !payAmount}
          >
            {isPaying ? "Paying..." : "Pay"}
          </Button>
        </div>
      </CardContent>
    </Card>
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
            placeholder="Recipient 0x..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="flex-1"
          />
          <Input
            type="number"
            placeholder="USDC amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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
            <Button variant="outline" size="sm" onClick={reset}>
              Reset
            </Button>
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
