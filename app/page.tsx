import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  ReceiptText,
  Workflow,
} from "lucide-react";
import { LandingAuthButton } from "@/components/landing-auth-button";

const productLanes = [
  {
    id: "Payroll & Advances",
    title: "Pay your team from one desk.",
    description:
      "Manage salaries, approve payments, and let employees request advances against their next paycheck — with interest calculated on-chain.",
    icon: BriefcaseBusiness,
    points: [
      "Monthly payroll settled in USDC on Arc",
      "Salary advances with configurable interest rates",
      "Auto-disable advances when treasury runs low",
    ],
  },
  {
    id: "Invoicing & Checkout",
    title: "Get paid by your customers.",
    description:
      "Create products, generate checkout links, and collect payments via WalletConnect Pay. Funds hit your treasury automatically.",
    icon: Bot,
    points: [
      "Checkout links with WalletConnect Pay",
      "Custom reception parameters per invoice (amount, currency, metadata)",
      "Real-time treasury balance tracking",
    ],
  },
];

const workspaceNav = [
  "Overview",
  "Employees",
  "Customers",
  "Payroll",
  "Products",
  "Treasury",
];

const overviewMetrics = [
  { label: "Treasury available", value: "$482k" },
  { label: "Payroll due", value: "$31k" },
  { label: "Pending receivables", value: "$18k" },
  { label: "Usage revenue today", value: "$2.4k" },
];

const outboundRows = [
  { name: "Elena Vasquez — Salary", status: "Approved", amount: "$12,000" },
  { name: "Marcus Chen — Advance", status: "Settled", amount: "$4,900" },
  { name: "Aria Nakamura — Contractor", status: "Draft", amount: "$4,250" },
];

const inboundRows = [
  { name: "Synthex AI — API usage", status: "Streaming", amount: "$146" },
  { name: "DevCon ticket — Checkout", status: "Paid", amount: "$350" },
  { name: "Northwind Labs — Invoice", status: "Pending", amount: "$9,800" },
];

const howItWorks = [
  {
    title: "Set up your workspace",
    description:
      "Add employees with salary details, onboard customers, and create billable products — all from one dashboard.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Collect and pay",
    description:
      "Generate checkout links with custom reception parameters per invoice — amount, currency, and description. Approve payroll batches. Employees can request salary advances with interest deducted upfront.",
    icon: ReceiptText,
  },
  {
    title: "Settle on-chain",
    description:
      "Chainlink CRE automatically executes approved payments on Arc. WalletConnect Pay handles customer checkout with per-invoice customization that standard WC Pay doesn't support out of the box.",
    icon: Workflow,
  },
];

const sponsorStack = [
  "Arc (Circle)",
  "Chainlink CRE",
  "WalletConnect Pay",
];

