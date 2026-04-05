"use client";

import { useState, useEffect } from "react";
import { useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { toast } from "sonner";

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

export function DepositDialog({
  open,
  onOpenChange,
  contractAddress,
  onSuccess,
  currency = "USDC",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractAddress: `0x${string}` | undefined;
  onSuccess?: () => void;
  currency?: "USDC" | "EURC";
}) {
  const [amount, setAmount] = useState("");
  const { sendTransaction, data: txHash, isPending, reset } = useSendTransaction();
  const { data: receipt, isLoading: isWaiting } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (receipt && !isWaiting && txHash) {
      toast.success("Deposit confirmed");
      onSuccess?.();
      onOpenChange(false);
    }
  }, [receipt, isWaiting, txHash, onSuccess, onOpenChange]);

  useEffect(() => {
    if (!open) {
      setAmount("");
      reset();
    }
  }, [open, reset]);

  const handleDeposit = () => {
    if (!contractAddress || !amount) return;
    sendTransaction(
      {
        to: contractAddress,
        value: parseEther(amount),
      },
      {
        onError: (err) => {
          toast.error(err.message.slice(0, 100));
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deposit {currency} to payroll contract</DialogTitle>
          <DialogDescription>
            Send {currency} to fund your payroll contract on Arc testnet.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Amount ({currency})</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="5.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          {txHash && (
            <div className="flex items-center gap-2">
              <div className="size-2 animate-pulse rounded-full bg-yellow-500" />
              <span className="text-sm">Waiting for confirmation...</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDeposit}
            disabled={isPending || !amount || parseFloat(amount) <= 0}
          >
            {isPending ? "Confirm in wallet..." : "Deposit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
