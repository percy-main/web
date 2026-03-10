/**
 * Compress and resize an image file client-side using canvas.
 * Returns a base64 data URL (JPEG).
 */
export function compressImage(
  file: File,
  opts: { maxDimension: number; maxBytes: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        if (width > opts.maxDimension || height > opts.maxDimension) {
          if (width > height) {
            height = Math.round((height * opts.maxDimension) / width);
            width = opts.maxDimension;
          } else {
            width = Math.round((width * opts.maxDimension) / height);
            height = opts.maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.8;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);

        while (dataUrl.length > opts.maxBytes && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        if (dataUrl.length > opts.maxBytes) {
          reject(
            new Error(
              "Image is too large even after compression. Please use a smaller image.",
            ),
          );
          return;
        }

        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      const result = e.target?.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected FileReader result type"));
        return;
      }
      img.src = result;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
