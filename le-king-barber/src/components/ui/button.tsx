import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "solid" | "outline" | "ghost" | "dark";

const base =
  "inline-flex items-center justify-center gap-3 px-7 py-4 text-[12px] font-semibold uppercase tracking-[0.22em] transition-all duration-500 ease-lux disabled:cursor-not-allowed disabled:opacity-40";

const variants: Record<Variant, string> = {
  solid: "bg-ivoire text-noir hover:bg-champagne",
  outline: "border border-ivoire/30 text-ivoire hover:border-champagne hover:text-champagne",
  ghost: "px-0 py-2 text-ivoire/80 hover:text-champagne",
  dark: "bg-noir text-ivoire hover:bg-graphite",
};

export function buttonClass(variant: Variant = "solid", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

export function ButtonLink({ variant = "solid", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function Button({ variant = "solid", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 8" className={`h-2 w-6 ${className}`} fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M0 4h23M19 0.5 23 4l-4 3.5" />
    </svg>
  );
}
