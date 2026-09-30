@echo off
:: =========================================================================
:: Script de Ejecución para Kardex V2 (Expo React Native)
:: Autor: Antigravity Assistant
:: Descripción: Facilita el inicio del proyecto en diferentes plataformas.
:: =========================================================================

:menu
cls
echo.
echo  =========================================
echo       MENU DE EJECUCION - KARDEX V2
echo  =========================================
echo  1. Iniciar Expo (General)
echo  2. Iniciar en Android
echo  3. Iniciar en iOS
echo  4. Iniciar en Web (Navegador)
echo  5. Salir
echo.
set /p op="Seleccione una opcion [1-5]: "

if "%op%"=="1" goto start
if "%op%"=="2" goto android
if "%op%"=="3" goto ios
if "%op%"=="4" goto web
if "%op%"=="5" exit
echo Opcion no valida.
pause
goto menu

:start
echo Iniciando Expo...
npm run start
pause
goto menu

:android
echo Iniciando en Android...
npm run android
pause
goto menu

:ios
echo Iniciando en iOS...
npm run ios
pause
goto menu

:web
echo Iniciando en Web...
npm run web
pause
goto menu
