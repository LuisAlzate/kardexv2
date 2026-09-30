#!/bin/bash

# =========================================================================
# Script de Ejecución para Kardex V2 (Expo React Native)
# Autor: Antigravity Assistant
# Descripción: Facilita el inicio del proyecto en entornos Unix/macOS/Bash.
# =========================================================================

show_menu() {
    clear
    echo "========================================="
    echo "     MENU DE EJECUCION - KARDEX V2"
    echo "========================================="
    echo "1. Iniciar Expo (General)"
    echo "2. Iniciar en Android"
    echo "3. Iniciar en iOS"
    echo "4. Iniciar en Web (Navegador)"
    echo "5. Salir"
    echo ""
    read -p "Seleccione una opcion [1-5]: " op
}

while true; do
    show_menu
    case $op in
        1)
            echo "Iniciando Expo..."
            npm run start
            read -p "Presione [Enter] para volver al menú..."
            ;;
        2)
            echo "Iniciando en Android..."
            npm run android
            read -p "Presione [Enter] para volver al menú..."
            ;;
        3)
            echo "Iniciando en iOS..."
            npm run ios
            read -p "Presione [Enter] para volver al menú..."
            ;;
        4)
            echo "Iniciando en Web..."
            npm run web
            read -p "Presione [Enter] para volver al menú..."
            ;;
        5)
            exit 0
            ;;
        *)
            echo "Opcion no valida."
            read -p "Presione [Enter] para volver al menú..."
            ;;
    esac
done
