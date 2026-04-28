# Build APK release (arm64-v8a) en Windows evitando "ninja build.ninja still dirty"
# cuando el repo está en Escritorio / OneDrive / antivirus agresivo.
#
# Requisitos: Android SDK (local.properties con sdk.dir), JDK, .env con EXPO_PUBLIC_*.
# Uso (desde esta carpeta apps/thinkia-mobile-expo):
#   powershell -ExecutionPolicy Bypass -File .\scripts\build-apk-windows.ps1

$ErrorActionPreference = "Stop"
$appRoot = Split-Path -Parent $PSScriptRoot
$tempRoot = Join-Path $env:TEMP "thinkia-mobile-expo-build"

Write-Host "Copiando proyecto a $tempRoot (sin caches de build Android)…"
if (Test-Path $tempRoot) {
  Remove-Item -Recurse -Force $tempRoot
}
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
$robolog = Join-Path $env:TEMP "thinkia-robocopy.log"
robocopy $appRoot $tempRoot /E /XD "android\app\build" "android\.gradle" "android\app\.cxx" ".git" /NFL /NDL /NJH /NJS /nc /ns /np /LOG:$robolog
if ($LASTEXITCODE -ge 8) {
  throw "robocopy falló (código $LASTEXITCODE). Ver $robolog"
}

$localProps = Join-Path $appRoot "android\local.properties"
if (-not (Test-Path $localProps)) {
  throw "Falta android\local.properties con sdk.dir=... (ruta al Android SDK). Crealo una vez."
}
Copy-Item -Force $localProps (Join-Path $tempRoot "android\local.properties")

$envFile = Join-Path $appRoot ".env"
if (-not (Test-Path $envFile)) {
  throw "Falta .env en apps/thinkia-mobile-expo (copia .env.example y rellena EXPO_PUBLIC_*)."
}
Copy-Item -Force $envFile (Join-Path $tempRoot ".env")

$env:NODE_ENV = "production"
$gradleCache = Join-Path $env:TEMP "thinkia-gradle-project-cache"
Set-Location (Join-Path $tempRoot "android")
Write-Host "Gradle assembleRelease (puede tardar varios minutos)…"
.\gradlew.bat assembleRelease --no-daemon --project-cache-dir $gradleCache -PreactNativeArchitectures=arm64-v8a
if ($LASTEXITCODE -ne 0) {
  throw "Gradle falló con código $LASTEXITCODE"
}

$apkSrc = Join-Path $tempRoot "android\app\build\outputs\apk\release\app-release.apk"
$artifacts = Join-Path $appRoot "artifacts"
if (-not (Test-Path $artifacts)) {
  New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
}
$apkDst = Join-Path $artifacts "Thinkia-Mobile-arm64-v8a-release.apk"
Copy-Item -Force $apkSrc $apkDst
Write-Host "OK → $apkDst"
