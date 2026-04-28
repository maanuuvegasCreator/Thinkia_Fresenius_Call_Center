# Thinkia — Escritorio (Electron)

Ventana nativa que abre **el mismo portal** que en el navegador (Vercel). No embebe secretos: `TWILIO_*`, Supabase, etc. siguen en el servidor.

## Requisitos

- Node 20+ (recomendado 22).
- **Windows:** no hace falta Rust ni MSVC (a diferencia de Tauri).

## Desarrollo

```bash
cd apps/thinkia-desktop-electron
npm install
npm start
```

Opcional: otra URL antes de arrancar:

```powershell
$env:THINKIA_WEB_URL="https://tu-app.vercel.app/portal/"
npm start
```

## Generar `.exe` (portable + instalador NSIS)

```bash
cd apps/thinkia-desktop-electron
npm install
npm run dist
```

Salida en **`release/`**:

- `Thinkia-0.1.0-x64.exe` — portable (no requiere instalación).
- Carpeta **NSIS** — instalador clásico.

La URL embebida por defecto es la de producción del repo; para otro dominio:

```powershell
$env:THINKIA_WEB_URL="https://tu-dominio.com/portal/"
npm run dist
```

Eso regenera `portal-url.json` antes de empaquetar.

### Windows: firma / symlinks

Si `npm run pack` o `npm run dist` fallan con errores de **winCodeSign**, **7-Zip** o **symlink**, fuerza que no se intente firmar:

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY='false'
npm run pack
# o
npm run dist
```

En CI ya se define `CSC_IDENTITY_AUTO_DISCOVERY=false`.

## CI (GitHub Actions)

Workflow **Desktop Electron (Windows)**: Actions → ejecutar manualmente → descargar artifact **`thinkia-electron-windows`**.

Secret opcional **`THINKIA_WEB_URL`** en el repo si no quieres usar el default del script.
