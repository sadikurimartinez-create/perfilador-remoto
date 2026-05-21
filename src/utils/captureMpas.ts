import html2canvas from 'html2canvas';

export const captureMapImage = async (
  elementId: string
): Promise<string | null> => {

  const mapElement = document.getElementById(elementId);

  if (!mapElement) {
    console.error('Mapa no encontrado');
    return null;
  }

  try {

    const canvas = await html2canvas(mapElement, {
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    return canvas.toDataURL('image/png');

  } catch (error) {

    console.error('Error capturando mapa:', error);

    return null;
  }
};