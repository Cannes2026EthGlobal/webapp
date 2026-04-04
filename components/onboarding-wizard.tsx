"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useDeployContract, useWaitForTransactionReceipt } from "wagmi";
import { api } from "@/convex/_generated/api";
import {
  PAYROLL_ABI,
  PAYROLL_BYTECODE,
  KEYSTONE_FORWARDER_ADDRESS,
} from "@/lib/payroll-contract";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Step = "details" | "deploy" | "done";

export function OnboardingWizard({
  walletAddress,
  onComplete,
}: {
  walletAddress: string;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<Step>("details");
  const [formData, setFormData] = useState({
    businessName: "",
    description: "",
    industry: "",
    website: "",
  });
  const [deployedAddress, setDeployedAddress] = useState<string>("");

  const createProfile = useMutation(api.businessProfiles.create);

  // Wagmi contract deployment
  const {
    deployContract,
    data: deployHash,
    isPending: isDeploying,
    error: deployError,
  } = useDeployContract();

  const { data: receipt, isLoading: isWaitingReceipt } =
    useWaitForTransactionReceipt({
      hash: deployHash,
    });

  // When receipt arrives, capture the contract address
  if (receipt?.contractAddress && !deployedAddress) {
    setDeployedAddress(receipt.contractAddress);
  }

  const handleDeploy = () => {
    deployContract(
      {
        abi: PAYROLL_ABI,
        bytecode: PAYROLL_BYTECODE,
        args: [KEYSTONE_FORWARDER_ADDRESS],
      },
      {
        onError: (err) => {
          toast.error(err.message.slice(0, 100));
        },
      }
    );
  };

  const handleFinish = async () => {
    if (!deployedAddress) return;
    try {
      await createProfile({
        ownerWallet: walletAddress,
        businessName: formData.businessName,
        description: formData.description || undefined,
        industry: formData.industry || undefined,
        website: formData.website || undefined,
        payrollContractAddress: deployedAddress,
      });
      toast.success("Business profile created");
      onComplete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save profile");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <StepIndicator label="1" title="Details" active={step === "details"} done={step !== "details"} />
          <div className="h-px w-8 bg-border" />
          <StepIndicator label="2" title="Deploy" active={step === "deploy"} done={step === "done"} />
          <div className="h-px w-8 bg-border" />
          <StepIndicator label="3" title="Ready" active={step === "done"} done={false} />
        </div>

        {/* Step 1: Business Details */}
        {step === "details" && (
          <Card>
            <CardHeader>
              <CardTitle>Set up your business</CardTitle>
              <CardDescription>
                Tell us about your business to create your Arc Counting workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="businessName">Business name *</Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) =>
                    setFormData({ ...formData, businessName: e.target.value })
                  }
                  placeholder="Acme Corp"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="What does your business do?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="industry">Industry</Label>
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
                  <Label htmlFor="website">Website</Label>
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
              <Separator />
              <Button
                className="w-full"
                disabled={!formData.businessName}
                onClick={() => setStep("deploy")}
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Deploy Contract */}
        {step === "deploy" && (
          <Card>
            <CardHeader>
              <CardTitle>Deploy payroll contract</CardTitle>
              <CardDescription>
                Deploy your Payroll smart contract on Arc testnet. This contract
                will hold funds and process employee payments on-chain.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Network</span>
                  <Badge variant="outline">Arc Testnet</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Contract</span>
                  <span className="font-mono text-xs">Payroll.sol</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Forwarder</span>
                  <span className="font-mono text-xs">
                    {KEYSTONE_FORWARDER_ADDRESS.slice(0, 10)}...
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Owner</span>
                  <span className="font-mono text-xs">
                    {walletAddress.slice(0, 10)}...
                  </span>
                </div>
              </div>

              {!deployHash && !deployedAddress && (
                <Button
                  className="w-full"
                  onClick={handleDeploy}
                  disabled={isDeploying}
                >
                  {isDeploying
                    ? "Confirm in wallet..."
                    : "Deploy Payroll Contract"}
                </Button>
              )}

              {deployHash && !deployedAddress && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="size-2 animate-pulse rounded-full bg-yellow-500" />
                    <span className="text-sm">
                      {isWaitingReceipt
                        ? "Waiting for confirmation..."
                        : "Transaction submitted"}
                    </span>
                  </div>
                  <a
                    href={`https://testnet.arcscan.app/tx/${deployHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs font-mono text-muted-foreground hover:underline"
                  >
                    {deployHash}
                  </a>
                </div>
              )}

              {deployedAddress && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-green-500" />
                    <span className="text-sm font-medium">
                      Contract deployed
                    </span>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">
                      Contract address
                    </p>
                    <a
                      href={`https://testnet.arcscan.app/address/${deployedAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm hover:underline"
                    >
                      {deployedAddress}
                    </a>
                  </div>
                  <Button className="w-full" onClick={() => setStep("done")}>
                    Continue
                  </Button>
                </div>
              )}

              {deployError && (
                <p className="text-sm text-destructive">
                  {deployError.message.slice(0, 200)}
                </p>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("details")}
              >
                Back
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Done */}
        {step === "done" && (
          <Card>
            <CardHeader>
              <CardTitle>You're all set</CardTitle>
              <CardDescription>
                Your business profile and payroll contract are ready.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Business</span>
                  <span className="font-medium">{formData.businessName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Contract</span>
                  <span className="font-mono text-xs">
                    {deployedAddress.slice(0, 10)}...{deployedAddress.slice(-8)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Network</span>
                  <Badge variant="outline">Arc Testnet</Badge>
                </div>
              </div>
              <Button className="w-full" onClick={() => void handleFinish()}>
                Enter dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StepIndicator({
  label,
  title,
  active,
  done,
}: {
  label: string;
  title: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex size-7 items-center justify-center rounded-full text-xs font-medium ${
          active
            ? "bg-primary text-primary-foreground"
            : done
              ? "bg-primary/20 text-primary"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {label}
      </div>
      <span
        className={`text-sm ${active ? "font-medium" : "text-muted-foreground"}`}
      >
        {title}
      </span>
    </div>
  );
}
