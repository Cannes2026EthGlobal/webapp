import { headers } from "next/headers";
import ContextProvider from "@/context";

export default async function WalletLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const cookies = headersList.get("cookie");

  return <ContextProvider cookies={cookies}>{children}</ContextProvider>;
}
