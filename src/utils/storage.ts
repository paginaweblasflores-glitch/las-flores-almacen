import { supabase } from "../supabaseClient";
import { processImageFile, processImageToBlob } from "./image";

const BUCKET = "productos";

/**
 * Comprime la imagen y la sube a Supabase Storage; devuelve la URL
 * pública. Si Supabase no está configurado o la subida falla, cae de
 * vuelta a un data URL WebP para no bloquear el registro.
 */
export async function uploadProductImage(file: File): Promise<string> {
  if (!supabase) {
    return processImageFile(file);
  }

  try {
    const blob = await processImageToBlob(file);
    const name = `${crypto.randomUUID()}.webp`;
    const { error } = await supabase.storage.from(BUCKET).upload(name, blob, {
      contentType: "image/webp",
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
    return data.publicUrl;
  } catch (err) {
    console.error("Error subiendo imagen a Storage, se usa data URL:", err);
    return processImageFile(file);
  }
}
