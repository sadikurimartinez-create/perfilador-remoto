import { PowerUpConfig } from "./powerups.types";

export const POWER_UPS_CONFIG: PowerUpConfig[] = [
  {
    id: "analizar_imagen",
    title: "Analizar Imagen",
    subtitle: "Extrae texto y detecta objetos relevantes en fotos o PDFs.",
    icon: "📸",
    technicalText: "Ejecuta OCR Avanzado y Extracción de Atributos Visuales.",
    fileImpact: "Enriquece el expediente digital con texto legible y detección de elementos de riesgo o marcas en la escena.",
    colorTheme: {
      bg: "bg-emerald-950/20",
      border: "border-emerald-500/30",
      hoverBorder: "hover:border-emerald-500/80",
      hoverBg: "hover:bg-emerald-950/40",
      text: "text-emerald-300",
      accentText: "text-emerald-400",
      glow: "shadow-emerald-500/10",
      badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
      accentBg: "bg-emerald-500",
      bulletDot: "bg-emerald-400"
    },
    tooltip: {
      visibleHuman: "Escanea archivos visuales y documentos escaneados para detectar textos legibles, logotipos y elementos sospechosos en la escena.",
      expandableOperative: {
        process: "Usa algoritmos ópticos e inteligencia artificial multimodal para indexar matrículas, letreros, fachadas u objetos tácticos, categorizándolos automáticamente en un inventario de evidencias.",
        sources: [
          "Imágenes capturadas in-situ por personal de campo",
          "Archivos PDF cargados al expediente del caso",
          "Muestras gráficas y logs territoriales"
        ]
      },
      collapsedTechnical: {
        apis: ["Google Cloud Vision API (Feature: TEXT_DETECTION, OBJECT_LOCALIZATION)"],
        models: ["Gemini 1.5 Pro Multimodal Core", "Vision-Transformer OCR Engine"],
        functions: ["detect_text()", "extract_visual_attributes()", "align_spatial_polygons()"]
      }
    },
    preview: {
      summary: "Digitalización de contenido escrito y etiquetado automático de objetos en archivos de imagen o PDFs escaneados.",
      analysisType: "Visión Computacional y Estructuración Óptica de Evidencia",
      estimatedImpact: "medio",
      dataToProcess: "Fotografías (JPEG, PNG), capturas de pantalla de redes, escaneos y archivos PDF"
    }
  },
  {
    id: "analizar_audio",
    title: "Analizar Audio",
    subtitle: "Convierte audio en texto y detecta tono emocional.",
    icon: "🎙️",
    technicalText: "Aplica Análisis de Diarización y Sentimiento.",
    fileImpact: "Registra transcripciones literales, identificando quién habla y detectando picos de tensión o miedo en el diálogo.",
    colorTheme: {
      bg: "bg-purple-950/20",
      border: "border-purple-500/30",
      hoverBorder: "hover:border-purple-500/80",
      hoverBg: "hover:bg-purple-950/40",
      text: "text-purple-300",
      accentText: "text-purple-400",
      glow: "shadow-purple-500/10",
      badge: "bg-purple-500/10 text-purple-300 border-purple-500/20",
      accentBg: "bg-purple-500",
      bulletDot: "bg-purple-400"
    },
    tooltip: {
      visibleHuman: "Transcribe grabaciones de voz, dividiendo la conversación por participantes y midiendo el estado emocional o nivel de tensión.",
      expandableOperative: {
        process: "Procesa espectrogramas de audio para realizar Speech-to-Text (STT), agrupar fragmentos por hablante (diarización) y analizar las entonaciones lingüísticas.",
        sources: [
          "Reportes de audio o llamadas telefónicas",
          "Mensajes de voz recuperados de fuentes OSINT",
          "Declaraciones de testigos en formato de audio"
        ]
      },
      collapsedTechnical: {
        apis: ["Google Cloud Speech-to-Text API v2 (Speaker Diarization Active)"],
        models: ["Chirp Acoustic Model", "Gemini 1.5 Flash (Sentiment Tone Analyzer)"],
        functions: ["diarize_speakers()", "analyze_acoustic_sentiment()", "generate_dialogue_segments()"]
      }
    },
    preview: {
      summary: "Generación de transcripción literal segmentada por interlocutores con análisis de estrés, urgencia y miedo.",
      analysisType: "Procesamiento de Voz Acústica y Diarización de Voces",
      estimatedImpact: "alto",
      dataToProcess: "Archivos de sonido (.wav, .mp3, .m4a) e interceptaciones u operativos grabados"
    }
  },
  {
    id: "analisis_ubicacion",
    title: "Análisis de Ubicación",
    subtitle: "Detecta eventos y noticias cerca del punto investigado.",
    icon: "📍",
    technicalText: "Realiza Consulta de Proximidad ST_DWithin y Grounding Dinámico.",
    fileImpact: "Establece conexiones lógicas entre las coordenadas del suceso y eventos históricos u operativos reportados a la redonda.",
    colorTheme: {
      bg: "bg-blue-950/20",
      border: "border-blue-500/30",
      hoverBorder: "hover:border-blue-500/80",
      hoverBg: "hover:bg-blue-950/40",
      text: "text-blue-300",
      accentText: "text-blue-400",
      glow: "shadow-blue-500/10",
      badge: "bg-blue-500/10 text-blue-300 border-blue-500/20",
      accentBg: "bg-blue-500",
      bulletDot: "bg-blue-400"
    },
    tooltip: {
      visibleHuman: "Cruza coordenadas geográficas con registros criminales locales y noticias geolocalizadas a la redonda.",
      expandableOperative: {
        process: "Ejecuta una consulta espacial indexada sobre las coordenadas del suceso para buscar vecindad en un radio táctico y relacionar el evento con incidentes previos.",
        sources: [
          "Bases de datos de Incidencia Delictiva Estatal",
          "Servicios de Noticias Abiertas de Geointeligencia (OSINT)",
          "Registros de Negocios y Puntos de Interés del DENUE"
        ]
      },
      collapsedTechnical: {
        apis: ["PostGIS Spatial Query Engine (ST_DWithin, ST_Distance)"],
        models: ["Google Discovery Engine (Geographic news grounding)", "Spatial Clustering Kernels"],
        functions: ["execute_st_dwithin()", "fetch_local_grounding()", "correlate_geospatial_incidents()"]
      }
    },
    preview: {
      summary: "Consulta geoespacial en un radio táctico para identificar alertas, patrones delictivos previos y noticias territoriales.",
      analysisType: "Correlación Geoespacial y Grounding Territorial",
      estimatedImpact: "alto",
      dataToProcess: "Coordenadas latitud/longitud de la escena, perímetros espaciales e históricos de incidencia delictiva"
    }
  },
  {
    id: "detectar_entidades",
    title: "Detectar Personas y Lugares",
    subtitle: "Identifica nombres, organizaciones y direcciones en el contenido.",
    icon: "🧠",
    technicalText: "Activa Extracción de Entidades Salientes.",
    fileImpact: "Estructura de forma automática una base de actores (quién es quién) y lugares clave para armar redes de vínculos.",
    colorTheme: {
      bg: "bg-amber-950/20",
      border: "border-amber-500/30",
      hoverBorder: "hover:border-amber-500/80",
      hoverBg: "hover:bg-amber-950/40",
      text: "text-amber-300",
      accentText: "text-amber-400",
      glow: "shadow-amber-500/10",
      badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",
      accentBg: "bg-amber-500",
      bulletDot: "bg-amber-400"
    },
    tooltip: {
      visibleHuman: "Extrae de forma automática nombres de personas, apodos, organizaciones delictivas y direcciones físicas de los textos narrativos.",
      expandableOperative: {
        process: "Aplica Procesamiento de Lenguaje Natural (NLP) para descomponer la hipótesis de gabinete, aislar actores sospechosos y trazar relaciones lógicas.",
        sources: [
          "Reportes Policiales Homologados (RPH)",
          "Fichas e historiales de actores delictivos",
          "Narrativas, entrevistas y descripciones escritas en campo"
        ]
      },
      collapsedTechnical: {
        apis: ["Google Natural Language API (Named Entity Recognition)"],
        models: ["Vertex AI NLP Core v2 (Fine-Tuned for Law Enforcement Entities)"],
        functions: ["extract_named_entities()", "resolve_alias_patterns()", "link_operational_nodes()"]
      }
    },
    preview: {
      summary: "Aislamiento y catalogación automática de actores clave, alias, organizaciones y puntos geográficos mencionados en testimonios.",
      analysisType: "Reconocimiento de Entidades Nombradas (NER)",
      estimatedImpact: "medio",
      dataToProcess: "Descripciones de campo, hipótesis de gabinetes, reportes policiales homologados y textos narrativos"
    }
  },
  {
    id: "buscar_inteligencia",
    title: "Buscar Inteligencia",
    subtitle: "Busca información relevante en bases OSINT y conocimiento histórico.",
    icon: "🔍",
    technicalText: "Despliega Búsqueda Semántica en Discovery Engine.",
    fileImpact: "Vincula tu investigación actual con precedentes históricos, lecciones operativas previas o información pública relevante.",
    colorTheme: {
      bg: "bg-rose-950/20",
      border: "border-rose-500/30",
      hoverBorder: "hover:border-rose-500/80",
      hoverBg: "hover:bg-rose-950/40",
      text: "text-rose-300",
      accentText: "text-rose-400",
      glow: "shadow-rose-500/10",
      badge: "bg-rose-500/10 text-rose-300 border-rose-500/20",
      accentBg: "bg-rose-500",
      bulletDot: "bg-rose-400"
    },
    tooltip: {
      visibleHuman: "Interroga bases de datos abiertas e histórico del expediente buscando modus operandi similares por similitud semántica (significado).",
      expandableOperative: {
        process: "Genera incrustaciones vectoriales del texto para compararlo con un repositorio de información de geointeligencia y manuales, recuperando casos idénticos.",
        sources: [
          "Bases OSINT abiertas de geointeligencia",
          "Manuales de prevención del delito y geointeligencia territorial",
          "Repositorios históricos de carpetas cerradas"
        ]
      },
      collapsedTechnical: {
        apis: ["Google Vertex AI Search & Conversation API (Discovery Engine)"],
        models: ["Vertex Vector Search (text-embedding-gecko)", "Gemini 1.5 Pro RAG Core"],
        functions: ["search_semantic_cases()", "retrieve_rag_context()", "calculate_modus_operandi_similarity()"]
      }
    },
    preview: {
      summary: "Interrogación conceptual de bases de datos para identificar modus operandi idénticos y casos análogos del pasado.",
      analysisType: "Búsqueda Semántica Vectorial y Recuperación de Información RAG",
      estimatedImpact: "alto",
      dataToProcess: "Hipótesis operativas, bases de datos OSINT abiertas e históricos del expediente digital"
    }
  }
];
