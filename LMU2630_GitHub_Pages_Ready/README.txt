# LMU-2630 Sim Pro - PWA Offline

Esta carpeta es una APP instalable 100% offline para iPhone y Android.

## Contenido
- index.html / simulador.html -> la app
- manifest.json -> config PWA
- sw.js -> cache offline
- icon-*.png -> iconos

## Como instalar en telefono

### iPhone (Safari):
1. Sube esta carpeta a tu servidor (ej: python -m http.server 8080)
2. Abre en Safari: http://TU_IP:8080
3. Botón Compartir (cuadro con flecha) -> "Añadir a pantalla de inicio"
4. Se instala como app nativa, funciona sin internet

### Android (Chrome):
1. Abre en Chrome: http://TU_IP:8080
2. Menú (3 puntos) -> "Instalar app" o "Añadir a pantalla de inicio"
3. Acepta, queda instalada

### Una vez instalada, funciona OFFLINE totalmente, guarda circuitos en localStorage.

## Para tu PC RUNEFORGE
python -m http.server 8080
# abre http://localhost:8080
