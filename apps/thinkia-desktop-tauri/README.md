# Thinkia — Escritorio (Tauri) — AICONCTATC-93

Envuelve el **mismo portal Vite** del monorepo (y enlaces a Next/softphone como en el navegador).

## Requisitos

- [Rust](https://www.rust-lang.org/tools/install) + dependencias de Tauri ([Windows](https://tauri.app/v1/guides/getting-started/prerequisites/)).
- **Windows:** el toolchain MSVC de Rust necesita **`link.exe`**. Instala [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/) con la carga **“Desarrollo de escritorio con C++”** (o al menos MSVC + Windows SDK). Sin esto, `tauri build` falla con `linker link.exe not found`.

## Desarrollo

Opción rápida desde la **raíz del monorepo** (instala dependencias de esta carpeta la primera vez):

```bash
cd apps/thinkia-desktop-tauri && npm install
cd ../..
npm run dev:desktop
```

`tauri.conf.json` define `beforeDevCommand: npm run dev --prefix ../..`, así que **Tauri arranca Vite en el puerto 5173** si aún no lo tienes en marcha. Si prefieres control manual: `npm run dev` en la raíz y, en otra terminal, `npm run dev` dentro de `apps/thinkia-desktop-tauri`.

## Producción (build estático embebido)

1. `npm run build` en la **raíz** (genera `dist/` del portal Vite).
2. `npm run build` en esta carpeta → binarios en `src-tauri/target/release/bundle/`.

## Firma / política interna

Certificados de código (Windows/macOS) los configura tu equipo en `tauri.conf.json` → `bundle.windows` / firma Apple.
