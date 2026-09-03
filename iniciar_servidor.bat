@echo off
title LMU-2630 Lab - Servidor RUNEFORGE
color 0B
echo ============================================
echo   LMU-2630 Sim Pro - RUNEFORGE Lab
echo   Servidor local para instalar como APP
echo ============================================
echo.
cd /d "%~dp0"
echo Carpeta: %CD%
echo.
echo Verificando Python...
python --version
if %errorlevel% neq 0 (
  echo ERROR: Python no encontrado. Instala Python desde python.org
  pause
  exit /b
)
echo.
echo Iniciando servidor en puerto 8080...
echo.
echo Una vez iniciado:
echo   - En esta PC abre: http://localhost:8080
echo   - En tu iPhone/Android (misma WiFi) abre: http://TU_IP:8080
echo   - Para saber tu IP: abre otra ventana y escribe ipconfig
echo.
echo NO CIERRES ESTA VENTANA mientras uses la app
echo Presiona Ctrl+C para detener el servidor
echo.
python -m http.server 8080 --bind 0.0.0.0
pause