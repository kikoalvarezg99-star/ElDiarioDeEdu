import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type Rendered = { blob: Blob; ext: "webp" | "jpg" };
type Source = ImageBitmap | HTMLImageElement;

/** Lee la imagen elegida (respeta la orientación del móvil). */
async function decode(file: File): Promise<Source> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Se prueba el método alternativo
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se ha podido leer la imagen"));
    };
    img.src = url;
  });
}

async function render(src: Source, maxSide: number, quality: number): Promise<Rendered> {
  const sw = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const sh = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se ha podido preparar la imagen");
  ctx.drawImage(src, 0, 0, w, h);

  const toBlob = (type: string, q: number) =>
    new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));

  const webp = await toBlob("image/webp", quality);
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpg = await toBlob("image/jpeg", quality);
  if (!jpg) throw new Error("No se ha podido comprimir la imagen");
  return { blob: jpg, ext: "jpg" };
}

export type Uploaded = { path: string; thumbPath: string; size: number };

/**
 * Comprime la foto en el propio móvil (una foto de 4-6 MB queda en unos
 * cientos de KB), crea una miniatura y sube ambas al almacenamiento privado.
 * - "progress": fotos de progreso (calidad alta)
 * - "food": diario de comidas (más pequeñas, para ahorrar espacio)
 */
export async function uploadPhoto(
  file: File,
  clinicId: string,
  clientId: string,
  folder: "progress" | "food",
): Promise<Uploaded> {
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo no es una imagen");
  }
  const big = folder === "food" ? { side: 1024, q: 0.7 } : { side: 1600, q: 0.8 };
  const src = await decode(file);
  const full = await render(src, big.side, big.q);
  const thumb = await render(src, folder === "food" ? 320 : 400, 0.7);
  if (typeof ImageBitmap !== "undefined" && src instanceof ImageBitmap) src.close();

  const id = crypto.randomUUID();
  const base = `${clinicId}/${clientId}/${folder}/${id}`;
  const path = `${base}.${full.ext}`;
  const thumbPath = `${base}_t.${thumb.ext}`;

  const bucket = supabase.storage.from("photos");
  const up1 = await bucket.upload(path, full.blob, {
    contentType: full.blob.type,
    cacheControl: "3600",
  });
  if (up1.error) throw new Error(up1.error.message);
  const up2 = await bucket.upload(thumbPath, thumb.blob, {
    contentType: thumb.blob.type,
    cacheControl: "3600",
  });
  if (up2.error) {
    await bucket.remove([path]);
    throw new Error(up2.error.message);
  }
  return { path, thumbPath, size: full.blob.size };
}

/**
 * Direcciones temporales (10 minutos) para ver archivos privados.
 * Sin sesión y sin permiso no se genera ninguna: cambiar una URL no sirve.
 */
export function useSignedUrls(paths: string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.join("|");

  useEffect(() => {
    let active = true;
    const todo = key ? key.split("|") : [];
    if (todo.length === 0) {
      setUrls({});
      return;
    }
    supabase.storage
      .from("photos")
      .createSignedUrls(todo, 600)
      .then(({ data }) => {
        if (!active || !data) return;
        const map: Record<string, string> = {};
        data.forEach((d) => {
          if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
        });
        setUrls(map);
      });
    return () => {
      active = false;
    };
  }, [key]);

  return urls;
}
