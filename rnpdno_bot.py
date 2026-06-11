import asyncio
import re
import requests
import datetime
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

# ==========================================
# CONFIGURACIÓN DE MORELOGIN
# ==========================================
PERFIL_MORELOGIN_ID = "2060114385070264320" # ID extraído de tu robot-repuve.js

def iniciar_perfil_morelogin(env_id):
    """Llama a la API local de MoreLogin para arrancar el perfil y obtener el WebSocket."""
    try:
        print(f"[MORELOGIN] 📡 Iniciando perfil con ID: {env_id}...")
        url = "http://127.0.0.1:40000/api/env/start"
        payload = {"envId": env_id, "env_id": env_id}
        response = requests.post(url, json=payload)
        data = response.json()
        
        if data.get("code") == 0:
            res_data = data.get("data", {})
            ws_endpoint = res_data.get("wsDetail") or res_data.get("webSocketDebuggerUrl")
            print(f"[MORELOGIN] ✅ Conexión establecida en: {ws_endpoint}")
            return ws_endpoint
        else:
            print(f"[MORELOGIN] ❌ Fallo al iniciar perfil. Respuesta: {data}")
            return None
    except Exception as e:
        print(f"[MORELOGIN] ❌ Error conectando a la API de MoreLogin. Error: {e}")
        return None

