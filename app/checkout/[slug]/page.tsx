"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatCentsDetailed } from "@/lib/format";
import type { Id } from "@/convex/_generated/dataModel";

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

type CheckoutStatus = "idle" | "processing" | "awaiting_payment" | "polling" | "confirmed" | "failed" | "error";

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const checkout = useQuery(api.checkoutLinks.getBySlug, { slug });
  const initiateCheckout = useMutation(api.checkout.initiateCheckout);
  const attachWcPay = useMutation(api.checkout.attachWcPay);
  const confirmPayment = useMutation(api.checkout.confirmPayment);

  const [quantity, setQuantity] = useState(1);
  const [walletAddress, setWalletAddress] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null);
  const [wcPaymentId, setWcPaymentId] = useState<string | null>(null);
  const [convexPaymentId, setConvexPaymentId] = useState<Id<"customerPayments"> | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll WC Pay status after user opens the gateway
  useEffect(() => {
    if (status !== "polling" || !wcPaymentId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/pay/status?paymentId=${wcPaymentId}`);
        if (!res.ok) return;
        const data = await res.json() as {
          status: string;
          isFinal: boolean;
          buyer?: {
            wallet?: string;
            fullName?: string;
            dateOfBirth?: string;
            country?: string;
            email?: string;
          };
          txHash?: string;
        };

        if (data.status === "succeeded") {
          // Confirm the payment in Convex (credits treasury + registers customer)
          if (convexPaymentId) {
            await confirmPayment({
              paymentId: convexPaymentId,
              buyerWallet: data.buyer?.wallet ?? (walletAddress || undefined),
              txHash: data.txHash,
              buyerFullName: data.buyer?.fullName,
              buyerDateOfBirth: data.buyer?.dateOfBirth,
              buyerCountry: data.buyer?.country,
              buyerEmail: data.buyer?.email,
            });
          }
          setStatus("confirmed");
          if (pollingRef.current) clearInterval(pollingRef.current);
        } else if (data.isFinal) {
          // failed, expired, or cancelled
          setStatus("failed");
          setErrorMsg(`Payment ${data.status}`);
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch {
        // Silently retry on network errors
      }
    };

    pollingRef.current = setInterval(() => void poll(), 3000);
    // Run immediately too
    void poll();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [status, wcPaymentId, convexPaymentId, walletAddress, confirmPayment]);

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
        buyerFullName: fullName || undefined,
        buyerEmail: email || undefined,
        buyerCountry: country || undefined,
      });

      setConvexPaymentId(result.paymentId);

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
      setWcPaymentId(wcPay.paymentId);
      setStatus("awaiting_payment");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Payment failed");
      setStatus("error");
    }
  };

  // ─── Confirmed State ───
  if (status === "confirmed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Payment confirmed</CardTitle>
            <CardDescription>
              Thank you for your purchase
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-muted p-4">
              <p className="font-medium">{product.name}{quantity > 1 ? ` x${quantity}` : ""}</p>
              <p className="text-xl font-semibold tabular-nums">
                {formatCentsDetailed(totalCents)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-green-500" />
              <span className="text-sm text-muted-foreground">
                Payment settled &middot; {companyName}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Failed State ───
  if (status === "failed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Payment failed</CardTitle>
            <CardDescription>{errorMsg || "The payment could not be completed."}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => { setStatus("idle"); setErrorMsg(""); }}>
              Try again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // ─── Awaiting Payment / Polling State ───
  if ((status === "awaiting_payment" || status === "polling") && gatewayUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Complete your payment</CardTitle>
            <CardDescription>
              {formatCentsDetailed(totalCents)} for {product.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click below to open WalletConnect Pay and complete your payment. This page will update automatically once payment is confirmed.
            </p>
            <Button
              className="w-full"
              asChild
              onClick={() => setStatus("polling")}
            >
              <a href={gatewayUrl} target="_blank" rel="noopener noreferrer">
                {status === "polling" ? "Open WalletConnect Pay" : "Pay with WalletConnect"}
              </a>
            </Button>
            {status === "polling" && (
              <div className="flex items-center gap-2">
                <div className="size-2 animate-pulse rounded-full bg-yellow-500" />
                <span className="text-sm text-muted-foreground">
                  Waiting for payment confirmation...
                </span>
              </div>
            )}
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

  // ─── Initial Checkout Form ───
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
              {formatCentsDetailed(product.unitPriceCents)}
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

          <div className="space-y-3">
            <p className="text-sm font-medium">Your details <span className="text-muted-foreground font-normal">(optional)</span></p>
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="US"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wallet">Wallet address</Label>
              <Input
                id="wallet"
                placeholder="0x..."
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Your details are shared with the merchant for order fulfillment.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted p-4">
            <p className="font-medium">Total</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCentsDetailed(totalCents)}
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
