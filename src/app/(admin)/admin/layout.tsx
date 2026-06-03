import { requireUser } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser(["admin"]);

  return children;
}
