export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-5 pb-24 pt-32 md:px-10 md:pt-40">
      <p className="label">Informations</p>
      <h1 className="mt-6 text-[clamp(2.4rem,7vw,4rem)] leading-none">{title}</h1>
      <div className="mt-12 space-y-10 leading-[1.8] text-ivoire/75 [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-ivoire [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </article>
  );
}

export function Missing({ value }: { value: string | null | undefined }) {
  return value ? <>{value}</> : <span className="italic text-ivoire/40">à compléter</span>;
}
