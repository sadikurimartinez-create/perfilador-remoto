export interface ImageDimensions {
  width: number;
  height: number;
}

export class ImageManager {
  static scaleToWidth(originalWidth: number, originalHeight: number, maxWidth = 450): ImageDimensions {
    if (originalWidth <= maxWidth) {
      return { width: originalWidth, height: originalHeight };
    }
    const ratio = maxWidth / originalWidth;
    return {
      width: maxWidth,
      height: Math.round(originalHeight * ratio),
    };
  }

  static validateImage(dataUrl: string): boolean {
    return !!dataUrl && dataUrl.startsWith("data:image/");
  }
}
