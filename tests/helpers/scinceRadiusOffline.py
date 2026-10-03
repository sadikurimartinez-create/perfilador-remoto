"""Synthetic, memory-only metric PROJ/GEOS fixtures. Never connects to PostgreSQL.
SQL orchestration is mocked by Jest; this certifies engine geometry, not deployed PostGIS."""
import ctypes as C
import json
import math
from pathlib import Path
from scinceGeosOffline import Geos

class Coord(C.Structure):
    _fields_=[('x',C.c_double),('y',C.c_double),('z',C.c_double),('t',C.c_double)]

g=Geos()
lib=C.CDLL(str(Path('C:/Program Files/PostgreSQL/15/bin/libproj_8_2.dll')))
def bind(lib,name,result,args):
    f=getattr(lib,name); f.restype=result; f.argtypes=args; return f
p=C.c_void_p
create=bind(lib,'proj_create_crs_to_crs',p,[p,C.c_char_p,C.c_char_p,p])
normalize=bind(lib,'proj_normalize_for_visualization',p,[p,p])
trans=bind(lib,'proj_trans',Coord,[p,C.c_int,Coord])
destroy=bind(lib,'proj_destroy',None,[p])
interp=bind(g.lib,'GEOSInterpolateNormalized_r',p,[p,p,C.c_double])
circle=bind(g.lib,'GEOSMinimumBoundingCircle_r',p,[p,p,C.POINTER(C.c_double),C.POINTER(p)])
buffer=bind(g.lib,'GEOSBuffer_r',p,[p,p,C.c_double,C.c_int])
def encode(geom):
    raw=g.write_json(g.ctx,g.writer,geom,-1)
    try:return json.loads(C.string_at(raw))
    finally:g.free(g.ctx,raw)
def parse(geom):
    def positions(coords):return ','.join(f'{x:.15f} {y:.15f}' for x,y in coords)
    t,c=geom['type'],geom['coordinates']
    if t=='Point':s=f'POINT ({c[0]:.15f} {c[1]:.15f})'
    elif t=='LineString':s='LINESTRING ('+positions(c)+')'
    elif t=='Polygon':s='POLYGON ('+','.join('('+positions(r)+')' for r in c)+')'
    else:s='MULTIPOLYGON ('+','.join('('+','.join('('+positions(r)+')' for r in poly)+')' for poly in c)+')'
    out=g.read(g.ctx,g.reader,s.encode())
    if not out:raise RuntimeError(s)
    return out
def vertices(v):
    if isinstance(v[0],(float,int)):return [v]
    return [p for sub in v for p in vertices(sub)]
def run(name,geom,expansion):
    pts=vertices(geom['coordinates']); lon=(min(p[0] for p in pts)+max(p[0] for p in pts))/2; lat=(min(p[1] for p in pts)+max(p[1] for p in pts))/2
    projection=f'+proj=aeqd +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m +no_defs'
    raw=create(None,b'EPSG:4326',projection.encode(),None)
    pj=normalize(None,raw); destroy(raw)
    if not pj:raise RuntimeError('PROJ unavailable')
    def walk(v,direction):
        if isinstance(v[0],(float,int)):
            r=trans(pj,direction,Coord(v[0],v[1],0,0));return [r.x,r.y]
        return [walk(s,direction) for s in v]
    metric={'type':geom['type'],'coordinates':walk(geom['coordinates'],1)}; mg=parse(metric)
    if geom['type']=='Point':center=mg
    elif geom['type']=='LineString':center=interp(g.ctx,mg,0.5)
    else:
        rad=C.c_double(); center_ptr=p(); cb=circle(g.ctx,mg,C.byref(rad),C.byref(center_ptr));g.destroy(g.ctx,cb);center=center_ptr
    cx,cy=encode(center)['coordinates']; radius=max(math.hypot(x-cx,y-cy) for x,y in vertices(metric['coordinates']))
    total=radius+expansion; construction=total/math.cos(math.pi/128)
    area=buffer(g.ctx,center,construction,32); af=g.flags(area)
    derived=encode(area);derived['coordinates']=walk(derived['coordinates'],-1); center_ll=walk([cx,cy],-1)
    original=parse(geom); ag=parse(derived)
    # An offset unit deliberately outside the source but inside the context area.
    x,y=center_ll; offset=total*0.7; u={'type':'Polygon','coordinates':[[[cx+offset,cy+10],[cx+offset+10,cy+10],[cx+offset+10,cy+20],[cx+offset,cy+20],[cx+offset,cy+10]]]}
    u['coordinates']=walk(u['coordinates'],-1);ug=parse(u)
    def relate(a,b):
        raw=g.relate(g.ctx,a,b)
        try:return C.string_at(raw).decode()
        finally:g.free(g.ctx,raw)
    row={'geometry':json.dumps(derived),'lat':center_ll[1],'lng':center_ll[0],'coverage_radius':radius,'analysis_radius':total,
      'construction_radius':construction,'projection':projection,'area_square_meters':af['area'],
      'contains_source':g.predicates['Covers'](g.ctx,ag,original)==1,'source_valid':g.valid(g.ctx,original)==1,
      'source_simple':g.simple(g.ctx,original)==1,'area_valid':g.valid(g.ctx,ag)==1,'area_empty':g.empty(g.ctx,ag)==1}
    flags=g.flags(ag);uf=g.flags(ug)
    output={'name':name,'source':geom,'row':row,'areaFlags':flags,'unit':u,'unitFlags':uf,
      'intersects':g.predicates['Intersects'](g.ctx,ag,ug)==1,'touches':g.predicates['Touches'](g.ctx,ag,ug)==1,
      'covers_gu':g.predicates['Covers'](g.ctx,ag,ug)==1,'covers_ug':g.predicates['Covers'](g.ctx,ug,ag)==1,
      'equals':g.predicates['Equals'](g.ctx,ag,ug)==1,'relate':relate(ag,ug),
      'sourceIntersectsUnit':g.predicates['Intersects'](g.ctx,original,ug)==1,
      'metricVertexDistances':[math.hypot(x-cx,y-cy) for x,y in vertices(metric['coordinates'])],
      'metricCenter':[cx,cy],'metricSource':metric}
    for obj in [area,ag,ug,original]:g.destroy(g.ctx,obj)
    if center!=mg:g.destroy(g.ctx,center)
    g.destroy(g.ctx,mg);destroy(pj)
    return output
ring=[[-102.301,21.899],[-102.299,21.899],[-102.299,21.901],[-102.301,21.901],[-102.301,21.899]]
hole=[[-102.3002,21.8998],[-102.3002,21.9002],[-102.2998,21.9002],[-102.2998,21.8998],[-102.3002,21.8998]]
cases=[run('point',{'type':'Point','coordinates':[-102.3,21.9]},300),
 run('line',{'type':'LineString','coordinates':[[-102.302,21.9],[-102.3,21.9004],[-102.298,21.9]]},200),
 run('polygon',{'type':'Polygon','coordinates':[ring]},400),
 run('hole',{'type':'Polygon','coordinates':[ring,hole]},400),
 run('multi',{'type':'MultiPolygon','coordinates':[[ring],[[[x+0.01,y] for x,y in ring]]]},400),
 run('otherRegion',{'type':'LineString','coordinates':[[2.35,48.85],[2.36,48.86]]},200)]
print(json.dumps({'engine':g.version,'cases':cases}))
g.close()
