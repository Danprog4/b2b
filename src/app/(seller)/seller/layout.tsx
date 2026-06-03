import { requireUser } from "@/lib/auth/session";

export default async function SellerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser(["seller"]);

  return children;
}
