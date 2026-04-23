# Thinkia — Escritorio con Tauri (AICONCTATC-93)

Empaqueta el **mismo backend** (Next + Supabase + Twilio) mostrando el portal **Vite** o la URL que configures.

## Requisitos

- [Rust](https://www.rust-lang.org/tools/install)
- Node 20+

## Crear el proyecto Tauri (recomendado)

Desde la **raíz del monorepo**:

```bash
npm create tauri-app@latest apps/thinkia-desktop-tauri-app -- --template vanilla --manager npm -y
```

Luego ajusta `tauri.conf.json` → `build`:

- **`devUrl`**: `http://localhost:5173` (Vite raíz) o tu URL de login en preview.
- **`frontendDist`**: `../../dist` si quieres embebido el build estático de Vite (`npm run build` en raíz).
- **Permisos de audio**: en Tauri 2 usa capabilities / allowlist de `shell` solo si hace falta; el audio lo pide el **WebView** al usar `getUserMedia` igual que en el navegador.

## Política de firma (interna)

El **build firmado** (Windows/macOS) depende de certificados y pipelines de vuestra organización; no se incluyen certificados en el repo.

## Mismo backend

El escritorio **no duplica** lógica de voz: carga la web que ya habla con Supabase y, si navegas al Next desplegado, con Twilio vía `/api/token` y cookies tras el handoff.
