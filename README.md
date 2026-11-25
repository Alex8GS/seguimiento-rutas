# Seguimiento de Rutas

App web (PWA) para registrar a diario: **cédula**, **placa** (de una lista), **si usó la ruta**, **cambio ruta ↔ moto** y **observaciones**. La fecha y hora se guardan solas. Funciona en el celular, sin conexión, y se puede instalar en la pantalla de inicio.

## Funciones
- Registro rápido con aviso si la cédula ya se registró hoy.
- **Enviar registros**: los manda a Google Sheets y, desde ahí, por correo con una tabla. Sin Sheets, abre la app de correo con los datos (mailto).
- **Copia en el teléfono**: todo queda guardado en el navegador y al enviar se descarga un CSV (se abre en Excel). Botón para compartir el CSV por WhatsApp/correo.
- **Administrador con PIN** (inicial `1234`, se pide cambiarlo): configuración, lista de placas, editar/anular/borrar registros, exportar por fechas. Se bloquea 5 min tras 5 intentos fallidos y se cierra sola tras 5 min sin uso.

## Publicar en GitHub Pages
1. Cree un repositorio y suba `index.html`, `manifest.json`, `sw.js`, `icon.svg` (no hace falta subir `Codigo.gs`).
2. En el repositorio: **Settings > Pages > Source: Deploy from a branch > main / root > Save**.
3. Abra `https://SU-USUARIO.github.io/SU-REPO/` en el celular y use **Agregar a pantalla de inicio**.

## Conectar Google Sheets y correo
1. Cree una hoja de Google. Abra **Extensiones > Apps Script**, borre lo que haya y pegue `Codigo.gs`.
2. Cambie `CLAVE` por una clave propia. (Opcional: `CORREO_FIJO`.)
3. **Implementar > Nueva implementación > Aplicación web**. Ejecutar como **Yo**; acceso **Cualquier persona**. Autorice los permisos (hoja y envío de correo). Copie la URL que termina en `/exec`.
4. En la app: **Admin > Configuración**: pegue la URL, la misma clave y el correo destino. **Guardar** y **Probar conexión**.
5. Opcional: en la pestaña **Placas** de la hoja (se crea sola) escriba las placas en la columna A y use **Traer placas desde Google Sheets**.

Los registros se actualizan por ID: editar o anular un registro y volver a enviarlo corrige la fila en la hoja sin duplicar. Gmail gratuito permite ~100 correos/día desde Apps Script.

## Seguridad (importante)
El PIN impide que los usuarios cambien la configuración o los datos desde la app, pero alguien con conocimientos técnicos podría modificar el almacenamiento del navegador. **La hoja de Google es la copia oficial**: protéjala (Datos > Proteger hojas) y compártala solo con quien deba verla. No publique la clave en el repositorio.
