"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// ─── Particle Effects ───

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

        if (type === "snow") return (
          <div key={i} className="absolute rounded-full opacity-80" style={{ left: `${left}%`, top: -10, width: size / 2, height: size / 2, background: "white", animation: `tour-fall ${duration + 3}s linear ${delay}s forwards` }} />
        );
        if (type === "sparkle") return (
          <div key={i} className="absolute rounded-full" style={{ left: `${left}%`, top: `${Math.random() * 100}%`, width: size / 2, height: size / 2, background: color, animation: `tour-pulse ${1 + Math.random()}s ease-in-out ${delay}s infinite alternate` }} />
        );
        if (type === "fireworks") {
          const cx = 20 + Math.random() * 60, cy = 20 + Math.random() * 40;
          const angle = (i / particles.length) * Math.PI * 2;
          const dist = 80 + Math.random() * 120;
          return (
            <div key={i} className="absolute rounded-full" style={{ left: `${cx}%`, top: `${cy}%`, width: size, height: size, background: color, animation: `tour-explode ${duration}s ease-out ${delay}s forwards`, "--tx": `${Math.cos(angle) * dist}px`, "--ty": `${Math.sin(angle) * dist}px` } as React.CSSProperties} />
          );
        }
        return (
          <div key={i} className="absolute" style={{ left: `${left}%`, top: -10, width: size, height: size, background: color, borderRadius: Math.random() > 0.5 ? "50%" : "2px", animation: `tour-fall ${duration}s ease-in ${delay}s forwards`, transform: `rotate(${Math.random() * 360}deg)` }} />
        );
      })}
      <style>{`
        @keyframes tour-fall { to { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
        @keyframes tour-pulse { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
        @keyframes tour-explode { 0% { transform: translate(0,0) scale(1); opacity:1; } 100% { transform: translate(var(--tx),var(--ty)) scale(0); opacity:0; } }
      `}</style>
    </div>
  );
}

// ─── Tour Steps — navigates to actual pages ───

type TourStep = {
  selector: string;
  title: string;
  description: string;
  route: string;
  position?: "top" | "bottom" | "left" | "right";
  effect?: "confetti" | "fireworks" | "snow" | "sparkle";
  emoji?: string;
  highlight?: "green" | "purple" | "gold";
  delay?: number;
};

