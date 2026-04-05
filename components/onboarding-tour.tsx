"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// ─── Effects ───

function ParticleEffect({ type }: { type: "confetti" | "fireworks" | "snow" | "sparkle" }) {
  const particles = Array.from({ length: type === "snow" ? 40 : 30 }, (_, i) => i);
  const colors = ["#22c55e", "#10b981", "#fbbf24", "#8b5cf6", "#ec4899", "#3b82f6", "#f97316"];

  return (
    <div className="pointer-events-none fixed inset-0 z-[10001] overflow-hidden">
      {particles.map((i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 1.5;
        const duration = 2 + Math.random() * 3;
        const size = 4 + Math.random() * 8;
        const color = colors[Math.floor(Math.random() * colors.length)];

        if (type === "snow") {
          return (
            <div key={i} className="absolute rounded-full opacity-80"
              style={{
                left: `${left}%`, top: -10, width: size / 2, height: size / 2,
                background: "white",
                animation: `tour-fall ${duration + 3}s linear ${delay}s forwards`,
              }}
            />
          );
        }

        if (type === "sparkle") {
          return (
            <div key={i} className="absolute rounded-full"
              style={{
                left: `${left}%`, top: `${Math.random() * 100}%`,
                width: size / 2, height: size / 2, background: color,
                animation: `tour-pulse ${1 + Math.random()}s ease-in-out ${delay}s infinite alternate`,
              }}
            />
          );
        }

        if (type === "fireworks") {
          const cx = 20 + Math.random() * 60;
          const cy = 20 + Math.random() * 40;
          const angle = (i / particles.length) * Math.PI * 2;
          const dist = 80 + Math.random() * 120;
          return (
            <div key={i} className="absolute rounded-full"
              style={{
                left: `${cx}%`, top: `${cy}%`, width: size, height: size,
                background: color,
                animation: `tour-explode ${duration}s ease-out ${delay}s forwards`,
                "--tx": `${Math.cos(angle) * dist}px`,
                "--ty": `${Math.sin(angle) * dist}px`,
              } as React.CSSProperties}
            />
          );
        }

        // confetti
        return (
          <div key={i} className="absolute"
            style={{
              left: `${left}%`, top: -10, width: size, height: size,
              background: color,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              animation: `tour-fall ${duration}s ease-in ${delay}s forwards`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes tour-fall { to { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
        @keyframes tour-pulse { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
        @keyframes tour-explode {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─── Step definitions ───

type TourStep = {
  selector: string;
  title: string;
  description: string;
  route?: string;
  position?: "top" | "bottom" | "left" | "right";
  effect?: "confetti" | "fireworks" | "snow" | "sparkle";
  emoji?: string;
  highlight?: "green" | "purple" | "gold";
};

const TOUR_STEPS: TourStep[] = [
  {
    selector: "#tour-welcome",
    title: "Welcome to Arc Counting",
    description: "The accounting backbone for the on-chain economy. Let's walk through what you can do.",
    route: "/dashboard",
    position: "bottom",
    effect: "fireworks",
    emoji: "🚀",
  },
  {
    selector: "[data-tour='overview']",
    title: "Your Command Center",
    description: "8 real-time KPIs: treasury balance, payroll obligations, receivables, revenue, overdue invoices, and pending salary advance requests — all from your Convex DB.",
    route: "/dashboard",
    position: "bottom",
    highlight: "green",
  },
  {
    selector: "[data-tour='employees']",
    title: "Team & Payroll",
    description: "Add employees with wallet addresses. Set salaries, approve payments, and let them request salary advances with on-chain interest — powered by Chainlink CRE.",
    route: "/dashboard",
    position: "right",
    emoji: "👥",
    effect: "sparkle",
  },
  {
    selector: "[data-tour='customers']",
    title: "Customer Management",
    description: "Auto-CRM: any wallet that pays through WalletConnect Pay is automatically registered. Track billing state, payment history, and revenue per customer.",
    route: "/dashboard",
    position: "right",
    emoji: "🤝",
  },
  {
    selector: "[data-tour='treasury']",
    title: "Treasury & Settlement",
    description: "Deposit USDC into your Payroll smart contract on Arc. View the full ledger. Bridge funds across chains via Circle CCTP V2.",
    route: "/dashboard",
    position: "right",
    highlight: "gold",
    emoji: "🏦",
  },
  {
    selector: "[data-tour='my-products']",
    title: "Products & Checkout Links",
    description: "Create products, generate branded checkout links with custom colors, celebration effects, and per-link referral commissions. Each link is a customizable payment page.",
    route: "/dashboard",
    position: "right",
    effect: "confetti",
    emoji: "🛒",
  },
  {
    selector: "[data-tour='ai---agents']",
    title: "AI & Agent Economy",
    description: "AI-powered business insights, conversational assistant, and agent billing — API keys, metered sessions, and autonomous settlements for the nanopayment economy.",
    route: "/dashboard",
    position: "right",
    emoji: "🤖",
    highlight: "purple",
    effect: "sparkle",
  },
  {
    selector: "[data-tour='integration']",
    title: "Developer SDK",
    description: "Checkout link integration, usage billing SDK, webhook configuration, and payment status polling. Everything your developers need to accept payments.",
    route: "/dashboard",
    position: "right",
    emoji: "⚡",
  },
  {
    selector: "[data-tour='settings']",
    title: "You're All Set!",
    description: "Configure settlement addresses, CCTP bridging, webhooks, and brand colors. You can replay this tour anytime from Settings.",
    route: "/dashboard",
    position: "right",
    effect: "fireworks",
    emoji: "🎉",
  },
];

const TOUR_KEY = "arc-counting-tour-completed";

const HIGHLIGHT_COLORS = {
  green: { border: "rgba(34, 197, 94, 0.7)", glow: "rgba(34, 197, 94, 0.3)" },
  purple: { border: "rgba(139, 92, 246, 0.7)", glow: "rgba(139, 92, 246, 0.3)" },
  gold: { border: "rgba(251, 191, 36, 0.7)", glow: "rgba(251, 191, 36, 0.3)" },
};

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const [showEffect, setShowEffect] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Auto-start on first visit
  useEffect(() => {
    const completed = localStorage.getItem(TOUR_KEY);
    if (!completed && pathname === "/dashboard") {
      const timer = setTimeout(() => setActive(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  const positionTooltip = useCallback(() => {
    if (!active) return;
    const currentStep = TOUR_STEPS[step];
    const el = document.querySelector(currentStep.selector);

    if (!el) {
      setHighlightStyle({ display: "none" });
      setTooltipStyle({
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
      });
      return;
    }

    const rect = el.getBoundingClientRect();
    const pad = 10;

    setHighlightStyle({
      position: "fixed",
      top: rect.top - pad, left: rect.left - pad,
      width: rect.width + pad * 2, height: rect.height + pad * 2,
      borderRadius: 12, display: "block",
    });

    const pos = currentStep.position ?? "bottom";
    let top = 0, left = 0;

    if (pos === "bottom") { top = rect.bottom + pad + 16; left = rect.left + rect.width / 2; }
    else if (pos === "top") { top = rect.top - pad - 16; left = rect.left + rect.width / 2; }
    else if (pos === "right") { top = rect.top + rect.height / 2; left = rect.right + pad + 16; }
    else if (pos === "left") { top = rect.top + rect.height / 2; left = rect.left - pad - 16; }

    // Clamp tooltip to viewport with generous padding
    const tooltipWidth = 384; // w-96
    const tooltipHeight = 220;
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

    // If tooltip would overlap the highlight, push it
    if (pos === "right" && left < rect.right + pad + 16) {
      // Fall back to bottom
      top = rect.bottom + pad + 16;
      left = Math.max(16, Math.min(rect.left, window.innerWidth - tooltipWidth - 16));
    }

    setTooltipStyle({
      position: "fixed", top, left,
      transform: pos === "bottom" || pos === "top" ? "translateX(-50%)" : "translateY(-50%)",
    });
  }, [active, step]);

  useEffect(() => {
    if (!active) return;
    positionTooltip();
    const handle = () => positionTooltip();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => { window.removeEventListener("resize", handle); window.removeEventListener("scroll", handle, true); };
  }, [active, step, positionTooltip]);

  useEffect(() => {
    if (!active) return;
    const currentStep = TOUR_STEPS[step];
    if (currentStep.route && pathname !== currentStep.route) {
      router.push(currentStep.route);
    }
    const timer = setTimeout(positionTooltip, 300);

    // Trigger effect
    if (currentStep.effect) {
      setShowEffect(true);
      const effectTimer = setTimeout(() => setShowEffect(false), 3000);
      return () => { clearTimeout(timer); clearTimeout(effectTimer); };
    }

    return () => clearTimeout(timer);
  }, [active, step, pathname, router, positionTooltip]);

  const next = () => {
    if (step < TOUR_STEPS.length - 1) setStep(step + 1);
    else finish();
  };

  const prev = () => { if (step > 0) setStep(step - 1); };

  const finish = () => {
    setActive(false);
    setStep(0);
    localStorage.setItem(TOUR_KEY, "true");
  };

  if (!active) return null;

  const currentStep = TOUR_STEPS[step];
  const colors = HIGHLIGHT_COLORS[currentStep.highlight ?? "green"];

  return (
    <>
      {/* Effect */}
      {showEffect && currentStep.effect && (
        <ParticleEffect type={currentStep.effect} />
      )}

      {/* Overlay */}
      <div
        className="fixed inset-0 z-[9998] transition-opacity duration-500"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.65)" }}
        onClick={finish}
      />

      {/* Highlight */}
      <div
        className="fixed z-[9999] pointer-events-none transition-all duration-500 ease-out"
        style={{
          ...highlightStyle,
          boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.65), 0 0 30px 8px ${colors.glow}`,
          border: `2px solid ${colors.border}`,
        }}
      />

      {/* Tooltip */}
      <div
        className="fixed z-[10000] w-96 rounded-xl border bg-card p-5 shadow-2xl transition-all duration-500 ease-out"
        style={tooltipStyle}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {currentStep.emoji && (
              <span className="text-2xl">{currentStep.emoji}</span>
            )}
            <div>
              <p className="text-xs font-medium" style={{ color: colors.border }}>
                {step + 1} / {TOUR_STEPS.length}
              </p>
              <h3 className="text-base font-semibold">{currentStep.title}</h3>
            </div>
          </div>
          <button
            onClick={finish}
            className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {currentStep.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          {/* Progress */}
          <div className="flex gap-1.5">
            {TOUR_STEPS.map((s, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 24 : 8,
                  backgroundColor: i === step
                    ? colors.border
                    : i < step
                      ? colors.glow
                      : "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={prev}>Back</Button>
            )}
            {step === 0 && (
              <Button variant="ghost" size="sm" onClick={finish}>Skip</Button>
            )}
            <Button
              size="sm"
              onClick={next}
              style={{ backgroundColor: colors.border }}
            >
              {step === TOUR_STEPS.length - 1 ? "🎉 Finish" : "Next →"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export function useOnboardingTour() {
  const restart = () => {
    localStorage.removeItem(TOUR_KEY);
    window.location.href = "/dashboard";
  };
  return { restart };
}
