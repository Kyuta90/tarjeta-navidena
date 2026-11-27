@echo off
title Subir Tarjeta Navidena a GitHub
cd /d "%~dp0"
echo ==============================================
echo 🎄 SUBIENDO CAMBIOS A GITHUB 🎅
echo ==============================================
echo.
git push origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo ==============================================
    echo ✅ SUBIDA EXITOSA A GITHUB!
    echo Ya puedes conectar tu repositorio en Render.com
    echo ==============================================
) else (
    echo ==============================================
    echo ⚠️ Hubo un detalle al subir. Revisa si te solicito inicio de sesion.
    echo ==============================================
)
echo.
pause
