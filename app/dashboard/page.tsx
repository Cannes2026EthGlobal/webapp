import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardAuthGuard } from "@/components/dashboard-auth-guard";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const isAuthorized = cookieStore.get("arc-counting-auth")?.value === "1";

  if (!isAuthorized) {
    redirect("/");
  }

  return (
    <DashboardAuthGuard>
      <main className="flex min-h-screen items-center justify-center">
        <h1 className="text-4xl font-semibold">hello world</h1>
      </main>
    </DashboardAuthGuard>
  );
}
