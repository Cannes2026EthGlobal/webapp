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
    lines: [
      "Add employees with salaries",
      "Onboard customers",
      "Create products with checkout links",
      "Configure advance rates and thresholds",
    ],
    icon: BriefcaseBusiness,
  },
  {
    title: "Collect and pay",
    lines: [
      "Customers pay via WalletConnect Pay",
      "Approve payroll batches",
      "Review salary advance requests",
      "Interest deducted upfront",
    ],
    icon: ReceiptText,
  },
  {
    title: "Settle on-chain",
    lines: [
      "Chainlink CRE executes payments",
      "Payroll contract settles on Arc",
      "Customer payments via WalletConnect Pay",
    ],
    icon: Workflow,
  },
];

const sponsorStack = [
  { name: "Arc", org: "Circle", color: "var(--tone-green)" },
  { name: "Chainlink CRE", org: "Chainlink", color: "#375BD2" },
  { name: "WalletConnect Pay", org: "WalletConnect", color: "#3B99FC" },
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
          <a href="#features" className="text-base font-medium transition-colors hover:opacity-70" style={{ color: "var(--tone-muted)" }}>Features</a>
          <a href="#dashboard" className="text-base font-medium transition-colors hover:opacity-70" style={{ color: "var(--tone-muted)" }}>Dashboard</a>
          <a href="#how-it-works" className="text-base font-medium transition-colors hover:opacity-70" style={{ color: "var(--tone-muted)" }}>How it works</a>
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

      {/* ─── Stats strip ─── */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div
          className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border md:grid-cols-4"
          style={{ borderColor: "var(--tone-border)", background: "var(--tone-border)" }}
        >
          {[
            { value: "USDC", label: "Payroll & invoices in stablecoins" },
            { value: "Up to 100%", label: "Of your salary upfront\n(against interest)" },
            { value: "Custom", label: "Per-invoice reception parameters" },
            { value: "Any chain", label: "Supported by Circle CCTP" },
          ].map((s) => (
            <div
              key={s.label}
              className="px-5 py-4 text-center"
              style={{ background: "var(--tone-linen)" }}
            >
              <p className="text-xl font-semibold" style={{ color: "var(--tone-green)" }}>{s.value}</p>
              <p className="mt-0.5 whitespace-pre-line text-xs" style={{ color: "var(--tone-muted)" }}>{s.label}</p>
            </div>
          ))}
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

      {/* ─── Employee Portal Callout ─── */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div
          className="rounded-lg border p-8 md:flex md:items-center md:gap-8"
          style={{ borderColor: "var(--tone-border)", background: "var(--tone-linen)" }}
        >
          <div className="mb-4 md:mb-0 md:flex-1">
            <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--tone-green)" }}>
              Employee portal
            </p>
            <h3 className="mt-2 text-lg font-semibold">
              Employees can request their salary in advance.
            </h3>
            <ul className="mt-3 space-y-2 text-sm" style={{ color: "var(--tone-muted)" }}>
              <li className="flex items-start gap-2">
                <ArrowRight className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--tone-green)" }} />
                <span>Employees connect their wallet and see their upcoming paycheck, eligible advance amount, and interest breakdown</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--tone-green)" }} />
                <span>Employer sets the interest rate and max advance percentage</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--tone-green)" }} />
                <span>Disable advances per employee or automatically when treasury runs low</span>
              </li>
            </ul>
          </div>
          <div
            className="rounded-lg border p-4 md:w-72"
            style={{ borderColor: "var(--tone-border)", background: "var(--tone-paper)" }}
          >
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: "var(--tone-muted)" }}>Next paycheck</span>
                <span className="font-medium">$12,000</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--tone-muted)" }}>Eligible advance</span>
                <span className="font-medium">up to $9,600</span>
              </div>
              <div
                className="rounded border p-2 text-xs"
                style={{ borderColor: "var(--tone-border)" }}
              >
                <div className="flex justify-between">
                  <span>Requested</span>
                  <span>$5,000</span>
                </div>
                <div className="flex justify-between" style={{ color: "var(--tone-copper, var(--tone-muted))" }}>
                  <span>Interest (2%)</span>
                  <span>-$100</span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1 font-medium" style={{ borderColor: "var(--tone-border)" }}>
                  <span>You receive</span>
                  <span>$4,900</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Dashboard Preview ─── */}
      <section id="dashboard" className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="mb-2 text-center text-3xl font-light tracking-tight md:text-4xl">
          Your <span style={{ color: "var(--tone-green)" }}>operator</span> dashboard
        </h2>
        <p className="mb-10 text-center text-base" style={{ color: "var(--tone-muted)" }}>
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

      {/* ─── Under the hood ─── */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <h2 className="mb-8 text-center text-3xl font-light tracking-tight md:text-4xl">
          Under the hood
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              name: "Arc (Circle)",
              role: "Settlement rail",
              lines: [
                "USDC-native L1 blockchain.",
                "All payroll and customer payments settle here.",
                "The Payroll smart contract holds company funds and executes payments.",
              ],
            },
            {
              name: "Chainlink CRE",
              role: "Payment automation",
              lines: [
                "Cron-triggered workflow fetches due salary requests via Confidential HTTP.",
                "Executes on-chain payments through the KeystoneForwarder.",
              ],
            },
            {
              name: "WalletConnect Pay",
              role: "Customer checkout",
              lines: [
                "Customers pay through checkout links.",
                "Per-invoice customization (amount, currency, metadata) on top of standard WC Pay.",
              ],
            },
          ].map((tech) => (
            <div
              key={tech.name}
              className="rounded-lg border p-6"
              style={{ borderColor: "var(--tone-border)", background: "var(--tone-linen)" }}
            >
              <p className="text-lg font-semibold">{tech.name}</p>
              <p className="text-sm" style={{ color: "var(--tone-green)" }}>{tech.role}</p>
              <div className="mt-3 flex flex-col gap-2">
                {tech.lines.map((line) => (
                  <p key={line} className="text-sm leading-relaxed" style={{ color: "var(--tone-muted)" }}>{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="mx-auto max-w-4xl px-6 pb-24">
        <h2 className="mb-8 text-center text-3xl font-light tracking-tight md:text-4xl">
          How it works
        </h2>
        <div className="space-y-4">
          {howItWorks.map((step, i) => (
            <div
              key={step.title}
              className="flex items-start gap-4 rounded-lg border p-5"
              style={{ borderColor: "var(--tone-border)", background: "var(--tone-linen)" }}
            >
              <div
                className="flex size-8 shrink-0 items-center justify-center rounded-full border"
                style={{ borderColor: "var(--tone-border)", color: "var(--tone-green)" }}
              >
                <step.icon className="size-4" />
              </div>
              <div>
                <p className="text-xs" style={{ color: "var(--tone-green)" }}>Step {i + 1}</p>
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {step.lines.map((line) => (
                    <span
                      key={line}
                      className="shrink-0 rounded border px-3 py-2 text-xs"
                      style={{ borderColor: "var(--tone-border)", color: "var(--tone-muted)" }}
                    >
                      {line}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Built with ─── */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <p
          className="mb-6 text-center text-sm font-medium uppercase tracking-widest"
          style={{ color: "var(--tone-muted)" }}
        >
          Built with
        </p>
        <div className="grid grid-cols-3 gap-4">
          {sponsorStack.map((s) => (
            <div
              key={s.name}
              className="relative overflow-hidden rounded-lg border px-6 py-6 text-center"
              style={{ borderColor: "var(--tone-border)", background: "var(--tone-linen)" }}
            >
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{ background: s.color }}
              />
              <p className="text-lg font-semibold" style={{ color: "var(--tone-ink)" }}>{s.name}</p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--tone-muted)" }}>by {s.org}</p>
            </div>
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
