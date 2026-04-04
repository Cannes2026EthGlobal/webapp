"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatCents } from "@/lib/format";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const checkout = useQuery(api.checkoutLinks.getBySlug, { slug });
  const initiateCheckout = useMutation(api.checkout.initiateCheckout);
  const attachWcPay = useMutation(api.checkout.attachWcPay);

  const [quantity, setQuantity] = useState(1);
  const [walletAddress, setWalletAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  if (checkout === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Skeleton className="h-96 w-full max-w-md" />
      </div>
    );
  }

  if (checkout === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Link not found</CardTitle>
            <CardDescription>
              This checkout link is inactive or does not exist.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { product, companyName } = checkout;
  const totalCents = product.unitPriceCents * quantity;

  const handlePay = async () => {
    setStatus("processing");
    setErrorMsg("");
    try {
      // 1. Create payment record in Convex
      const result = await initiateCheckout({
        slug,
        quantity,
        buyerWallet: walletAddress || undefined,
      });

      // 2. Create WC Pay session via API route
      const res = await fetch("/api/pay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceId: result.referenceId,
          amountCents: result.amountCents,
          currency: result.currency,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create payment session");
      }

      const wcPay = await res.json() as {
        paymentId: string;
        gatewayUrl: string;
        expiresAt: number | null;
      };

      // 3. Attach WC Pay IDs to the payment record
      await attachWcPay({
        paymentId: result.paymentId,
        wcPayPaymentId: wcPay.paymentId,
        wcPayGatewayUrl: wcPay.gatewayUrl,
      });

      setGatewayUrl(wcPay.gatewayUrl);
      setStatus("success");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Payment failed");
      setStatus("error");
    }
  };

  if (status === "success" && gatewayUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Complete your payment</CardTitle>
            <CardDescription>
              You are paying {formatCents(totalCents)} for {product.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click below to open WalletConnect Pay and complete your payment securely.
            </p>
            <Button className="w-full" asChild>
              <a href={gatewayUrl} target="_blank" rel="noopener noreferrer">
                Pay with WalletConnect
              </a>
            </Button>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              Powered by Arc Counting &middot; {companyName}
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>{companyName}</CardDescription>
              <CardTitle className="text-2xl">{product.name}</CardTitle>
            </div>
            <Badge variant="outline">{product.settlementAsset}</Badge>
          </div>
          {product.description && (
            <p className="text-sm text-muted-foreground pt-2">
              {product.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Unit price</p>
              <p className="text-xs text-muted-foreground">
                per {product.billingUnit}
              </p>
            </div>
            <p className="text-xl font-semibold tabular-nums">
              {formatCents(product.unitPriceCents)}
            </p>
          </div>

          {product.pricingModel === "per-unit" && (
            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="wallet">Wallet address (optional)</Label>
            <Input
              id="wallet"
              placeholder="0x..."
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Providing your wallet registers you as a customer automatically.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted p-4">
            <p className="font-medium">Total</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCents(totalCents)}
            </p>
          </div>

          {errorMsg && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Button
            className="w-full"
            size="lg"
            onClick={() => void handlePay()}
            disabled={status === "processing"}
          >
            {status === "processing" ? "Creating payment..." : "Pay with WalletConnect"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Powered by Arc Counting &middot; Settlement on Arc
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
