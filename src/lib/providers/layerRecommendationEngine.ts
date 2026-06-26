export class LayerRecommendationEngine {
  /**
   * Recommends WMS layer IDs from the catalog based on the active module.
   */
  static recommend(
    moduleName: "pandillas" | "inundaciones" | "perfil",
    context?: { lat?: number; lng?: number; query?: string }
  ): string[] {
    const queryLower = (context?.query || "").toLowerCase();

    if (moduleName === "inundaciones") {
      const recommendations = [
        "corrientes_agua_lineal",
        "cuerpos_agua_poligonal",
        "continente_elevacion_cem_30m",
        "curvas_nivel_30m"
      ];
      
      // If the user's field observations or query mention soil, agricultural or vegetation, suggest land use layer
      if (/(suelo|vegetacion|tierra|impermeable|asfalto|siembra)/.test(queryLower)) {
        recommendations.push("uso_suelo_serie_vii");
      }
      
      return recommendations;
    }

    if (moduleName === "pandillas") {
      const recommendations = [
        "m_ageb_m_g",
        "m_municipio_g"
      ];

      // Recommend road networks and populated centers if query mentions movements or routes
      if (/(ruta|huida|carretera|paso|movilidad|desplazamiento)/.test(queryLower)) {
        recommendations.push("red_carretera_nacional");
      } else {
        recommendations.push("m_localidad_p_g");
      }

      return recommendations;
    }

    // Default / "perfil" module
    return [
      "m_municipio_g",
      "m_localidad_p_g"
    ];
  }
}
