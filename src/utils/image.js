/**
 * Resize an image file down to a small square JPEG and return it as a
 * base64 data URL. Used so profile photos can be stored directly as a
 * field on the Firestore user document (no Firebase Storage / billing
 * plan required).
 */
export const resizeImageToDataUrl = (file, maxSize = 256, quality = 0.72) => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !file) {
      reject(new Error('Tidak ada file gambar.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File bukan gambar yang valid.'));
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          const dataUrl = canvas.toDataURL('image/jpeg', quality);

          // Firestore documents are capped at ~1MiB; keep well under that.
          if (dataUrl.length > 700_000) {
            reject(new Error('Gambar masih terlalu besar setelah dikompres. Coba gambar lain.'));
            return;
          }
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
};
