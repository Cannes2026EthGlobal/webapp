import { Demo } from "@/components/demo"
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <section className="w-screen h-screen flex items-center justify-center">
      <div className="text-center max-w-xl">
        <h1 className="text-2xl font-semibold">arc-counting</h1>
        <p>SaaS accounting platform for private payment, payroll, invoicing, and real-time usage settlement </p>

        <div className="mt-4 flex justify-center items-center">
          <Button>login</Button>
        </div>
      </div>
    </section>
  );
}