import asyncio
import re
import requests
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

async def consultar_rnpdno(estado_objetivo="Aguascalientes", municipio_objetivo="Aguascalientes", criterio_busqueda="ultima_vez_visto"):
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
            await page.wait_for_selector('select.form-select.form-select-sm', timeout=15000)
            selects = page.locator('select.form-select.form-select-sm')

            # 1. Seleccionamos el Estado
            await selects.nth(0).select_option(label=estado_objetivo)
            print(f"[ROBOT] ✅ Estado '{estado_objetivo}' seleccionado.")
            
            # Esperamos a que la opción del municipio EXISTA en el HTML para evitar timeouts
            print("[ROBOT] ⏳ Esperando a que el servidor de SEGOB cargue los municipios...")
            await page.locator(f'select.form-select.form-select-sm >> option:has-text("{municipio_objetivo}")').first.wait_for(state="attached", timeout=30000)
            
            # 2. Seleccionamos el Municipio
            await selects.nth(1).select_option(label=municipio_objetivo)
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
            await page.wait_for_timeout(6000)
            
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
                        elementosClick[i].click(); // Abrir el resultado
                        await delay(2500); // Esperar modal de instituciones
                        
                        // 2. Seleccionar Institución (Fiscalía, Comisión, etc.)
                        const modal = document.querySelector('.modal.show, dialog, .mat-dialog-container') || document.body;
                        const botonesInst = Array.from(modal.querySelectorAll('button, a')).filter(b => {
                            const txt = (b.innerText || "").toUpperCase();
                            return txt.includes('FISCALÍA') || txt.includes('COMISIÓN') || txt.includes('PROCURADURÍA');
                        });
                        
                        if(botonesInst.length > 0) {
                            botonesInst[0].click(); // Clic en la autoridad
                            await delay(3000); // Esperar a que cargue la ficha
                        }
                        
                        // 3. Extraer la información de la Ficha
                        const fichaActiva = document.querySelector('.modal.show, dialog, .mat-dialog-container') || document.body;
                        const textoCompleto = (fichaActiva.innerText || "").split(String.fromCharCode(10)).join(' ');
                        const imagen = fichaActiva.querySelector('img');
                        const fotoUrl = imagen ? imagen.src : 'Sin foto';
                        
                        resultados.push({
                            id: i + 1,
                            foto: fotoUrl,
                            datos: textoCompleto.substring(0, 400)
                        });
                        
                        // 4. Cerrar el modal para regresar a la lista
                        const btnCerrar = fichaActiva.querySelector('.btn-close, [aria-label="Close"], .close, button.mat-dialog-close');
                        if (btnCerrar) {
                            btnCerrar.click();
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
                print(f"📝 Datos: {f['datos']}...")
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
