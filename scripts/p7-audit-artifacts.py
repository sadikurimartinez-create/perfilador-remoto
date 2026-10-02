"""Offline physical comparison and page rasterization; no acquisition or persistence."""
from pathlib import Path
from collections import Counter
from zipfile import ZipFile
import hashlib, json, re, subprocess, sys, xml.etree.ElementTree as ET
from pypdf import PdfReader
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding="utf-8")
root = Path("artifacts/P7-offline")
reuse_raster = "--reuse-raster" in sys.argv
poppler = Path(r"C:\Users\sadi7\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe")
normalize = lambda s: re.sub(r"\s+", "", s).replace("\u00ad", "")
audit = {"liveReads": 0, "liveWrites": 0, "state": "GENERATED", "certified": False, "published": False, "fixtures": []}
for directory in sorted(p for p in root.iterdir() if p.is_dir()):
    if not (directory / "parity.json").exists(): continue
    record = {"fixture": directory.name, "artifacts": [], "comparison": []}
    parity = json.loads((directory / "parity.json").read_text(encoding="utf-8"))
    for kind in ["executive", "annex"]:
        for ext in ["docx", "pdf"]:
            path = directory / f"{kind}.{ext}"
            record["artifacts"].append({"file": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "sizeBytes": path.stat().st_size})
        paragraphs = parity[kind]["textBlocks"]
        for suffix in ["", ".word-reference"]:
            pdf = directory / f"{kind}{suffix}.pdf"
            reader = PdfReader(pdf)
            pages = [p.extract_text() for p in reader.pages]
            text = normalize(" ".join(pages))
            missing = [p for p in paragraphs if normalize(p) not in text]
            sizes = [list(p.mediabox) for p in reader.pages]
            empty = [i + 1 for i, t in enumerate(pages) if not t.strip()]
            numbers = Counter(re.findall(r"\b\d+(?:[.,]\d+)?\b", " ".join(paragraphs)))
            actual_numbers = Counter(re.findall(r"\b\d+(?:[.,]\d+)?\b", " ".join(pages)))
            comparison = {"kind": kind, "renderer": "WORD_DOCX" if suffix else "INSTITUTIONAL_PDF", "pageCount": len(pages), "emptyPages": empty,
                          "letterPortrait": all(s == [0, 0, 612, 792] for s in sizes), "missingTextBlocks": missing,
                          "missingNumericTokens": dict(numbers - actual_numbers), "inspection": "PENDING_VISUAL_REVIEW", "pages": []}
            pngdir = directory / f"{kind}{suffix}.pages"; pngdir.mkdir(exist_ok=True)
            # Poppler pads filenames when a document reaches ten pages. Remove
            # only prior generated page/contact PNGs to prevent stale duplicates.
            if not pngdir.resolve().is_relative_to(root.resolve()):
                raise ValueError("QA output escapes artifact root")
            expected_pngs = {pngdir / f"page-{str(i).zfill(len(str(len(pages))))}.png" for i in range(1, len(pages) + 1)}
            if reuse_raster and not all(p.exists() for p in expected_pngs):
                raise ValueError("Incomplete existing raster set")
            for prior in list(pngdir.glob("page-*.png")) + list(pngdir.glob("review-*.png")):
                if reuse_raster and prior in expected_pngs:
                    continue
                prior.unlink()
            if not reuse_raster:
                subprocess.run([str(poppler), "-r", "120", "-png", str(pdf), str(pngdir / "page")], check=True, capture_output=True)
            pngs = sorted((p for p in pngdir.glob("page-*.png") if int(p.stem.split("-")[-1]) <= len(pages)), key=lambda p: int(p.stem.split("-")[-1]))
            comparison["pages"] = [str(p) for p in pngs]
            for start in range(0, len(pngs), 2):
                sheet = Image.new("RGB", (2040, 1360), "#e5e7eb"); draw = ImageDraw.Draw(sheet)
                for index, path in enumerate(pngs[start:start + 2]):
                    image = Image.open(path); sheet.paste(image, (index * 1020, 40))
                    draw.text((index * 1020 + 12, 12), f"{directory.name} {kind}{suffix} page {start + index + 1}", fill="black")
                sheet.save(pngdir / f"review-{start // 2 + 1:02d}.png")
            record["comparison"].append(comparison)
    audit["fixtures"].append(record)
(root / "physical-audit.json").write_text(json.dumps(audit, indent=2, ensure_ascii=False), encoding="utf-8")
for f in audit["fixtures"]:
    print(f["fixture"], [(c["kind"], c["renderer"], c["pageCount"], len(c["missingTextBlocks"]), c["emptyPages"]) for c in f["comparison"]])
