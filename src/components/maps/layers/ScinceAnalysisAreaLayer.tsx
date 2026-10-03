"use client";
import React,{useEffect,useState} from 'react';
import {Polygon,OverlayView} from '@react-google-maps/api';
import {readScinceCanonicalGeography} from '../../../utils/scinceQueryGeometry';
import type {ScinceAnalysisArea} from '../../../types/scinceAnalysisArea';

/** Temporary display only. No writes, no authority decisions, no changes to rector geometry. */
export function ScinceAnalysisAreaLayer({projectId,canonicalGeography}:{projectId:string;canonicalGeography:unknown}) {
  const [preview,setPreview]=useState<{area:ScinceAnalysisArea;source:string;projectId:string}|null>(null);
  const [visible,setVisible]=useState(true);
  const canonical=readScinceCanonicalGeography(canonicalGeography);
  const identity=JSON.stringify([canonical?.geographyId,canonical?.geometry ?? null]);
  useEffect(()=>{
    const receive=(event:Event)=>{
      const d=(event as CustomEvent).detail;
      if(d?.projectId!==projectId)return;
      const source=readScinceCanonicalGeography(d.source);
      setPreview(d.area && source && d.area.sourceGeographyId===source.geographyId ?
        {area:d.area,source:JSON.stringify([source.geographyId,source.geometry]),projectId} : null);
      setVisible(true);
    };
    window.addEventListener('ceipol:scince-area-preview',receive);
    return ()=>window.removeEventListener('ceipol:scince-area-preview',receive);
  },[projectId]);
  const g=readScinceCanonicalGeography(preview?.area.geometry);
  if(!preview || preview.projectId!==projectId || preview.source!==identity || g?.geometry.type!=='Polygon')return null;
  return <>
    {visible && <Polygon paths={g.geometry.coordinates.map(r=>r.map(([lng,lat])=>({lat,lng})))}
      options={{fillColor:'#a78bfa',fillOpacity:0.08,strokeColor:'#a78bfa',strokeWeight:2,clickable:false,zIndex:2}} />}
    <OverlayView position={preview.area.center} mapPaneName={OverlayView.FLOAT_PANE}>
      <button type="button" className="text-xs bg-slate-900 text-violet-200 p-1 rounded" onClick={()=>setVisible(!visible)}>
        {visible?'Ocultar':'Mostrar'} área SCINCE
      </button>
    </OverlayView>
  </>;
}
