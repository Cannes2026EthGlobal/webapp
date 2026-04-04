"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { formatCentsDetailed } from "@/lib/format";

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

function ProductsContent({ showCreate, setShowCreate }: { showCreate: boolean; setShowCreate: (v: boolean) => void }) {
  const { companyId } = useCompany();
  const products = useQuery(
    api.products.listByCompany,
    companyId ? { companyId } : "skip"
  );
  const createProduct = useMutation(api.products.create);
  const removeProduct = useMutation(api.products.remove);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    billingUnit: "",
    pricingModel: "per-unit" as const,
    unitPriceCents: 0,
    privacyMode: "standard" as const,
    refundPolicy: "no-refund" as const,
  });

  if (!products) {
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
  };

  const activeCount = products.filter((p) => p.isActive).length;

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>
            {products.length} product{products.length !== 1 ? "s" : ""} ({activeCount} active)
          </CardDescription>
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
                    <TableHead>Asset</TableHead>
                    <TableHead>Privacy</TableHead>
                    <TableHead>Refund</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((prod) => (
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
                      <TableCell>{prod.settlementAsset}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {prod.privacyMode}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">
                        {prod.refundPolicy}
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
                          onClick={() =>
                            void removeProduct({ id: prod._id })
                          }
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SDK & Integration</CardTitle>
          <CardDescription>
            API keys and integration guides for billing your products
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            SDK integration and API key management will be available once
            WalletConnect Pay is connected. Products defined here will be
            billable through checkout links and usage metering.
          </p>
        </CardContent>
      </Card>

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
                    <SelectItem value="usage-commit">
                      Usage + commit
                    </SelectItem>
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
        description="Define billable products and integrations"
        action={{ label: "Create product", onClick: () => setShowCreate(true) }}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <CompanyGuard>
            <ProductsContent showCreate={showCreate} setShowCreate={setShowCreate} />
          </CompanyGuard>
        </div>
      </div>
    </>
  );
}
