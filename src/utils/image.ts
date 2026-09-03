const MAX_IMAGE_SIZE = 500;
const WEBP_QUALITY = 0.82;

async function drawResized(file: File): Promise<HTMLCanvasElement> {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No se pudo crear el contexto de imagen.");
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

/** Redimensiona y comprime a un data URL WebP (respaldo sin Storage). */
export async function processImageFile(file: File): Promise<string> {
  const canvas = await drawResized(file);
  return canvas.toDataURL("image/webp", WEBP_QUALITY);
}

/** Redimensiona y comprime a un Blob WebP (para subir a Storage). */
export async function processImageToBlob(file: File): Promise<Blob> {
  const canvas = await drawResized(file);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo comprimir la imagen."))),
      "image/webp",
      WEBP_QUALITY
    );
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo cargar la imagen."));
    image.src = source;
  });
}
