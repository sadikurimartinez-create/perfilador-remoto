"""Reproducible synthetic P7 rasters. Coordinates match p7StoredProject; no basemap/provider."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

root = Path('tests/fixtures/p7')
root.mkdir(parents=True, exist_ok=True)
geometries = {
    'INDIVIDUAL': {'type': 'Point', 'coordinates': [-102.291, 21.881]},
    'CORRIDOR': {'type': 'LineString', 'coordinates': [[-102.291, 21.881], [-102.28, 21.9], [-102.27, 21.92]]},
    'POLYGON': {'type': 'Polygon', 'coordinates': [
        [[-102.30, 21.88], [-102.28, 21.88], [-102.28, 21.90], [-102.30, 21.90], [-102.30, 21.88]],
        [[-102.295, 21.885], [-102.295, 21.895], [-102.285, 21.895], [-102.285, 21.885], [-102.295, 21.885]],
    ]},
}
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 25)
for mode, geometry in geometries.items():
    points = [geometry['coordinates']] if mode == 'INDIVIDUAL' else geometry['coordinates'] if mode == 'CORRIDOR' else geometry['coordinates'][0]
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    span = max(max(xs)-min(xs), max(ys)-min(ys), .01)
    cx, cy = (min(xs)+max(xs))/2, (min(ys)+max(ys))/2
    def xy(p): return (500+(p[0]-cx)*300/span, 280-(p[1]-cy)*300/span)
    image = Image.new('RGB', (1000, 560), '#f3f6fa'); draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 1000, 58), fill='#0d2b52')
    draw.text((24, 15), f'QA OFFLINE | E2E-{mode}', fill='white', font=font)
    for x in range(100, 951, 100): draw.line((x, 85, x, 475), fill='#c3cad2', width=1)
    for y in range(100, 476, 75): draw.line((50, y, 950, y), fill='#c3cad2', width=1)
    if mode == 'INDIVIDUAL':
        x, y = xy(points[0]); draw.ellipse((x-12, y-12, x+12, y+12), fill='#b12c44')
    elif mode == 'CORRIDOR':
        draw.line([xy(p) for p in points], fill='#0d2b52', width=7)
        for p in points:
            x, y = xy(p); draw.ellipse((x-5, y-5, x+5, y+5), fill='#0d2b52')
    else:
        draw.polygon([xy(p) for p in geometry['coordinates'][0]], fill='#d7e2f0', outline='#0d2b52', width=7)
        draw.polygon([xy(p) for p in geometry['coordinates'][1]], fill='#f3f6fa', outline='#0d2b52', width=5)
        draw.text((420, 265), 'Hueco', fill='#0d2b52', font=font)
    x, y = xy([-102.291, 21.881]); draw.ellipse((x-5, y-5, x+5, y+5), fill='#16856b')
    draw.text((24, 510), 'Geometria canonica | azul: linea/anillos | verde: DENUE contextual', fill='#222222', font=font)
    image.save(root / f'map-{mode}.png')
(root / 'map-geometries.json').write_text(json.dumps(geometries, indent=2), encoding='utf-8')
