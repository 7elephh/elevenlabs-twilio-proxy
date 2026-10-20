"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { ActionResult } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const MAX_SIDE = 2400;

/** Redimensionne l'image dans le navigateur avant envoi (poids réduit, EXIF retiré). */
async function prepare(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Format non pris en charge.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
  if (!blob) throw new Error("Conversion impossible.");
  return blob;
}

export function ImageUpload({
  folder,
  label,
  withAlt = false,
  onUploaded,
}: {
  folder: "gallery" | "hero" | "barber";
  label: string;
  withAlt?: boolean;
  onUploaded: (path: string, alt: string) => Promise<ActionResult>;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const altRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setStatus("Choisissez une image.");
    if (withAlt && !altRef.current?.value.trim()) return setStatus("Ajoutez une courte description (accessibilité).");
    setBusy(true);
    setStatus("Envoi…");
    try {
      const blob = await prepare(file);
      const path = `${folder}/${crypto.randomUUID()}.webp`;
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.storage.from("site-media").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (error) throw new Error(error.message);
      const r = await onUploaded(path, altRef.current?.value ?? "");
      setStatus(r?.message ?? "Image envoyée.");
      if (fileRef.current) fileRef.current.value = "";
      if (altRef.current) altRef.current.value = "";
      router.refresh();
    } catch (e) {
      setStatus(e instanceof Error ? `Erreur : ${e.message}` : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-ivoire/60">{label}</span>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="block w-full text-sm text-ivoire/70 file:mr-4 file:border file:border-ivoire/20 file:bg-transparent file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-[0.14em] file:text-ivoire" />
      </label>
      {withAlt && (
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-ivoire/60">Description de la photo</span>
          <input ref={altRef} maxLength={200} placeholder="Ex. dégradé à blanc et barbe taillée" className="w-full border border-ivoire/15 bg-noir px-3 py-2.5 text-[15px] focus:border-champagne focus:outline-none" />
        </label>
      )}
      <button type="button" onClick={upload} disabled={busy} className="bg-ivoire px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-noir hover:bg-champagne disabled:opacity-50">
        {busy ? "Envoi…" : "Envoyer"}
      </button>
      {status && <p role="status" className="text-sm text-champagne">{status}</p>}
    </div>
  );
}
