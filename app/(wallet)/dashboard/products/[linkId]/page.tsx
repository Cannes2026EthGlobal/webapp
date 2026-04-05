"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CompanyGuard } from "@/components/company-guard";
import { PageHeader } from "@/components/page-header";

export default function CustomizeCheckoutPage() {
  const { linkId } = useParams<{ linkId: string }>();
  const router = useRouter();
  const link = useQuery(api.checkoutLinks.getById, { id: linkId as Id<"checkoutLinks"> });
  const updateLink = useMutation(api.checkoutLinks.update);

  const [recipientAddress, setRecipientAddress] = useState("");
  const [heading, setHeading] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [thankYouMessage, setThankYouMessage] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#22c55e");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [textColor, setTextColor] = useState("#1a1a1a");
  const [effect, setEffect] = useState<"none" | "confetti" | "fireworks" | "snow" | "bubbles">("confetti");
  const [referralName, setReferralName] = useState("");
  const [referralWallet, setReferralWallet] = useState("");
  const [referralPercentage, setReferralPercentage] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (link && !loaded) {
      setLoaded(true);
      setRecipientAddress(link.recipientAddress ?? "");
      setHeading(link.customization?.heading ?? "");
      setButtonText(link.customization?.buttonText ?? "");
      setThankYouMessage(link.customization?.thankYouMessage ?? "");
      setPrimaryColor(link.customization?.primaryColor ?? "#22c55e");
      setBackgroundColor(link.customization?.backgroundColor ?? "#ffffff");
      setTextColor(link.customization?.textColor ?? "#1a1a1a");
      setEffect(link.customization?.effect ?? "confetti");
      setReferralName(link.referralName ?? "");
      setReferralWallet(link.referralWalletAddress ?? "");
      setReferralPercentage(link.referralPercentage ? String(link.referralPercentage) : "");
    }
  }, [link, loaded]);

  if (!link) {
    return (
      <>
        <PageHeader title="Customize Checkout" />
        <div className="p-6"><Skeleton className="h-96" /></div>
      </>
    );
  }

  const handleSave = async () => {
    await updateLink({
      id: linkId as Id<"checkoutLinks">,
      recipientAddress: recipientAddress || undefined,
      referralName: referralName || undefined,
      referralWalletAddress: referralWallet || undefined,
      referralPercentage: referralPercentage ? parseFloat(referralPercentage) : undefined,
      customization: {
        heading: heading || undefined,
        buttonText: buttonText || undefined,
        thankYouMessage: thankYouMessage || undefined,
        primaryColor,
        backgroundColor,
        textColor,
        effect,
      },
    });
    toast.success("Checkout link customized");
  };

  const previewHeading = heading || link.productName;
  const previewButton = buttonText || "Pay with WalletConnect";
  const previewThankYou = thankYouMessage || "Payment successful!";
  const checkoutUrl = typeof window !== "undefined" ? `${window.location.origin}/checkout/${link.slug}` : "";

  return (
    <>
      <PageHeader
        title="Customize Checkout"
        description={link.productName}
        action={{ label: "Back to Products", onClick: () => router.push("/dashboard/products") }}
      />
      <CompanyGuard>
        <div className="grid gap-6 p-6 lg:grid-cols-2">
          {/* Form */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Appearance</CardTitle>
                <CardDescription>Customize how your checkout page looks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Heading</Label>
                  <Input placeholder={link.productName} value={heading} onChange={(e) => setHeading(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Button text</Label>
                  <Input placeholder="Pay with WalletConnect" value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Thank you message</Label>
                  <Input placeholder="Payment successful!" value={thankYouMessage} onChange={(e) => setThankYouMessage(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label className="text-xs">Primary color</Label>
                    <div className="flex gap-2">
                      <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border" />
                      <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="font-mono text-xs" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">Background</Label>
                    <div className="flex gap-2">
                      <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border" />
                      <Input value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="font-mono text-xs" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">Text color</Label>
                    <div className="flex gap-2">
                      <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border" />
                      <Input value={textColor} onChange={(e) => setTextColor(e.target.value)} className="font-mono text-xs" />
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Celebration effect</Label>
                  <Select value={effect} onValueChange={(v) => setEffect(v as typeof effect)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="confetti">Confetti</SelectItem>
                      <SelectItem value="fireworks">Fireworks</SelectItem>
                      <SelectItem value="snow">Snow</SelectItem>
                      <SelectItem value="bubbles">Bubbles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Settlement</CardTitle>
                <CardDescription>Where funds go after payment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  <Label>Custom recipient address</Label>
                  <Input placeholder="0x... (leave empty to use company default)" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Override the default settlement address for this checkout link</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Referral Commission</CardTitle>
                <CardDescription>Pay a percentage of each sale to a referrer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2">
                  <Label>Referrer name</Label>
                  <Input placeholder="e.g. @LunaCryptoQueen" value={referralName} onChange={(e) => setReferralName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Commission (%)</Label>
                    <Input type="number" min="0" max="100" step="0.1" placeholder="e.g. 10" value={referralPercentage} onChange={(e) => setReferralPercentage(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Referrer wallet</Label>
                    <Input placeholder="0x..." value={referralWallet} onChange={(e) => setReferralWallet(e.target.value)} />
                  </div>
                </div>
                {referralName && referralPercentage && (
                  <p className="text-xs text-muted-foreground">
                    {referralName} will earn {referralPercentage}% commission on every sale through this link. A draft payment will be created automatically for each transaction.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button onClick={() => void handleSave()}>Save customization</Button>
              <Button variant="outline" onClick={() => router.push("/dashboard/products")}>Cancel</Button>
            </div>

            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground mb-1">Checkout URL</p>
              <code className="text-xs font-mono break-all">{checkoutUrl}</code>
            </div>
          </div>

          {/* Live Preview */}
          <div className="sticky top-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="rounded-lg p-6 min-h-[400px] flex flex-col items-center justify-center gap-4 text-center"
                  style={{ backgroundColor, color: textColor }}
                >
                  <h2 className="text-2xl font-semibold">{previewHeading}</h2>
                  <p className="text-sm opacity-70">
                    Complete your payment securely via WalletConnect Pay
                  </p>
                  <div className="rounded-lg border p-4 w-full max-w-xs" style={{ borderColor: primaryColor + "40" }}>
                    <p className="text-sm font-medium">1 x {link.productName}</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: primaryColor }}>$0.00</p>
                  </div>
                  <button
                    className="rounded-lg px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {previewButton}
                  </button>
                  <div className="mt-4 rounded-lg border border-dashed p-3 w-full max-w-xs opacity-50" style={{ borderColor: textColor + "30" }}>
                    <Badge variant="outline" className="mb-1">{effect === "none" ? "No effect" : effect}</Badge>
                    <p className="text-xs">{previewThankYou}</p>
                  </div>
                  <p className="text-xs opacity-40 mt-2">Powered by Arc Counting</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </CompanyGuard>
    </>
  );
}
