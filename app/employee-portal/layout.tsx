import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardAuthGuard } from "@/components/dashboard-auth-guard";

const AUTH_COOKIE = "arc-counting-auth";

export default async function EmployeePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  if (cookieStore.get(AUTH_COOKIE)?.value !== "1") {
    redirect("/");
  }
  return <DashboardAuthGuard>{children}</DashboardAuthGuard>;
}
