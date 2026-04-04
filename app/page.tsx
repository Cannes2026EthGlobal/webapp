import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  ReceiptText,
  Workflow,
} from "lucide-react";
import { LandingAuthButton } from "@/components/landing-auth-button";

const navLinks = [
  { name: "Overview", href: "#overview" },
  { name: "Model", href: "#model" },
  { name: "Console", href: "#console" },
  { name: "Settlement", href: "#settlement" },
];

const productLanes = [
  {
    id: "B2B layer",
    title: "Private ops for payroll and invoices.",
    description:
      "Run payroll, vendor payouts, and invoice settlement from one control desk.",
    icon: BriefcaseBusiness,
    points: [
      "Private payroll batches on Arc",
      "Salary advances with on-chain interest",
      "Treasury-aware approvals and routing",
    ],
  },
  {
    id: "B2C layer",
    title: "Usage billing for AI products.",
    description:
      "Meter usage, collect payment at the moment value is created.",
    icon: Bot,
    points: [
      "WalletConnect Pay for live checkout",
      "Usage, invoices, one-time payments, and reusable links",
      "Programmable settlement logic for software-native revenue",
    ],
  },
];

const privacyStates = [
  "Shielded routes",
  "Pseudonymous employees",
  "Verified wallets",
  "Multi-wallet customers",
];

const workspaceNav = [
  "Overview",
  "Employees",
  "Customers",
  "Payroll",
  "Receivables",
  "Products",
  "Treasury",
  "Settings",
];

const overviewMetrics = [
  { label: "Treasury available", value: "$482k" },
  { label: "Payroll due", value: "$31k" },
  { label: "Pending receivables", value: "$18k" },
  { label: "Usage revenue today", value: "$2.4k" },
];

const outboundRows = [
  { name: "Payroll batch / Shielded", status: "Approved", amount: "$18.4k" },
  { name: "Salary advance / Verified", status: "Settled", amount: "$4.9k" },
  { name: "Bonus run / Pseudonymous", status: "Draft", amount: "$4.1k" },
];

const inboundRows = [
  { name: "API usage / Multi-wallet", status: "Streaming", amount: "$146" },
  { name: "Checkout link / Verified", status: "Settled", amount: "$2.1k" },
  { name: "B2B invoice / Company", status: "Pending", amount: "$9.8k" },
];

const howItWorks = [
  {
    title: "Manage your team and customers",
    description:
      "Add employees with salary details, onboard customers, and create billable products — all from one dashboard.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Collect payments via WalletConnect Pay",
    description:
      "Generate checkout links for your products. Customers pay in USDC from any wallet. Funds land in your treasury automatically.",
    icon: ReceiptText,
  },
  {
    title: "Run payroll on Arc",
    description:
      "Approve salary batches and advances. Chainlink CRE executes payments on-chain through the Payroll smart contract. Employees can request advances against their next paycheck.",
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
          {navLinks.map((l) => (
            <a
              key={l.name}
              href={l.href}
              className="text-sm transition-colors hover:opacity-70"
              style={{ color: "var(--tone-muted)" }}
            >
              {l.name}
            </a>
          ))}
          <LandingAuthButton />
        </div>
        <div className="md:hidden">
          <LandingAuthButton />
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section
        id="overview"
        className="mx-auto max-w-3xl px-6 pb-20 pt-16 text-center md:pt-24"
      >
        <h1 className="text-4xl font-light leading-tight tracking-tight md:text-5xl">
          Quiet infrastructure for
          <br />
          real-time money movement.
        </h1>
        <p
          className="mx-auto mt-5 max-w-xl text-base leading-relaxed"
          style={{ color: "var(--tone-muted)" }}
        >
          Private payroll, invoicing, and pay-as-you-go billing on Arc. One
          accounting surface for outbound operations and inbound revenue.
        </p>
        <div className="mt-8 flex justify-center">
          <LandingAuthButton />
        </div>
      </section>

      {/* ─── Product Lanes ─── */}
      <section id="model" className="mx-auto max-w-5xl px-6 pb-20">
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

        {/* Privacy states */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {privacyStates.map((s) => (
            <span
              key={s}
              className="rounded-full border px-3 py-1 text-xs"
              style={{
                borderColor: "var(--tone-border)",
                color: "var(--tone-muted)",
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* ─── Console Preview ─── */}
      <section id="console" className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="mb-6 text-center text-2xl font-light tracking-tight">
          One room for every money event.
        </h2>
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
                Outbound desk
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
                Inbound desk
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
      <section id="settlement" className="mx-auto max-w-4xl px-6 pb-20">
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

      {/* ─── Sponsors ─── */}
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
