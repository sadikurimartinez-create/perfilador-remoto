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

            print("[ROBOT] 3/4 ⏳ Esperando resultados (Esto puede tomar varios segundos)...")
            
            # El robot se detiene y espera de forma inteligente hasta que la gráfica cargue
            # Usamos "Edad actual:" porque descubrimos que ese texto aparece cuando carga todo
            await page.get_by_text("Edad actual:", exact=False).first.wait_for(state="visible", timeout=60000)
            await page.wait_for_timeout(3000) # Pausa extra para que los números terminen de aparecer
            
            print("[ROBOT] 4/4 🔍 Extrayendo inteligencia numérica...")

            # Extraemos todo el texto de la pantalla para buscar los números
            texto_visible = await page.evaluate("document.body.innerText")
            
            # Función inteligente para capturar los números al lado de la palabra clave
            def buscar_metrica(palabra_clave, texto_pantalla):
                match = re.search(rf"{palabra_clave}\D{{0,50}}([\d,]+)", texto_pantalla, re.IGNORECASE)
                return match.group(1) if match else "N/D"

            total_desaparecidas = buscar_metrica("Total", texto_visible)
            hombres = buscar_metrica("Hombres", texto_visible)
            mujeres = buscar_metrica("Mujeres", texto_visible)

            # Imprimimos el resultado final
            print("\n========================================")
            print("🎉 RESULTADO RNPDNO EXTRAÍDO CORRECTAMENTE")
            print(f"📍 Ubicación: {estado_objetivo}, {municipio_objetivo} ({criterio_busqueda})")
            print(f"👥 Total Desaparecidos: {total_desaparecidas}")
            print(f"🚹 Hombres: {hombres}")
            print(f"🚺 Mujeres: {mujeres}")
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
