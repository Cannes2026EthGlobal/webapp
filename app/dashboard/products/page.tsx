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

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="space-y-4">
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
                              ${(prod.unitPriceCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 18 })}
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
      </div>

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
              <Label htmlFor="unitPrice">Unit price (USDC)</Label>
              <Input
                id="unitPrice"
                type="number"
                step="any"
                min="0"
                placeholder="0.0001"
                value={formData.unitPriceCents > 0 ? formData.unitPriceCents / 100 : ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value || "0");
                  setFormData({
                    ...formData,
                    unitPriceCents: Math.floor(val * 100 * 1e10) / 1e10,
                  });
                }}
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
