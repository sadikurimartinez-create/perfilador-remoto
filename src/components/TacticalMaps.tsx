"use client";
import React from "react";
import { AnalysisMap } from "./AnalysisMap";

export function TacticalMaps({ album, analysisResult, analysisRadius, analysisPolygon, manualPois, geometryType }: any) {
  return (
    <div className="w-full flex flex-col gap-6" style={{ fontFamily: 'Aptos, Calibri, "Segoe UI", sans-serif' }}>
      
      {/* PÁGINA 1: DENSIDAD Y MOVILIDAD */}
      <div className="w-full flex flex-col md:flex-row gap-6 bg-slate-50 p-6 rounded-xl border border-slate-300 shadow-sm items-stretch">
        {/* Mapa 1: Densidad Criminológica */}
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm border-2 border-[#0D2B52] overflow-hidden" id="map-density">
          <div className="bg-[#0D2B52] text-white p-2 text-center font-bold text-sm uppercase tracking-widest shadow-md z-10">
            1. Densidad Criminológica (Heatmap)
          </div>
          <div className="w-full h-[400px] relative bg-slate-100">
            <AnalysisMap viewMode="DENSITY" album={album} analysisResult={analysisResult} analysisRadius={analysisRadius} analysisPolygon={analysisPolygon} manualPois={manualPois} geometryType={geometryType} />
          </div>
        </div>
        
        {/* Mapa 2: Movilidad Criminal */}
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm border-2 border-[#0D2B52] overflow-hidden" id="map-mobility">
          <div className="bg-[#0D2B52] text-white p-2 text-center font-bold text-sm uppercase tracking-widest shadow-md z-10">
            2. Corredores y Movilidad Criminal
          </div>
          <div className="w-full h-[400px] relative bg-slate-100">
            <AnalysisMap viewMode="MOBILITY" album={album} analysisResult={analysisResult} analysisRadius={analysisRadius} analysisPolygon={analysisPolygon} manualPois={manualPois} geometryType={geometryType} />
          </div>
        </div>
      </div>

      {/* PÁGINA 2: ATRACTORES Y PROYECCIÓN */}
      <div className="w-full flex flex-col md:flex-row gap-6 bg-slate-50 p-6 rounded-xl border border-slate-300 shadow-sm items-stretch">
        {/* Mapa 3: Atractores y Factores */}
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm border-2 border-[#0D2B52] overflow-hidden" id="map-attractors">
          <div className="bg-[#0D2B52] text-white p-2 text-center font-bold text-sm uppercase tracking-widest shadow-md z-10">
            3. Atracción y Factores Criminógenos
          </div>
          <div className="w-full h-[400px] relative bg-slate-100">
            <AnalysisMap viewMode="ATTRACTORS" album={album} analysisResult={analysisResult} analysisRadius={analysisRadius} analysisPolygon={analysisPolygon} manualPois={manualPois} geometryType={geometryType} />
          </div>
        </div>
        
        {/* Mapa 4: Proyección a 6 Meses */}
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm border-2 border-[#0D2B52] overflow-hidden" id="map-predictive">
          <div className="bg-[#0D2B52] text-white p-2 text-center font-bold text-sm uppercase tracking-widest shadow-md z-10">
            4. Proyección de Riesgo a 6 Meses
          </div>
          <div className="w-full h-[400px] relative bg-slate-100">
            <AnalysisMap viewMode="PREDICTIVE" album={album} analysisResult={analysisResult} analysisRadius={analysisRadius} analysisPolygon={analysisPolygon} manualPois={manualPois} geometryType={geometryType} />
          </div>
        </div>
      </div>

    </div>
  );
}