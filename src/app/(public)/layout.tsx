import { PublicHeader } from "@/components/public/public-header";
import { SiteFooter } from "@/components/public/site-footer";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <PublicHeader />
      {children}
      <SiteFooter />
    </>
  );
}
