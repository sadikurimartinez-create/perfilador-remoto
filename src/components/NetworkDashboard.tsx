"use client";
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Importación dinámica para evitar errores de SSR con el canvas HTML5
// @ts-ignore
const ForceGraph2D: any = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export const NetworkDashboard = () => {
  const [graphData, setGraphData] = useState<{ nodes: any[], links: any[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNetworkData = async () => {
      try {
        const response = await fetch('/api/bigquery');
        const result = await response.json();
        
        if (result.data) {
          const nodesMap = new Map();
          const links: any[] = [];

          result.data.forEach((row: any) => {
            // 1. Instanciar Nodo de Origen (Target/Objetivo)
            if (!nodesMap.has(row.source)) {
              nodesMap.set(row.source, { id: row.source, group: 'OBJETIVO', val: 15 });
            }
            
            // 2. Instanciar Nodo Destino (Vínculo)
            if (!nodesMap.has(row.target)) {
              let group = 'ENTIDAD';
              if (row.type.includes('PERSON')) group = 'PERSONA';
              if (row.type.includes('ORGANIZATION')) group = 'ORGANIZACIÓN';
              if (row.type.includes('LOCATION')) group = 'UBICACIÓN';
              
              nodesMap.set(row.target, { id: row.target, group, type: row.type, val: 5 + (row.weight * 2) });
            } else {
              // Si el vínculo ya existe (ej. un mismo cártel aparece en varios objetivos), incrementamos su tamaño
              const node = nodesMap.get(row.target);
              node.val += row.weight * 2;
            }

            // 3. Crear el Enlace
            links.push({ source: row.source, target: row.target, value: row.weight, label: row.type });
          });

          setGraphData({ nodes: Array.from(nodesMap.values()) as any, links });
        }
      } catch (error) {
        console.error("Error al cargar la red de BigQuery", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNetworkData();
  }, []);

  const getNodeColor = (node: any) => {
    switch (node.group) {
      case 'OBJETIVO': return '#ef4444'; // Rojo (Alertas/Objetivos)
      case 'PERSONA': return '#3b82f6'; // Azul
      case 'ORGANIZACIÓN': return '#8b5cf6'; // Morado (Estructuras criminales/empresas)
      case 'UBICACIÓN': return '#10b981'; // Verde
      default: return '#9ca3af'; // Gris (Genéricos o Antecedentes)
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64 text-slate-300 font-semibold animate-pulse">Cargando constelación de inteligencia desde BigQuery...</div>;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 w-full h-[650px] flex flex-col shadow-xl">
      <h2 className="text-xl font-bold text-white mb-1">Red Histórica de Inteligencia (BigQuery)</h2>
      <p className="text-slate-400 text-sm mb-4">
        Mapeo interactivo de vínculos históricos, estructuras criminales y reincidencias detectadas en los escaneos previos del Perfilador Remoto.
      </p>
      <div className="flex-1 bg-black/50 border border-slate-800 rounded-md overflow-hidden relative">
        <ForceGraph2D
          graphData={graphData}
          nodeLabel="id"
          nodeColor={getNodeColor}
          nodeRelSize={6}
          linkColor={() => 'rgba(148, 163, 184, 0.3)'}
          linkWidth={(link: any) => Math.max(1, link.value * 1.5)} // Líneas más gruesas si hay mucha reincidencia
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={0.005}
        />
        {/* Leyenda Superpuesta */}
        <div className="absolute top-4 left-4 bg-slate-900/90 p-3 rounded-md border border-slate-700 shadow-lg text-xs pointer-events-none">
          <div className="flex items-center gap-2 mb-1.5"><span className="w-3 h-3 rounded-full bg-red-500"></span> <span className="text-white font-medium">Objetivos Analizados</span></div>
          <div className="flex items-center gap-2 mb-1.5"><span className="w-3 h-3 rounded-full bg-blue-500"></span> <span className="text-slate-300">Vínculos Personales</span></div>
          <div className="flex items-center gap-2 mb-1.5"><span className="w-3 h-3 rounded-full bg-purple-500"></span> <span className="text-slate-300">Organizaciones Criminógenas</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> <span className="text-slate-300">Ubicaciones Reincidentes</span></div>
        </div>
      </div>
    </div>
  );
};