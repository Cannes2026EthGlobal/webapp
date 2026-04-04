import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cookieToInitialState } from "wagmi";
import { config } from "@/config";

export default async function DashboardPage() {
  const headersList = await headers();
  const cookieHeader = headersList.get("cookie");
  const initialState = cookieToInitialState(config, cookieHeader);

  if (
    !initialState ||
    initialState.status !== "connected" ||
    !initialState.current ||
    initialState.connections.size === 0
  ) {
    redirect("/");
  }

  return null;
}
