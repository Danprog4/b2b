import { requireUser } from "@/lib/auth/session";

export default async function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser(["buyer"]);

  return children;
}
