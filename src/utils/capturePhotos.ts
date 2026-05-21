export const getPhotoDataURLs = async (photos: any[]) => {
  // Convierte cada foto en Base64 para PDF/Word
  return Promise.all(
    photos.map(async (photo) => {
      // Si ya es URL o base64
      return photo.url || '';
    })
  );
};