async def consultar_rnpdno(estado_objetivo="Aguascalientes", municipio_objetivo="Aguascalientes", criterio_busqueda="ultima_vez_visto", fecha_inicio="2000-01-01", fecha_fin=None):
    if not fecha_fin:
        fecha_fin = datetime.datetime.now().strftime("%Y-%m-%d")

    ws_endpoint = iniciar_perfil_morelogin(PERFIL_MORELOGIN_ID)
    
    if not ws_endpoint:
        print("[ROBOT] ❌ Abortando ejecución por falta de conexión a MoreLogin.")
        return

    print(f"[ROBOT] 🚀 Iniciando búsqueda RNPDNO: {estado_objetivo} - {municipio_objetivo}")

    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(ws_endpoint)
        context = browser.contexts[0] if browser.contexts else await browser.new_context()
        page = context.pages[0] if context.pages else await context.new_page()

        try:
            print("[ROBOT] 1/4 📡 Navegando al portal RNPDNO...")
            await page.goto("https://consultapublicarnpdno.segob.gob.mx/consulta", timeout=60000)

            print("[ROBOT] 2/4 ⏳ Llenando formulario...")
            
            # Esperamos a que los menús desplegables aparezcan en pantalla
            await page.wait_for_selector('select', timeout=15000)
            print(f"[ROBOT] 📅 Ingresando rango de fechas: {fecha_inicio} al {fecha_fin}...")
            script_fechas = """
            ([inicio, fin]) => {
                const evt = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
                const inputsDate = Array.from(document.querySelectorAll('input[type="date"]'));
                if (inputsDate.length >= 2) {
                    inputsDate[0].focus(); inputsDate[0].value = inicio; evt(inputsDate[0], 'input'); evt(inputsDate[0], 'change'); inputsDate[0].blur();
                    inputsDate[1].focus(); inputsDate[1].value = fin; evt(inputsDate[1], 'input'); evt(inputsDate[1], 'change'); inputsDate[1].blur();
                } else {
                    const textInputs = Array.from(document.querySelectorAll('input')).filter(i => (i.placeholder && i.placeholder.includes('/')) || (i.name && i.name.toLowerCase().includes('fecha')));
                    if (textInputs.length >= 2) {
                        const formatText = (dateStr) => { const p = dateStr.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dateStr; };
                        textInputs[0].focus(); textInputs[0].value = formatText(inicio); evt(textInputs[0], 'input'); evt(textInputs[0], 'change'); textInputs[0].blur();
                        textInputs[1].focus(); textInputs[1].value = formatText(fin); evt(textInputs[1], 'input'); evt(textInputs[1], 'change'); textInputs[1].blur();
                    }
                }
            }
            """
            await page.evaluate(script_fechas, [fecha_inicio, fecha_fin])

            # 1. Seleccionamos el Estado
            await page.locator(f'select:has(option:has-text("{estado_objetivo}"))').first.select_option(label=estado_objetivo)
            print(f"[ROBOT] ✅ Estado '{estado_objetivo}' seleccionado.")
            
            # Esperamos a que la opción del municipio EXISTA en el HTML para evitar timeouts
            print("[ROBOT] ⏳ Esperando a que el servidor de SEGOB cargue los municipios...")
            await page.locator(f'select >> option:has-text("{municipio_objetivo}")').first.wait_for(state="attached", timeout=30000)
            
            # 2. Seleccionamos el Municipio
            await page.locator(f'select:has(option:has-text("{municipio_objetivo}"))').first.select_option(label=municipio_objetivo)
            print(f"[ROBOT] ✅ Municipio '{municipio_objetivo}' seleccionado.")

            # 3. Seleccionamos el criterio de búsqueda
            if criterio_busqueda == "domicilio":
                await page.get_by_text("Domicilio", exact=False).first.click() 
            else:
                await page.get_by_text("última vez", exact=False).first.click()

            # 4. Damos clic en el botón Buscar
            boton_buscar = page.locator('.btn-busqueda-consulta')
            await boton_buscar.click()
            print("[ROBOT] ✅ Clic en Buscar realizado.")

            print("[ROBOT] 3/4 ⏳ Esperando carga del listado de resultados...")
            try:
                script_espera = """
                () => {
                    const texto = document.body.innerText.toUpperCase();
                    const elementos = document.querySelectorAll('tbody tr, .card, .mat-row, .list-group-item');
                    return elementos.length > 1 || texto.includes('MÁS INFORMACIÓN') || texto.includes('DETALLE') || texto.includes('NO SE ENCONTRARON') || texto.includes('EDAD ACTUAL');
                }
                """
                await page.wait_for_function(script_espera, timeout=45000)
            except:
                print("[ROBOT] ⚠️ La carga demoró demasiado, intentando extraer lo que esté en pantalla...")
                
            await page.wait_for_timeout(4000)

            print("[ROBOT] 4/4 🔍 Iniciando navegación profunda (Extracción de Fichas Individuales)...")
            
            # Lógica heurística inyectada al navegador para hacer clics dinámicos en las filas, 
            # seleccionar las instituciones y extraer foto/datos de cada ficha.
            script_extraccion = """
            async () => {
                const delay = (ms) => new Promise(res => setTimeout(res, ms));
                const resultados = [];
                
                // 1. Encontrar todos los contenedores/filas de resultados
                const botonesDetalle = Array.from(document.querySelectorAll('tr, .list-group-item, .card, button')).filter(el => {
                    const txt = (el.innerText || "").toUpperCase();
                    return txt.includes('MÁS INFORMACIÓN') || txt.includes('DETALLE') || el.classList.contains('mat-row');
                });

                let elementosClick = botonesDetalle.length > 0 ? botonesDetalle : Array.from(document.querySelectorAll('tbody tr')).filter(tr => tr.children.length > 2);
                
                // Procesaremos máximo 5 registros en esta prueba para no colapsar por tiempo
                let limite = Math.min(elementosClick.length, 5);
                
                for(let i = 0; i < limite; i++) {
                    try {
                        elementosClick[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await delay(500);
                        const clickTarget = elementosClick[i].querySelector('button, a, .mat-icon') || elementosClick[i];
                        clickTarget.click();
                        
                        let t1 = 0;
                        while(t1 < 5000) {
                            if (document.querySelector('.modal.show, dialog, .mat-dialog-container, .cdk-overlay-pane')) break;
                            await delay(500);
                            t1 += 500;
                        }
                        
                        // 2. Seleccionar Institución (Fiscalía, Comisión, etc.)
                        const modal = document.querySelector('.modal.show, dialog, .mat-dialog-container, .cdk-overlay-pane') || document.body;
                        const botonesInst = Array.from(modal.querySelectorAll('button, a')).filter(b => {
                            const txt = (b.innerText || "").toUpperCase();
                            return txt.includes('FISCALÍA') || txt.includes('COMISIÓN') || txt.includes('PROCURADURÍA') || txt.includes('VER FICHA');
                        });
                        
                        if(botonesInst.length > 0) {
                            botonesInst[0].click(); // Clic en la autoridad
                        }

                        let t2 = 0;
                        let fichaActiva = null;
                        while(t2 < 10000) {
                            const modales = Array.from(document.querySelectorAll('.mat-dialog-content, .cdk-overlay-pane, .modal-content, .modal.show, dialog, .mat-dialog-container, app-detalle'));
                            fichaActiva = modales.reverse().find(m => m.innerText && (m.innerText.toUpperCase().includes('SEXO') || m.innerText.toUpperCase().includes('EDAD') || m.innerText.toUpperCase().includes('ESTATURA'))) || document.body;
                            if (fichaActiva && fichaActiva.innerText && (fichaActiva.innerText.toUpperCase().includes('SEXO') || fichaActiva.innerText.toUpperCase().includes('ESTATURA'))) {
                                break;
                            }
                            await delay(500);
                            t2 += 500;
                        }
                        
                        // 3. Extraer la información de la Ficha
                        const textoCompleto = fichaActiva ? (fichaActiva.innerText || "") : "";
                        const imagen = fichaActiva.querySelector('img');
                        const fotoUrl = imagen ? imagen.src : 'Sin foto';
                        
                        const safeExtract = (keywords) => {
                            const lines = textoCompleto.split(String.fromCharCode(10)).map(l => l.trim().replace(/\s+:/g, ':')).filter(l => l.length > 0);
                            for (let j = 0; j < lines.length; j++) {
                                const upperLine = lines[j].toUpperCase();
                                for (const kw of keywords) {
                                    const ukw = kw.toUpperCase();
                                    if (upperLine === ukw || upperLine === ukw + ':') {
                                        if (j + 1 < lines.length) {
                                            const nextLineUpper = lines[j+1].toUpperCase();
                                            if (!["NOMBRE", "EDAD", "FECHA", "SEXO", "ESTATURA", "COMPLEX", "SEÑAS", "CIRCUNSTANCIAS", "LUGAR", "NACIONALIDAD"].some(k => nextLineUpper.startsWith(k))) {
                                                return lines[j+1];
                                            }
                                        }
                                    }
                                    if (upperLine.startsWith(ukw + ':')) {
                                        const val = lines[j].substring(lines[j].indexOf(':') + 1).trim();
                                        if (val) return val;
                                    }
                                }
                            }
                            return "N/D";
                        };
                        
                        const detalles = {
                            nombre: safeExtract(["Nombre(s)", "Nombre", "Persona desaparecida"]),
                            edad: safeExtract(["Edad actual", "Edad al momento", "Edad"]),
                            fechaDesaparicion: safeExtract(["Fecha y hora de desaparición", "Fecha de desaparición", "Fecha de los hechos", "Fecha"]),
                            sexo: safeExtract(["Sexo", "Género", "Genero"]),
                            estatura: safeExtract(["Estatura"]),
                            complexion: safeExtract(["Complexión", "Complexion"]),
                            senas: safeExtract(["Señas particulares", "Señas"])
                        };

                        if (detalles.nombre !== "N/D") {
                            detalles.nombre = detalles.nombre.replace(/(?:Primer Apellido|Segundo Apellido|Apellido)/gi, '').replace(/\s+/g, ' ').trim();
                        }

                        resultados.push({
                            id: i + 1,
                            foto: fotoUrl,
                            detalles: detalles,
                            texto_crudo: textoCompleto.substring(0, 400)
                        });
                        
                        // 4. Cerrar el modal para regresar a la lista
                        const btnCerrar = fichaActiva.querySelector('.btn-close, [aria-label="Close"], .close, button.mat-dialog-close');
                        const btnRegresar = Array.from(document.querySelectorAll('button')).find(b => b.innerText.toUpperCase().includes('REGRESAR') || b.innerText.toUpperCase().includes('VOLVER'));
                        if (btnCerrar) {
                            btnCerrar.click();
                        } else if (btnRegresar) {
                            btnRegresar.click();
                        } else {
                            document.dispatchEvent(new KeyboardEvent('keydown', {'key': 'Escape'}));
                        }
                        await delay(1500);
                        
                    } catch(err) {
                        console.error("Error en registro", i);
                    }
                }
                
                const btnSig = Array.from(document.querySelectorAll('button, a')).find(el => (el.innerText || "").toUpperCase().includes('SIGUIENTE'));
                const hayMasPaginas = btnSig && !btnSig.disabled;
                
                return { fichas: resultados, total_en_pantalla: elementosClick.length, hay_mas_paginas: hayMasPaginas };
            }
            """
            
            extraccion = await page.evaluate(script_extraccion)
            fichas = extraccion.get("fichas", [])
            
            print("\n========================================")
            print("🎉 EXTRACCIÓN PROFUNDA FINALIZADA")
            print(f"📍 Ubicación: {estado_objetivo}, {municipio_objetivo} ({criterio_busqueda})")
            print(f"🔍 Elementos encontrados en la pantalla actual: {extraccion.get('total_en_pantalla', 0)}")
            print(f"📄 ¿Hay más páginas?: {'Sí' if extraccion.get('hay_mas_paginas') else 'No'}")
            print(f"👥 Fichas Extraídas en esta muestra (Máx 5): {len(fichas)}")
            for f in fichas:
                print(f"--- Ficha {f['id']} ---")
                print(f"📷 Foto: {f['foto']}")
                if 'detalles' in f:
                    print(f"👤 Nombre: {f['detalles'].get('nombre', 'N/D')}")
                    print(f"🎂 Edad: {f['detalles'].get('edad', 'N/D')} | ⚧️ Sexo: {f['detalles'].get('sexo', 'N/D')}")
                    print(f"📅 Fecha de Desaparición: {f['detalles'].get('fechaDesaparicion', 'N/D')}")
                    print(f"📏 Estatura: {f['detalles'].get('estatura', 'N/D')} | 🧍 Complexión: {f['detalles'].get('complexion', 'N/D')}")
                    print(f"👁️ Señas: {f['detalles'].get('senas', 'N/D')}")
                print(f"📝 Texto crudo: {f.get('texto_crudo', '')[:100]}...")
            print("========================================\n")

        except PlaywrightTimeoutError:
            print("[ROBOT] ❌ Error: La página tardó demasiado en responder.")
            print("[ROBOT] ⏸️ Pausando navegador para inspección...")
            await page.pause()
        except Exception as e:
            print(f"[ROBOT] ❌ Error inesperado: {str(e)}")
            await page.pause()
        # Se omite browser.close() para que MoreLogin mantenga el navegador abierto

if __name__ == "__main__":
    # Inicia la ejecución del robot. Si quieres buscar otro estado, solo cambia las palabras aquí.
    asyncio.run(consultar_rnpdno(
        estado_objetivo="Aguascalientes", 
        municipio_objetivo="Aguascalientes",
        criterio_busqueda="ultima_vez_visto"
    ))