export default function Page() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--tone-paper)", color: "var(--tone-ink)" }}
    >
      {/* ─── Nav ─── */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div
            className="inline-flex size-10 items-center justify-center rounded-full border font-mono text-xs tracking-widest"
            style={{
              borderColor: "var(--tone-border)",
              background: "var(--tone-ink)",
              color: "var(--tone-paper)",
            }}
          >
            AC
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Arc Counting
          </span>
        </div>
        <div className="hidden items-center gap-6 md:flex">
          <a href="#features" className="text-sm transition-colors hover:opacity-70" style={{ color: "var(--tone-muted)" }}>Features</a>
          <a href="#dashboard" className="text-sm transition-colors hover:opacity-70" style={{ color: "var(--tone-muted)" }}>Dashboard</a>
          <a href="#how-it-works" className="text-sm transition-colors hover:opacity-70" style={{ color: "var(--tone-muted)" }}>How it works</a>
          <LandingAuthButton />
        </div>
        <div className="md:hidden">
          <LandingAuthButton />
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-center md:pt-28">
        <h1 className="text-4xl font-light leading-tight tracking-tight md:text-5xl">
          Payroll, invoicing, and salary advances
          <br />
          <span style={{ color: "var(--tone-green)" }}>settled on Arc.</span>
        </h1>
        <p
          className="mx-auto mt-5 max-w-lg text-base leading-relaxed"
          style={{ color: "var(--tone-muted)" }}
        >
          One dashboard for paying your team and getting paid by your customers.
          USDC settlement on Arc. Salary advances with on-chain interest.
          Checkout links via WalletConnect Pay.
        </p>
        <div className="mt-8 flex justify-center">
          <LandingAuthButton />
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-2">
          {productLanes.map((lane) => (
            <div
              key={lane.id}
              className="rounded-lg border p-6"
              style={{
                borderColor: "var(--tone-border)",
                background: "var(--tone-linen)",
              }}
            >
              <div className="mb-3 flex items-center gap-3">
                <lane.icon
                  className="size-5"
                  style={{ color: "var(--tone-green)" }}
                />
                <span
                  className="text-xs font-medium uppercase tracking-widest"
                  style={{ color: "var(--tone-muted)" }}
                >
                  {lane.id}
                </span>
              </div>
              <h3 className="text-lg font-semibold">{lane.title}</h3>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--tone-muted)" }}
              >
                {lane.description}
              </p>
              <ul className="mt-4 space-y-1.5">
                {lane.points.map((pt) => (
                  <li
                    key={pt}
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "var(--tone-carbon)" }}
                  >
                    <ArrowRight
                      className="mt-0.5 size-3.5 shrink-0"
                      style={{ color: "var(--tone-green)" }}
                    />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Dashboard Preview ─── */}
      <section id="dashboard" className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="mb-2 text-center text-2xl font-light tracking-tight">
          Your operator dashboard
        </h2>
        <p className="mb-8 text-center text-sm" style={{ color: "var(--tone-muted)" }}>
          Everything your finance team needs in one view.
        </p>
        <div
          className="overflow-hidden rounded-lg border"
          style={{
            borderColor: "var(--tone-border)",
            background: "var(--tone-linen)",
          }}
        >
          {/* Workspace nav */}
          <div
            className="flex gap-1 overflow-x-auto border-b px-4 py-2"
            style={{ borderColor: "var(--tone-border)" }}
          >
            {workspaceNav.map((item, i) => (
              <span
                key={item}
                className="shrink-0 rounded px-2.5 py-1 text-xs"
                style={{
                  background: i === 0 ? "var(--tone-paper)" : "transparent",
                  color: i === 0 ? "var(--tone-ink)" : "var(--tone-muted)",
                  fontWeight: i === 0 ? 600 : 400,
                }}
              >
                {item}
              </span>
            ))}
          </div>

          {/* Metrics */}
          <div
            className="grid grid-cols-2 gap-px border-b md:grid-cols-4"
            style={{
              borderColor: "var(--tone-border)",
              background: "var(--tone-border)",
            }}
          >
            {overviewMetrics.map((m) => (
              <div
                key={m.label}
                className="px-4 py-3"
                style={{ background: "var(--tone-linen)" }}
              >
                <p className="text-xs" style={{ color: "var(--tone-muted)" }}>
                  {m.label}
                </p>
                <p className="mt-0.5 text-lg font-semibold">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Desks */}
          <div className="grid md:grid-cols-2">
            <div
              className="border-b p-4 md:border-b-0 md:border-r"
              style={{ borderColor: "var(--tone-border)" }}
            >
              <p
                className="mb-2 text-xs font-medium uppercase tracking-widest"
                style={{ color: "var(--tone-muted)" }}
              >
                Payroll (outbound)
              </p>
              <div className="space-y-2">
                {outboundRows.map((r) => (
                  <div
                    key={r.name}
                    className="flex items-center justify-between rounded px-3 py-2 text-sm"
                    style={{ background: "var(--tone-paper)" }}
                  >
                    <span>{r.name}</span>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs"
                        style={{ color: "var(--tone-muted)" }}
                      >
                        {r.status}
                      </span>
                      <span className="font-medium">{r.amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4">
              <p
                className="mb-2 text-xs font-medium uppercase tracking-widest"
                style={{ color: "var(--tone-muted)" }}
              >
                Receivables (inbound)
              </p>
              <div className="space-y-2">
                {inboundRows.map((r) => (
                  <div
                    key={r.name}
                    className="flex items-center justify-between rounded px-3 py-2 text-sm"
                    style={{ background: "var(--tone-paper)" }}
                  >
                    <span>{r.name}</span>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs"
                        style={{ color: "var(--tone-muted)" }}
                      >
                        {r.status}
                      </span>
                      <span className="font-medium">{r.amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="mx-auto max-w-4xl px-6 pb-24">
        <h2 className="mb-8 text-center text-2xl font-light tracking-tight">
          How it works
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {howItWorks.map((step, i) => (
            <div key={step.title} className="text-center">
              <div
                className="mx-auto mb-3 inline-flex size-10 items-center justify-center rounded-full border"
                style={{
                  borderColor: "var(--tone-border)",
                  color: "var(--tone-green)",
                }}
              >
                <step.icon className="size-5" />
              </div>
              <p
                className="mb-1 text-xs"
                style={{ color: "var(--tone-muted)" }}
              >
                Step {i + 1}
              </p>
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <p
                className="mt-1.5 text-sm leading-relaxed"
                style={{ color: "var(--tone-muted)" }}
              >
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Built with ─── */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <p
          className="mb-4 text-center text-xs font-medium uppercase tracking-widest"
          style={{ color: "var(--tone-muted)" }}
        >
          Built with
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {sponsorStack.map((s) => (
            <span
              key={s}
              className="rounded-full border px-3 py-1 text-xs font-medium"
              style={{
                borderColor: "var(--tone-border)",
                color: "var(--tone-carbon)",
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="pb-16 text-center">
        <LandingAuthButton />
      </footer>
    </div>
  );
}
