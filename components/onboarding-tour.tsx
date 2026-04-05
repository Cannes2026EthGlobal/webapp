"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type TourStep = {
  selector: string;
  title: string;
  description: string;
  route?: string;
  position?: "top" | "bottom" | "left" | "right";
};

const TOUR_STEPS: TourStep[] = [
  {
    selector: "[data-tour='overview']",
    title: "Your Dashboard",
    description: "This is your control desk. See treasury balance, payroll due, receivables, and revenue at a glance.",
    route: "/dashboard",
    position: "bottom",
  },
  {
    selector: "[data-tour='employees']",
    title: "Employees",
    description: "Manage your team here. Add employees with wallet addresses, set salaries, approve payments, and handle salary advances.",
    route: "/dashboard",
    position: "right",
  },
  {
    selector: "[data-tour='customers']",
    title: "Customers",
    description: "Track your customers, their billing state, and payment history. Customers are auto-registered when they pay via checkout links.",
    route: "/dashboard",
    position: "right",
  },
  {
    selector: "[data-tour='treasury']",
    title: "Treasury",
    description: "Deposit USDC into your payroll contract, view your balance ledger, and bridge funds across chains via CCTP.",
    route: "/dashboard",
    position: "right",
  },
  {
    selector: "[data-tour='products']",
    title: "My Products",
    description: "Create products, generate checkout links, and customize each link with your brand colors, effects, and referral commissions.",
    route: "/dashboard",
    position: "right",
  },
  {
    selector: "[data-tour='ai-agents']",
    title: "AI & Agents",
    description: "AI-powered insights about your business, conversational assistant, and agent billing with API keys for autonomous payments.",
    route: "/dashboard",
    position: "right",
  },
  {
    selector: "[data-tour='integration']",
    title: "Integration",
    description: "Your API docs, code examples for checkout links and usage billing, webhook configuration, and recent SDK activity.",
    route: "/dashboard",
    position: "right",
  },
  {
    selector: "[data-tour='settings']",
    title: "Settings",
    description: "Configure your workspace, settlement address, webhook URL, and brand color. You can replay this tour anytime from here.",
    route: "/dashboard",
    position: "right",
  },
];

const TOUR_KEY = "arc-counting-tour-completed";

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const router = useRouter();
  const pathname = usePathname();
  const rafRef = useRef<number>(0);

  // Auto-start on first visit
  useEffect(() => {
    const completed = localStorage.getItem(TOUR_KEY);
    if (!completed && pathname === "/dashboard") {
      const timer = setTimeout(() => setActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  const positionTooltip = useCallback(() => {
    if (!active) return;
    const currentStep = TOUR_STEPS[step];
    const el = document.querySelector(currentStep.selector);

    if (!el) {
      // Element not found — hide highlight, show centered tooltip
      setHighlightStyle({ display: "none" });
      setTooltipStyle({
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
      return;
    }

    const rect = el.getBoundingClientRect();
    const pad = 8;

    // Highlight box
    setHighlightStyle({
      position: "fixed",
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
      borderRadius: 8,
      display: "block",
    });

    // Tooltip position
    const pos = currentStep.position ?? "bottom";
    let top = 0;
    let left = 0;

    if (pos === "bottom") {
      top = rect.bottom + pad + 12;
      left = rect.left + rect.width / 2;
    } else if (pos === "top") {
      top = rect.top - pad - 12;
      left = rect.left + rect.width / 2;
    } else if (pos === "right") {
      top = rect.top + rect.height / 2;
      left = rect.right + pad + 12;
    } else if (pos === "left") {
      top = rect.top + rect.height / 2;
      left = rect.left - pad - 12;
    }

    // Keep tooltip in viewport
    const maxLeft = window.innerWidth - 340;
    const maxTop = window.innerHeight - 200;
    left = Math.max(20, Math.min(left, maxLeft));
    top = Math.max(20, Math.min(top, maxTop));

    setTooltipStyle({
      position: "fixed",
      top,
      left,
      transform: pos === "bottom" || pos === "top" ? "translateX(-50%)" : "translateY(-50%)",
    });
  }, [active, step]);

  useEffect(() => {
    if (!active) return;
    positionTooltip();

    const handleResize = () => positionTooltip();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [active, step, positionTooltip]);

  // Navigate to step's route if needed
  useEffect(() => {
    if (!active) return;
    const currentStep = TOUR_STEPS[step];
    if (currentStep.route && pathname !== currentStep.route) {
      router.push(currentStep.route);
    }
    // Re-position after route change
    const timer = setTimeout(positionTooltip, 300);
    return () => clearTimeout(timer);
  }, [active, step, pathname, router, positionTooltip]);

  const next = () => {
    if (step < TOUR_STEPS.length - 1) setStep(step + 1);
    else finish();
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const finish = () => {
    setActive(false);
    setStep(0);
    localStorage.setItem(TOUR_KEY, "true");
  };

  const restart = () => {
    setStep(0);
    setActive(true);
    localStorage.removeItem(TOUR_KEY);
    router.push("/dashboard");
  };

  if (!active) return null;

  const currentStep = TOUR_STEPS[step];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[9998] transition-opacity duration-300"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
        onClick={finish}
      />

      {/* Highlight cutout */}
      <div
        className="fixed z-[9999] pointer-events-none transition-all duration-300 ease-out"
        style={{
          ...highlightStyle,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6), 0 0 20px 4px rgba(34, 197, 94, 0.4)",
          border: "2px solid rgba(34, 197, 94, 0.6)",
        }}
      />

      {/* Tooltip */}
      <div
        className="fixed z-[10000] w-80 rounded-lg border bg-card p-4 shadow-xl transition-all duration-300 ease-out"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-xs text-muted-foreground">
              Step {step + 1} of {TOUR_STEPS.length}
            </p>
            <h3 className="text-sm font-semibold">{currentStep.title}</h3>
          </div>
          <button
            onClick={finish}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {currentStep.description}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === step ? 20 : 6,
                  backgroundColor: i === step ? "rgb(34, 197, 94)" : "rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={prev}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {step === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Hook to restart the tour from anywhere (e.g. Settings page)
 */
export function useOnboardingTour() {
  const restart = () => {
    localStorage.removeItem(TOUR_KEY);
    window.location.href = "/dashboard";
  };
  return { restart };
}
