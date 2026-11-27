@echo off
title Detener Servidor Navideno
echo Deteniendo procesos de node en el puerto 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a
)
echo Servidor detenido exitosamente.
pause
