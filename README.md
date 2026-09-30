# Kardex V2 - Construfluidos S.A.S

Sistema de gestión de inventarios (Kardex) multiplataforma diseñado para **CONSTRUFLUIDOS S.A.S**. Esta aplicación permite el seguimiento de herramientas, materiales y movimientos de almacén con soporte para operación Online (Supabase) y Offline (SQLite).

## 🚀 Plataformas Soportadas
- **Web**: Versión responsiva para navegadores.
- **Android**: Aplicación nativa (.apk).
- **Escritorio**: Versión standalone para Windows (Electron).

---

## 📋 Requisitos Previos

Antes de comenzar, asegúrese de tener instalado:
- **Node.js**: Versión 18 o superior.
- **npm** o **yarn**.
- **Expo CLI**: `npm install -g expo-cli`.
- **Java JDK 17**: Necesario para compilaciones de Android.
- **Android Studio & SDK**: Configurado con las variables de entorno `ANDROID_HOME`.

---

## 🛠️ Instalación de Dependencias

1. Clone el repositorio o descargue los archivos.
2. Abra una terminal en la carpeta raíz del proyecto.
3. Instale las dependencias de Node:
   ```bash
   npm install
   ```
4. Verifique que las dependencias de Electron estén presentes:
   ```bash
   npm install electron electron-builder electron-is-dev electron-serve --save-dev
   ```

---

## 🌐 Configuración de Variables de Entorno

Cree un archivo `.env` en el directorio raíz con las siguientes claves:
```env
EXPO_PUBLIC_SUPABASE_URL=SU_URL_DE_SUPABASE
EXPO_PUBLIC_SUPABASE_ANON_KEY=SU_LLAVE_ANONIMA
```

---

## 🏃 Cómo Ejecutar el Proyecto

### 1. Entorno Web (Expo Web)
Para ejecutar la aplicación en el navegador:
```bash
npx expo start --web
```

### 2. Entorno Android (Desarrollo y USB)
Asegúrese de tener un dispositivo físico conectado con depuración USB activa o un emulador:
```bash
npm run android
```

### 3. Entorno de Escritorio (Electron)
Para ejecutar la versión de PC (Standalone):
```bash
npm run desktop
```
*Nota: Este comando exporta primero la versión web a la carpeta `dist` y luego lanza Electron.*

---

## 📦 Generación de Entregables (Builds)

### Generar APK de Android (Release)
```bash
cd android
./gradlew assembleRelease
```
El archivo se encontrará en `android/app/build/outputs/apk/release/app-release.apk`.

### Generar Ejecutable Windows (.exe)
```bash
npm run build:desktop
```
El instalador se generará en la carpeta `dist_electron`.

---

## 🗄️ Arquitectura de Datos
- **Online**: Sincronización en tiempo real con Supabase.
- **Offline**: Base de datos local `expo-sqlite` que permite login y movimientos básicos sin internet.
- **UUID**: Identificadores únicos universales para compatibilidad total entre entornos.

---
**Desarrollado para Construfluidos S.A.S**
*Kardex V2 - Gestión Inteligente de Inventarios*
