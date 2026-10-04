import { InstitutionalMapRenderer } from '../document-engine/InstitutionalMapRenderer';
import type { ScinceCoverMapPlan } from './scinceReportCover';

export interface CoverCanvas {
  context: CanvasRenderingContext2D;
  png(): Promise<Uint8Array>;
}
/** Uses the existing map engine; acquisition completes before DOCX/PDF rendering. */
export async function materializeScinceCoverMap(plan: ScinceCoverMapPlan, create?: () => CoverCanvas) {
  let canvas: CoverCanvas;
  if (create) canvas = create();
  else {
    if (typeof document === 'undefined') throw new Error('SCINCE_COVER_CANVAS_REQUIRED');
    const element = document.createElement('canvas'); element.width = 1280; element.height = 960;
    const context = element.getContext('2d'); if (!context) throw new Error('SCINCE_COVER_CANVAS_REQUIRED');
    canvas = { context, png: async () => new Uint8Array(await (await new Promise<Blob>((resolve, reject) => element.toBlob(b => b ? resolve(b) : reject(new Error('SCINCE_COVER_RASTER_FAILED')), 'image/png'))).arrayBuffer()) };
  }
  InstitutionalMapRenderer.drawScinceCover(canvas.context, plan);
  const data = await canvas.png();
  if (data.length < 1024 || data[0] !== 137 || data[1] !== 80) throw new Error('SCINCE_COVER_RASTER_REQUIRED');
  return { data, type: 'png' as const, width: 480, height: 360 };
}
