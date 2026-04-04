"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { formatCentsDetailed, formatDate } from "@/lib/format";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

import { PageHeader } from "@/components/page-header";
import { CompanyGuard } from "@/components/company-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

function ProductsContent({
  showCreate,
  setShowCreate,
}: {
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
}) {
  const { companyId } = useCompany();
  const products = useQuery(
    api.products.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const checkoutLinks = useQuery(
    api.checkoutLinks.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const recentPayments = useQuery(
    api.customerPayments.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const createProduct = useMutation(api.products.create);
  const removeProduct = useMutation(api.products.remove);
  const createCheckoutLink = useMutation(api.checkoutLinks.create);
  const deactivateLink = useMutation(api.checkoutLinks.deactivate);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    billingUnit: "",
    pricingModel: "per-unit" as const,
    unitPriceCents: 0,
    privacyMode: "standard" as const,
    refundPolicy: "no-refund" as const,
  });

  if (!products || !checkoutLinks) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

  const handleCreate = async () => {
    if (!companyId || !formData.name || !formData.billingUnit) return;
    await createProduct({
      companyId,
      name: formData.name,
      description: formData.description || undefined,
      billingUnit: formData.billingUnit,
      pricingModel: formData.pricingModel,
      unitPriceCents: formData.unitPriceCents,
      currency: "USD",
      settlementAsset: "USDC",
      privacyMode: formData.privacyMode,
      refundPolicy: formData.refundPolicy,
      isActive: true,
    });
    setShowCreate(false);
    setFormData({
      name: "",
      description: "",
      billingUnit: "",
      pricingModel: "per-unit",
      unitPriceCents: 0,
      privacyMode: "standard",
      refundPolicy: "no-refund",
    });
    toast.success("Product created");
  };

  const handleCreateLink = async (productId: Id<"products">) => {
    if (!companyId) return;
    await createCheckoutLink({ companyId, productId });
    toast.success("Checkout link created");
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/checkout/${slug}`;
    void navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const activeCount = products.filter((p) => p.isActive).length;
  const linksByProduct = new Map<string, typeof checkoutLinks>();
  for (const link of checkoutLinks) {
    const existing = linksByProduct.get(link.productId) ?? [];
    existing.push(link);
    linksByProduct.set(link.productId, existing);
  }

  // SDK activity: recent checkout/usage payments
  const sdkPayments = (recentPayments ?? [])
    .filter((p) => p.mode === "checkout" || p.mode === "usage")
    .slice(0, 20);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="sdk">SDK & Integration</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* ─── Products Tab ─── */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Products</CardTitle>
                  <CardDescription>
                    {products.length} product{products.length !== 1 ? "s" : ""} ({activeCount} active)
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  Create product
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No products yet. Create your first product.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Billing unit</TableHead>
                        <TableHead>Pricing</TableHead>
                        <TableHead>Unit price</TableHead>
                        <TableHead>Checkout links</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((prod) => {
                        const prodLinks = linksByProduct.get(prod._id) ?? [];
                        const activeLinks = prodLinks.filter((l) => l.isActive);
                        return (
                          <TableRow
                            key={prod._id}
                            className={!prod.isActive ? "opacity-50" : ""}
                          >
                            <TableCell>
                              <div>
                                <div className="font-medium">{prod.name}</div>
                                {prod.description && (
                                  <div className="text-xs text-muted-foreground">
                                    {prod.description}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{prod.billingUnit}</TableCell>
                            <TableCell className="capitalize">
                              {prod.pricingModel}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {formatCentsDetailed(prod.unitPriceCents)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-sm tabular-nums">
                                  {activeLinks.length}
                                </span>
                                {activeLinks.length > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyLink(activeLinks[0].slug)}
                                  >
                                    Copy
                                  </Button>
                                )}
                                {prod.isActive && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void handleCreateLink(prod._id)}
                                  >
                                    + Link
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={prod.isActive ? "default" : "secondary"}
                              >
                                {prod.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void removeProduct({ id: prod._id })}
                              >
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Checkout Links */}
          {checkoutLinks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Checkout Links</CardTitle>
                <CardDescription>
                  Shareable payment URLs for your products
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checkoutLinks.map((link) => (
                        <TableRow key={link._id}>
                          <TableCell className="font-medium">
                            {link.productName}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {link.slug}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyLink(link.slug)}
                            >
                              Copy link
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Badge variant={link.isActive ? "default" : "secondary"}>
                              {link.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {link.isActive && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void deactivateLink({ id: link._id })}
                              >
                                Deactivate
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── SDK Tab ─── */}
        <TabsContent value="sdk" className="space-y-4">
          {/* Config */}
          <Card>
            <CardHeader>
              <CardTitle>Your Configuration</CardTitle>
              <CardDescription>Use these values to integrate payments into your app</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Company ID</p>
                  <code className="text-sm font-mono break-all">{companyId ?? "..."}</code>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">API Base</p>
                  <code className="text-sm font-mono break-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/pay</code>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Integration methods */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Checkout Link */}
            <Card>
              <CardHeader>
                <Badge variant="outline" className="w-fit mb-2">Easiest</Badge>
                <CardTitle className="text-base">Checkout Link</CardTitle>
                <CardDescription>
                  Share a URL. Customer picks quantity, pays via WalletConnect Pay. Payment + customer registration happen automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-4 font-mono text-xs overflow-x-auto whitespace-pre">{`const checkoutUrl = "${typeof window !== "undefined" ? window.location.origin : ""}/checkout/{slug}";
window.open(checkoutUrl);`}</div>
              </CardContent>
            </Card>

            {/* Usage Billing */}
            <Card>
              <CardHeader>
                <Badge variant="outline" className="w-fit mb-2">Flexible</Badge>
                <CardTitle className="text-base">Usage Billing</CardTitle>
                <CardDescription>
                  Create payments with dynamic amounts from your backend. Buyer pays via WalletConnect Pay. Treasury credited on completion.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-4 font-mono text-xs overflow-x-auto whitespace-pre">{`const payment = await convex.mutation(
  "checkout:initiateUsagePayment",
  {
    companyId: "${companyId ?? "..."}",
    productId: "<product-id>",
    amountCents: 500,
    currency: "USD",
    description: "50 API calls",
    buyerWallet: "0x...",
  }
);`}</div>
              </CardContent>
            </Card>
          </div>

          {/* Status & Webhook */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Check Status</CardTitle>
                <CardDescription>Poll payment status from your frontend</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-4 font-mono text-xs overflow-x-auto whitespace-pre">{`const res = await fetch(
  "/api/pay/status?paymentId=<id>"
);
const { status, isFinal } = await res.json();
// "requires_action" | "processing"
// "succeeded" | "failed"`}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Webhook</CardTitle>
                <CardDescription>Server-to-server confirmation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-4 font-mono text-xs overflow-x-auto whitespace-pre">{`POST ${typeof window !== "undefined" ? window.location.origin : ""}/api/pay/webhook

// Body: { paymentId, referenceId }
// Auto-confirms payment
// Credits your treasury`}</div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Configure WalletConnect Pay to send webhooks to this URL.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* How it works */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How it works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Checkout links</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a link for any product. Share with customers. They pay via WalletConnect Pay.
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Pay-as-you-go</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your app creates payments with dynamic amounts. Buyer pays, treasury credited.
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Auto-CRM</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Any wallet that pays is auto-registered as a customer. Enrich profiles later.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Activity Tab ─── */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>SDK Activity</CardTitle>
              <CardDescription>
                Recent checkout and usage payments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sdkPayments.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No SDK-initiated payments yet
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mode</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sdkPayments.map((p) => (
                        <TableRow key={p._id}>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {p.mode}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-48 truncate text-muted-foreground">
                            {p.description ?? "-"}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatCentsDetailed(p.amountCents)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                p.status === "paid"
                                  ? "default"
                                  : p.status === "cancelled"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="capitalize"
                            >
                              {p.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(p.paidAt ?? p._creationTime)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Create Product Dialog ─── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create product</DialogTitle>
            <DialogDescription>
              Define a new billable product for this workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Product name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="billingUnit">Billing unit</Label>
                <Input
                  id="billingUnit"
                  placeholder="e.g., request, token, hour"
                  value={formData.billingUnit}
                  onChange={(e) =>
                    setFormData({ ...formData, billingUnit: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Pricing model</Label>
                <Select
                  value={formData.pricingModel}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      pricingModel: v as typeof formData.pricingModel,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per-unit">Per unit</SelectItem>
                    <SelectItem value="tiered">Tiered</SelectItem>
                    <SelectItem value="flat">Flat</SelectItem>
                    <SelectItem value="usage-commit">Usage + commit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unitPrice">Unit price (USD)</Label>
              <Input
                id="unitPrice"
                type="number"
                step="0.01"
                value={formData.unitPriceCents / 100 || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    unitPriceCents: Math.round(
                      parseFloat(e.target.value || "0") * 100
                    ),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Privacy mode</Label>
                <Select
                  value={formData.privacyMode}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      privacyMode: v as typeof formData.privacyMode,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="pseudonymous">Pseudonymous</SelectItem>
                    <SelectItem value="shielded">Shielded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Refund policy</Label>
                <Select
                  value={formData.refundPolicy}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      refundPolicy: v as typeof formData.refundPolicy,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-refund">No refund</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()}>Create product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProductsPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <PageHeader
        title="Products & SDK"
        description="Define billable products, checkout links, and integrations"
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <ProductsContent
              showCreate={showCreate}
              setShowCreate={setShowCreate}
            />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
