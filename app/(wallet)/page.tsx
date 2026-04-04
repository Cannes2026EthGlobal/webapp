import { LandingAuthButton } from "@/components/landing-auth-button";

export default function Page() {
  return (
    <section className="flex h-screen w-screen items-center justify-center">
      <div className="text-center max-w-xl">
        <h1 className="text-2xl font-semibold">arc-counting</h1>
        <p>
          SaaS accounting platform for private payment, payroll, invoicing, and
          real-time usage settlement
        </p>

        <div className="mt-4 flex justify-center items-center">
          <LandingAuthButton />
        </div>
      </div>
    </section>
  );
}