const TOUR_STEPS: TourStep[] = [
  {
    selector: "#tour-hero-anchor",
    title: "Welcome to Arc Counting",
    description: "The accounting backbone for the on-chain economy. We'll walk you through everything your dashboard can do — payroll, invoicing, salary advances, checkout links, AI insights, and more. Let's get started!",
    route: "/dashboard",
    position: "bottom",
    effect: "fireworks",
    emoji: "🚀",
    highlight: "green",
  },
  {
    selector: "[data-tour='overview']",
    title: "Your Command Center",
    description: "8 real-time KPIs: treasury balance, payroll obligations, receivables, revenue, overdue invoices, and pending salary advance requests.",
    route: "/dashboard",
    position: "bottom",
    emoji: "📊",
    highlight: "green",
  },
  {
    selector: "[data-tour='recent-activity']",
    title: "Live Activity Feed",
    description: "Every inbound and outbound payment appears here in real-time — powered by Convex subscriptions. No refresh needed.",
    route: "/dashboard",
    position: "top",
    emoji: "📊",
  },
  {
    selector: "[data-tour='employee-roster']",
    title: "Employee Management",
    description: "Your team roster with wallet addresses, employment type, and salary-in-advance toggle. Each employee can request advances against their next paycheck.",
    route: "/dashboard/employees",
    position: "bottom",
    emoji: "👥",
    effect: "sparkle",
    highlight: "green",
    delay: 500,
  },
  {
    selector: "[data-tour='payment-runs']",
    title: "Payroll Settlement",
    description: "Approve, queue, and settle salary payments. Status transitions: Draft → Approved → Queued → Settled. Each settlement debits the treasury automatically.",
    route: "/dashboard/employees",
    position: "top",
    emoji: "💰",
    highlight: "gold",
  },
  {
    selector: "[data-tour='customer-list']",
    title: "Customers & Receivables",
    description: "Track customers by type — companies, apps, autonomous agents, buyers. Any wallet that pays through WalletConnect Pay is auto-registered here.",
    route: "/dashboard/customers",
    position: "bottom",
    emoji: "🤝",
    delay: 500,
  },
  {
    selector: "[data-tour='treasury-balance']",
    title: "Treasury & Deposits",
    description: "Your on-chain USDC balance. Deposit funds to your Payroll contract on Arc — each deposit is recorded in the ledger automatically.",
    route: "/dashboard/treasury",
    position: "bottom",
    emoji: "🏦",
    highlight: "gold",
    effect: "sparkle",
    delay: 500,
  },
  {
    selector: "[data-tour='ledger-entries']",
    title: "Audit Trail",
    description: "Every credit and debit is logged: deposits, payroll settlements, customer payments. Full transparency for your finance team.",
    route: "/dashboard/treasury",
    position: "top",
    emoji: "📒",
  },
  {
    selector: "[data-tour='product-list']",
    title: "Products & Checkout Links",
    description: "Create products, generate checkout links, and customize each with brand colors, celebration effects, and referral commissions. Share the link — customers pay via WalletConnect Pay.",
    route: "/dashboard/products",
    position: "bottom",
    emoji: "🛒",
    effect: "confetti",
    highlight: "green",
    delay: 500,
  },
  {
    selector: "[data-tour='ai---agents']",
    title: "AI & Agent Economy",
    description: "AI business insights, conversational assistant, and agent billing with API keys. Autonomous agents can open metered sessions and settle payments — the nanopayment economy.",
    route: "/dashboard/agents",
    position: "right",
    emoji: "🤖",
    highlight: "purple",
    effect: "sparkle",
    delay: 500,
  },
  {
    selector: "[data-tour='integration']",
    title: "Developer Integration",
    description: "Checkout link SDK, usage billing API, webhook configuration, and status polling. Everything to integrate payments into any app.",
    route: "/dashboard/integration",
    position: "right",
    emoji: "⚡",
    delay: 500,
  },
  {
    selector: "[data-tour='settings']",
    title: "You're All Set! 🎉",
    description: "Configure settlement, webhooks, and brand colors. Replay this tour anytime from Settings. Now go build something amazing.",
    route: "/dashboard/settings",
    position: "right",
    effect: "fireworks",
    emoji: "🎉",
    highlight: "gold",
    delay: 500,
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
  const [navigating, setNavigating] = useState(false);
  const highlightedElRef = useRef<Element | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_KEY);
    if (!completed && pathname === "/dashboard") {
      const timer = setTimeout(() => setActive(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  // Boost brightness of highlighted element
  useEffect(() => {
    // Clean up previous
    if (highlightedElRef.current) {
      const el = highlightedElRef.current as HTMLElement;
      el.style.removeProperty("filter");
      el.style.removeProperty("z-index");
      el.style.removeProperty("position");
      highlightedElRef.current = null;
    }

    if (!active || navigating || step === 0) return;

    const currentStep = TOUR_STEPS[step];
    const el = document.querySelector(currentStep.selector);
    if (!el) return;

    const htmlEl = el as HTMLElement;
    htmlEl.style.filter = "brightness(1.4)";
    htmlEl.style.zIndex = "9999";
    htmlEl.style.position = "relative";
    highlightedElRef.current = el;

    return () => {
      htmlEl.style.removeProperty("filter");
      htmlEl.style.removeProperty("z-index");
      htmlEl.style.removeProperty("position");
    };
  }, [active, step, navigating]);

  const positionTooltip = useCallback(() => {
    if (!active || navigating) return;
    const currentStep = TOUR_STEPS[step];
    const el = document.querySelector(currentStep.selector);

    const tooltipW = 440;
    const tooltipH = 260;
    const pad = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!el) {
      setHighlightStyle({ display: "none" });
      setTooltipStyle({
        position: "fixed",
        top: Math.max(20, vh / 2 - tooltipH / 2),
        left: Math.max(20, vw / 2 - tooltipW / 2),
      });
      return;
    }

    const rect = el.getBoundingClientRect();

    // Highlight
    setHighlightStyle({
      position: "fixed",
      top: Math.max(0, rect.top - pad),
      left: Math.max(0, rect.left - pad),
      width: Math.min(rect.width + pad * 2, vw),
      height: rect.height + pad * 2,
      borderRadius: 12,
      display: "block",
    });

    // Tooltip — try the preferred position, fall back if off-screen
    const pos = currentStep.position ?? "bottom";
    let top = 0;
    let left = 0;

    if (pos === "bottom") {
      top = rect.bottom + pad + 16;
      left = rect.left + rect.width / 2 - tooltipW / 2;
    } else if (pos === "top") {
      top = rect.top - pad - tooltipH - 16;
      left = rect.left + rect.width / 2 - tooltipW / 2;
    } else if (pos === "right") {
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.right + pad + 16;
    } else {
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.left - pad - tooltipW - 16;
    }

    // Force into viewport
    if (left < 16) left = 16;
    if (left + tooltipW > vw - 16) left = vw - tooltipW - 16;
    if (top < 16) top = 16;
    if (top + tooltipH > vh - 16) top = vh - tooltipH - 16;

    setTooltipStyle({ position: "fixed", top, left });
  }, [active, step, navigating]);

  useEffect(() => {
    if (!active) return;
    positionTooltip();
    const handle = () => positionTooltip();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => { window.removeEventListener("resize", handle); window.removeEventListener("scroll", handle, true); };
  }, [active, step, positionTooltip, navigating]);

  // Navigate to step's route
  useEffect(() => {
    if (!active) return;
    const currentStep = TOUR_STEPS[step];

    if (currentStep.route && pathname !== currentStep.route) {
      setNavigating(true);
      setHighlightStyle({ display: "none" });
      router.push(currentStep.route);
      const timer = setTimeout(() => {
        setNavigating(false);
        positionTooltip();
      }, currentStep.delay ?? 400);
      return () => clearTimeout(timer);
    }

    // Already on the right route — position after a small delay for render
    const timer = setTimeout(() => {
      setNavigating(false);
      positionTooltip();
    }, currentStep.delay ?? 200);

    // Trigger effect
    if (currentStep.effect) {
      setShowEffect(true);
      const effectTimer = setTimeout(() => setShowEffect(false), 3500);
      return () => { clearTimeout(timer); clearTimeout(effectTimer); };
    }

    return () => clearTimeout(timer);
  }, [active, step, pathname, router, positionTooltip]);

  const next = () => { if (step < TOUR_STEPS.length - 1) setStep(step + 1); else finish(); };
  const prev = () => { if (step > 0) setStep(step - 1); };
  const finish = () => { setActive(false); setStep(0); localStorage.setItem(TOUR_KEY, "true"); };

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  if (!active) return null;

  const currentStep = TOUR_STEPS[step];
  const colors = HIGHLIGHT_COLORS[currentStep.highlight ?? "green"];

  return (
    <>
      {showEffect && currentStep.effect && <ParticleEffect type={currentStep.effect} />}

      {/* Overlay */}
      <div className="fixed inset-0 z-[9998] transition-opacity duration-500" style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }} onClick={finish} />

      {/* Highlight */}
      {!navigating && (
        <div className="fixed z-[9999] pointer-events-none transition-all duration-500 ease-out" style={{
          ...highlightStyle,
          boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.8), 0 0 40px 12px ${colors.glow}, inset 0 0 20px 4px rgba(255, 255, 255, 0.1)`,
          border: `2px solid ${colors.border}`,
          backgroundColor: "rgba(255, 255, 255, 0.05)",
        }} />
      )}

      {/* Tooltip — Hero mode for step 0, normal for others */}
      {step === 0 ? (
        <div className="fixed z-[10000] inset-0 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto rounded-2xl border bg-card shadow-2xl p-10 text-center max-w-xl mx-4 transition-all duration-700 ease-out" style={{ boxShadow: `0 0 60px 20px ${colors.glow}` }}>
            <div className="text-6xl mb-5">🚀</div>
            <h2 className="text-3xl font-semibold mb-3">{currentStep.title}</h2>
            <p className="text-base text-muted-foreground leading-relaxed mb-8">{currentStep.description}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="ghost" size="lg" onClick={finish}>Skip tour</Button>
              <Button size="lg" onClick={next} style={{ backgroundColor: colors.border }}>Let&apos;s go →</Button>
            </div>
          </div>
        </div>
      ) : (
      <div className="fixed z-[10000] rounded-xl border bg-card shadow-2xl transition-all duration-500 ease-out" style={{ ...tooltipStyle, width: 440, maxWidth: "calc(100vw - 32px)" }}>
        <div className="p-6">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-3">
              {currentStep.emoji && <span className="text-3xl">{currentStep.emoji}</span>}
              <div>
                <p className="text-xs font-medium" style={{ color: colors.border }}>{step + 1} / {TOUR_STEPS.length}</p>
                <h3 className="text-lg font-semibold">{currentStep.title}</h3>
              </div>
            </div>
            <button onClick={finish} className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mb-5">{currentStep.description}</p>

          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <div key={i} className="h-1.5 rounded-full transition-all duration-300" style={{
                  width: i === step ? 24 : 8,
                  backgroundColor: i === step ? colors.border : i < step ? colors.glow : "rgba(255,255,255,0.12)",
                }} />
              ))}
            </div>
            <div className="flex gap-2">
              {step > 0 && <Button variant="ghost" size="sm" onClick={prev}>Back</Button>}
              {step === 0 && <Button variant="ghost" size="sm" onClick={finish}>Skip</Button>}
              <Button size="sm" onClick={next} style={{ backgroundColor: colors.border }}>
                {step === TOUR_STEPS.length - 1 ? "🎉 Finish" : "Next →"}
              </Button>
            </div>
          </div>
        </div>
      </div>
      )}
    </>
  );
}

export function useOnboardingTour() {
  const restart = () => { localStorage.removeItem(TOUR_KEY); window.location.href = "/dashboard"; };
  return { restart };
}
