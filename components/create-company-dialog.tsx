"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCompany } from "@/hooks/use-company";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CreateCompanyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { walletAddress, switchCompany } = useCompany();
  const createCompany = useMutation(api.companies.create);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    industry: "",
    website: "",
  });
  const [slugTouched, setSlugTouched] = useState(false);

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: slugTouched ? formData.slug : slugify(name),
    });
  };

  const handleCreate = async () => {
    if (!walletAddress || !formData.name || !formData.slug) return;
    try {
      const id = await createCompany({
        name: formData.name,
        slug: formData.slug,
        ownerWallet: walletAddress,
        industry: formData.industry || undefined,
        website: formData.website || undefined,
      });
      toast.success(`Workspace "${formData.name}" created`);
      switchCompany(id);
      onOpenChange(false);
      setFormData({ name: "", slug: "", industry: "", website: "" });
      setSlugTouched(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create workspace"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            Set up a new business workspace on Arc Counting.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Inc"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setFormData({ ...formData, slug: e.target.value });
              }}
              placeholder="acme-inc"
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier for this workspace
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="industry">Industry (optional)</Label>
              <Input
                id="industry"
                value={formData.industry}
                onChange={(e) =>
                  setFormData({ ...formData, industry: e.target.value })
                }
                placeholder="Technology"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="website">Website (optional)</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
                placeholder="https://acme.co"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={!formData.name || !formData.slug}
          >
            Create workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
