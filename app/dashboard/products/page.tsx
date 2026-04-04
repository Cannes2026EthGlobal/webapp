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
  const removeProduct = useMutation(api.products.remove);
  const createCheckoutLink = useMutation(api.checkoutLinks.create);
  const deactivateLink = useMutation(api.checkoutLinks.deactivate);

  if (!products || !checkoutLinks) {
    return (
      <div className="p-4 lg:p-6">
        <Skeleton className="h-96" />
      </div>
    );
  }

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
                                    variant="outline"
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
                                variant="outline"
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
                        <TableHead>Checkout URL</TableHead>
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
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <a
                                href={`${typeof window !== "undefined" ? window.location.origin : ""}/checkout/${link.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-xs text-primary underline break-all"
                              >
                                {typeof window !== "undefined" ? window.location.origin : ""}/checkout/{link.slug}
                              </a>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyLink(link.slug)}
                              >
                                Copy
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={link.isActive ? "default" : "secondary"}>
                              {link.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {link.isActive && (
                              <Button
                                variant="outline"
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

      <CreateProductDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        companyId={companyId}
      />
    </div>
  );
}

function CreateProductDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: any;
}) {
  const createProduct = useMutation(api.products.create);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [billingUnit, setBillingUnit] = useState("");
  const [pricingModel, setPricingModel] = useState<"per-unit" | "tiered" | "flat" | "usage-commit">("per-unit");
  const [priceInput, setPriceInput] = useState("");
  const [privacyMode, setPrivacyMode] = useState<"standard" | "pseudonymous" | "shielded">("standard");
  const [refundPolicy, setRefundPolicy] = useState<"no-refund" | "partial" | "full">("no-refund");

  const handleCreate = async () => {
    if (!companyId || !name || !billingUnit) return;
    const val = parseFloat(priceInput || "0");
    await createProduct({
      companyId,
      name,
      description: description || undefined,
      billingUnit,
      pricingModel,
      unitPriceCents: Math.floor(val * 100 * 1e10) / 1e10,
      currency: "USD",
      settlementAsset: "USDC",
      privacyMode,
      refundPolicy,
      isActive: true,
    });
    onOpenChange(false);
    setName("");
    setDescription("");
    setBillingUnit("");
    setPricingModel("per-unit");
    setPriceInput("");
    setPrivacyMode("standard");
    setRefundPolicy("no-refund");
    toast.success("Product created");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="billingUnit">Billing unit</Label>
              <Input id="billingUnit" placeholder="e.g., request, token, hour" value={billingUnit} onChange={(e) => setBillingUnit(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Pricing model</Label>
              <Select value={pricingModel} onValueChange={(v) => setPricingModel(v as typeof pricingModel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              type="text"
              inputMode="decimal"
              placeholder="0.0001"
              value={priceInput}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v)) {
                  setPriceInput(v);
                }
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Privacy mode</Label>
              <Select value={privacyMode} onValueChange={(v) => setPrivacyMode(v as typeof privacyMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="pseudonymous">Pseudonymous</SelectItem>
                  <SelectItem value="shielded">Shielded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Refund policy</Label>
              <Select value={refundPolicy} onValueChange={(v) => setRefundPolicy(v as typeof refundPolicy)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void handleCreate()}>Create product</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
