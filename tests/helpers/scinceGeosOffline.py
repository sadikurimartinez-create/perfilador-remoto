"""QA-only: installed GEOS C API, memory-only synthetic fixtures, no DB or network."""
import argparse
import ctypes as C
import json
import math
import os
from pathlib import Path


def xy(x, y):
    return f"{-102 + x / 1000:.6f} {21 + y / 1000:.6f}"


def ring(points):
    return ", ".join(xy(*p) for p in points)


def rect(x0, y0, x1, y1):
    return "POLYGON ((" + ring([(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]) + "))"


def line(points):
    return "LINESTRING (" + ring(points) + ")"


def fixtures():
    u = rect(0, 0, 10, 10)
    hole = "POLYGON ((" + ring([(0, 0), (10, 0), (10, 10), (0, 10), (0, 0)]) + "), (" + ring([(3, 3), (3, 7), (7, 7), (7, 3), (3, 3)]) + "))"
    multi = "MULTIPOLYGON (" + rect(0, 0, 4, 4)[8:] + ", " + rect(8, 0, 12, 4)[8:] + ")"
    data = []

    def add(case, mode, g, unit, expected, description, srid=4326):
        data.append(dict(case=case, mode=mode, analysisWkt=g, unitWkt=unit, analysisSrid=srid,
                         unitSrid=4326, expected=expected, description=description))

    for case, pts, expected, description in [
        ("L1", [(-3, -2), (-1, -1)], "DISJOINT", "Completamente fuera"),
        ("L2", [(-2, -2), (0, 0)], "TOUCHES_ONLY", "Sólo vértice"),
        ("L3", [(-2, 5), (0, 5)], "TOUCHES_ONLY", "Sólo borde, sin tramo interior"),
        ("L4", [(10, 5), (12, 5)], "TOUCHES_ONLY", "Endpoint en borde, resto fuera"),
        ("L5", [(0, 5), (5, 5)], "UNIT_COVERS_ANALYSIS", "Endpoint en borde, resto dentro"),
        ("L6", [(2, 2), (8, 8)], "UNIT_COVERS_ANALYSIS", "Completamente dentro"),
        ("L7", [(-2, 5), (12, 5)], "INTERIOR_INTERSECTION", "Entra y sale"),
        ("L9", [(-2, 0), (5, 0)], "TOUCHES_ONLY", "Coincidencia parcial con borde y resto fuera"),
        ("L10", [(2, 0), (8, 0)], "TOUCHES_ONLY", "Coincide totalmente con segmento de borde"),
        ("L14", [(1, 1), (9, 9), (1, 9), (9, 1)], "INVALID", "Auto-intersección; válido GEOS pero no simple"),
        ("L15", [(2, 2), (2, 2)], "INVALID", "Degenerada, longitud cero"),
    ]:
        add(case, "CORRIDOR", line(pts), u, expected, description)
    add("L8-A", "CORRIDOR", line([(5, 5), (15, 5)]), u, "INTERIOR_INTERSECTION", "Dos unidades adyacentes: A")
    add("L8-B", "CORRIDOR", line([(5, 5), (15, 5)]), rect(10, 0, 20, 10), "INTERIOR_INTERSECTION", "Dos unidades adyacentes: B")
    add("L11", "CORRIDOR", line([(1, 5), (9, 5)]), hole, "INTERIOR_INTERSECTION", "Atraviesa hueco y superficie fuera de hueco")
    add("L12", "CORRIDOR", line([(4, 5), (6, 5)]), hole, "DISJOINT", "Completamente dentro del hueco")
    add("L13", "CORRIDOR", line([(-1, 2), (13, 2)]), multi, "INTERIOR_INTERSECTION", "Cruza ambos componentes sin colapsarlos")
    add("L9-IN", "CORRIDOR", line([(0, 2), (0, 5), (5, 5)]), u, "UNIT_COVERS_ANALYSIS", "Borde parcial con tramo interior; no sólo contacto")

    for case, g, unit, expected, description in [
        ("P1", rect(12, 12, 14, 14), u, "DISJOINT", "Fuera"),
        ("P2", rect(10, 10, 12, 12), u, "TOUCHES_ONLY", "Contacto en vértice"),
        ("P3", rect(10, 2, 12, 8), u, "TOUCHES_ONLY", "Contacto en borde"),
        ("P4", rect(8, 2, 12, 8), u, "INTERIOR_INTERSECTION", "Intersección parcial"),
        ("P5", rect(2, 2, 8, 8), u, "UNIT_COVERS_ANALYSIS", "Análisis contenido"),
        ("P6", rect(-2, -2, 12, 12), u, "ANALYSIS_COVERS_UNIT", "Unidad cubierta"),
        ("P7", u, u, "EQUAL_FOOTPRINT", "Igualdad exacta"),
        ("P8", rect(5, 5, 15, 15), u, "INTERIOR_INTERSECTION", "Dos polígonos parcialmente solapados"),
        ("P9", hole, rect(4, 4, 6, 6), "DISJOINT", "Hueco excluye unidad"),
        ("P10", hole, rect(3.5, 3.5, 6.5, 6.5), "DISJOINT", "Unidad dentro del hueco"),
        ("P11", hole, rect(2, 4, 5, 6), "INTERIOR_INTERSECTION", "Unidad cruza borde de hueco"),
        ("P12-A", multi, rect(1, 1, 2, 2), "ANALYSIS_COVERS_UNIT", "Unidad componente A"),
        ("P12-B", multi, rect(9, 1, 10, 2), "ANALYSIS_COVERS_UNIT", "Unidad componente B"),
        ("P13", multi, rect(5, 1, 7, 3), "DISJOINT", "Unidad entre componentes, dentro del bbox"),
        ("P14", "POLYGON ((" + ring([(1, 1), (9, 9), (1, 9), (9, 1), (1, 1)]) + "))", u, "INVALID", "Bow-tie"),
        ("P15", "POLYGON ((" + ring([(1, 1), (9, 1), (9, 9), (1, 9)]) + "))", u, "INVALID", "Anillo no cerrado"),
        ("P16", "POLYGON ((" + ring([(10, 10), (10, 0), (0, 0), (0, 10), (10, 10)]) + "))", u, "EQUAL_FOOTPRINT", "Orden equivalente topológicamente"),
    ]:
        add(case, "POLYGON", g, unit, expected, description)
    for case, mode, g, unit, description in [
        ("I1", "CORRIDOR", "LINESTRING (-102 21)", u, "Una coordenada"),
        ("I2", "POLYGON", "POLYGON EMPTY", u, "Polygon vacío"),
        ("I3", "POLYGON", "MULTIPOLYGON EMPTY", u, "MultiPolygon vacío"),
        ("I4", "CORRIDOR", "LINESTRING (-102 21, NaN 21.001)", u, "NaN"),
        ("I5", "CORRIDOR", "LINESTRING (-102 21, Infinity 21.001)", u, "Infinity"),
        ("I6", "POLYGON", "POLYGON ((" + ring([(1, 1), (2, 1), (3, 1), (1, 1)]) + "))", u, "Polígono collinear degenerado, y idéntica"),
        ("I7", "POLYGON", u, "POLYGON EMPTY", "Unidad vacía"),
        ("I8", "POLYGON", u, "POLYGON ((" + ring([(1, 1), (9, 9), (1, 9), (9, 1), (1, 1)]) + "))", "Unidad inválida"),
    ]:
        add(case, mode, g, unit, "INVALID", description)
    add("C1", "POLYGON", u, u, "INVALID", "CRS distinto; no transformación oculta", srid=3857)
    return data


class Geos:
    def __init__(self):
        directory = os.environ.get("SCINCE_QA_GEOS_DIR", "C:/Program Files/PostgreSQL/15/bin")
        self.directory_handle = os.add_dll_directory(directory) if os.name == "nt" else None
        self.lib = C.CDLL(str(Path(directory) / ("libgeos_c.dll" if os.name == "nt" else "libgeos_c.so")))
        self.lib.GEOSversion.restype = C.c_char_p
        self.version = self.lib.GEOSversion().decode()
        def bind(name, result, args):
            fn = getattr(self.lib, name); fn.restype = result; fn.argtypes = args
            return fn
        ptr = C.c_void_p
        self.init = bind("GEOS_init_r", ptr, [])
        self.ctx = self.init()
        self.finish = bind("GEOS_finish_r", None, [ptr])
        self.create_reader = bind("GEOSWKTReader_create_r", ptr, [ptr])
        self.reader = self.create_reader(self.ctx)
        self.read = bind("GEOSWKTReader_read_r", ptr, [ptr, ptr, C.c_char_p])
        self.destroy = bind("GEOSGeom_destroy_r", None, [ptr, ptr])
        self.destroy_reader = bind("GEOSWKTReader_destroy_r", None, [ptr, ptr])
        self.srid = bind("GEOSSetSRID_r", None, [ptr, ptr, C.c_int])
        self.valid = bind("GEOSisValid_r", C.c_byte, [ptr, ptr])
        self.simple = bind("GEOSisSimple_r", C.c_byte, [ptr, ptr])
        self.empty = bind("GEOSisEmpty_r", C.c_byte, [ptr, ptr])
        self.area = bind("GEOSArea_r", C.c_int, [ptr, ptr, C.POINTER(C.c_double)])
        self.predicates = {n: bind("GEOS" + n + "_r", C.c_byte, [ptr, ptr, ptr]) for n in ["Intersects", "Touches", "Covers", "Contains", "Equals"]}
        self.relate = bind("GEOSRelate_r", ptr, [ptr, ptr, ptr])
        self.free = bind("GEOSFree_r", None, [ptr, ptr])
        self.writer = bind("GEOSGeoJSONWriter_create_r", ptr, [ptr])(self.ctx)
        self.write_json = bind("GEOSGeoJSONWriter_writeGeometry_r", ptr, [ptr, ptr, ptr, C.c_int])
        self.destroy_writer = bind("GEOSGeoJSONWriter_destroy_r", None, [ptr, ptr])
        self.errors = []
        self.callback_type = C.CFUNCTYPE(None, C.c_char_p, ptr)
        self.callback = self.callback_type(lambda message, _: self.errors.append(message.decode()))
        for name in ["GEOSContext_setErrorMessageHandler_r", "GEOSContext_setNoticeMessageHandler_r"]:
            bind(name, ptr, [ptr, self.callback_type, ptr])(self.ctx, self.callback, None)

    def flags(self, geometry):
        if not geometry:
            return dict(parsed=False, valid=None, simple=None, empty=None, area=None)
        area = C.c_double()
        ok = self.area(self.ctx, geometry, C.byref(area))
        return dict(parsed=True, valid=self.valid(self.ctx, geometry) == 1,
                    simple=self.simple(self.ctx, geometry) == 1, empty=self.empty(self.ctx, geometry) == 1,
                    area=area.value if ok == 1 and math.isfinite(area.value) else None)

    def execute(self, case):
        self.errors.clear()
        g = self.read(self.ctx, self.reader, case["analysisWkt"].encode())
        u = self.read(self.ctx, self.reader, case["unitWkt"].encode())
        try:
            if g: self.srid(self.ctx, g, case["analysisSrid"])
            if u: self.srid(self.ctx, u, case["unitSrid"])
            gf, uf = self.flags(g), self.flags(u)
            rejected = (case["analysisSrid"] != 4326 or case["unitSrid"] != 4326 or
                        any(not f["parsed"] or not f["valid"] or f["empty"] for f in [gf, uf]) or
                        any(s in case["analysisWkt"] + case["unitWkt"] for s in ["NaN", "Infinity"]) or
                        not uf["area"] or case["mode"] == "POLYGON" and not gf["area"] or
                        case["mode"] == "CORRIDOR" and not gf["simple"])
            p = {n: None for n in ["intersects", "touches", "coversGU", "coversUG", "containsGU", "containsUG", "equals", "relate"]}
            classification = "INVALID"
            line_behavior = None
            geojson = None
            unit_geojson = None
            def encode(geometry):
                encoded = self.write_json(self.ctx, self.writer, geometry, -1)
                if not encoded: raise RuntimeError("GEOS GeoJSON exception")
                try: return json.loads(C.string_at(encoded).decode())
                finally: self.free(self.ctx, encoded)
            if g and not any(s in case["analysisWkt"] for s in ["NaN", "Infinity"]): geojson = encode(g)
            if u: unit_geojson = encode(u)
            if not rejected:
                for field, name, a, b in [("intersects", "Intersects", g, u), ("touches", "Touches", g, u),
                    ("coversGU", "Covers", g, u), ("coversUG", "Covers", u, g),
                    ("containsGU", "Contains", g, u), ("containsUG", "Contains", u, g), ("equals", "Equals", g, u)]:
                    value = self.predicates[name](self.ctx, a, b)
                    if value not in [0, 1]: raise RuntimeError("GEOS predicate exception")
                    p[field] = value == 1
                matrix = self.relate(self.ctx, g, u)
                if not matrix: raise RuntimeError("GEOS Relate exception")
                try: p["relate"] = C.string_at(matrix).decode()
                finally: self.free(self.ctx, matrix)
                if not p["intersects"]: classification = "DISJOINT"
                elif p["touches"] and p["relate"][0] == "F": classification = "TOUCHES_ONLY"
                elif p["coversGU"] and p["coversUG"] and p["equals"]: classification = "EQUAL_FOOTPRINT"
                elif p["coversGU"] and case["mode"] == "POLYGON": classification = "ANALYSIS_COVERS_UNIT"
                elif p["coversUG"]: classification = "UNIT_COVERS_ANALYSIS"
                elif p["relate"][0] == ("1" if case["mode"] == "CORRIDOR" else "2"): classification = "INTERIOR_INTERSECTION"
                else: classification = "AMBIGUOUS"
                if case["mode"] == "CORRIDOR":
                    line_behavior = "OUTSIDE" if classification == "DISJOINT" else "BOUNDARY_CONTACT" if classification == "TOUCHES_ONLY" else "CONTAINED" if p["coversUG"] else "INTERIOR_AND_EXTERIOR" if p["relate"][0] == "1" and p["relate"][2] == "1" else "UNRESOLVED"
            return {**case, **p, "analysisFlags": gf, "unitFlags": uf, "classification": classification,
                    "lineBehavior": line_behavior, "pass": classification == case["expected"],
                    "analysisGeometry": geojson,
                    "unitGeometry": unit_geojson,
                    "usage": "ENUMERATION_ONLY" if classification == "TOUCHES_ONLY" else None,
                    "errors": list(self.errors)}
        finally:
            if g: self.destroy(self.ctx, g)
            if u: self.destroy(self.ctx, u)

    def close(self):
        self.destroy_writer(self.ctx, self.writer); self.destroy_reader(self.ctx, self.reader); self.finish(self.ctx)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    parser.add_argument("--fixtures", type=Path)
    args = parser.parse_args()
    engine = Geos()
    try:
        cases = fixtures()
        result = dict(engine="GEOS C API (no PostgreSQL connection)", version=engine.version,
                      srid=4326, cases=[engine.execute(c) for c in cases])
    finally:
        engine.close()
    encoded = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded, encoding="utf8")
    if args.fixtures:
        args.fixtures.parent.mkdir(parents=True, exist_ok=True)
        args.fixtures.write_text(json.dumps(cases, ensure_ascii=False, indent=2), encoding="utf8")
    print(encoded)


if __name__ == "__main__":
    main()
