"use client";

import { addGalleryImageAction, saveSettingsAction } from "@/actions/admin/site";

import { ImageUpload } from "./image-upload";

function setImage(field: "hero_image_path" | "barber_photo_path") {
  return async (path: string) => {
    const form = new FormData();
    form.set(field, path);
    return saveSettingsAction(null, form);
  };
}

export function HeroUpload() {
  return <ImageUpload folder="hero" label="Photo d'ambiance (accueil)" onUploaded={setImage("hero_image_path")} />;
}

export function BarberUpload() {
  return <ImageUpload folder="barber" label="Portrait du barbier" onUploaded={setImage("barber_photo_path")} />;
}

export function GalleryUpload() {
  return <ImageUpload folder="gallery" label="Ajouter une photo" withAlt onUploaded={addGalleryImageAction} />;
}

export function RemoveImageButton({ field }: { field: "hero_image_path" | "barber_photo_path" }) {
  return (
    <form
      action={async () => {
        const form = new FormData();
        form.set(field, "");
        await saveSettingsAction(null, form);
        location.reload();
      }}
    >
      <button className="text-xs text-red-300 hover:text-red-200">Retirer l&apos;image</button>
    </form>
  );
}
