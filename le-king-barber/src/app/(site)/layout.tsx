import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { getSiteData } from "@/lib/site-data";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { settings, gallery } = await getSiteData();
  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-ivoire focus:px-4 focus:py-2 focus:text-noir">
        Aller au contenu
      </a>
      <Header hasGallery={gallery.length > 0} />
      <main id="contenu">{children}</main>
      <Footer settings={settings} />
    </>
  );
}
