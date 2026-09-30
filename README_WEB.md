# Kardex V2 - Guía de Instalación Web

Este documento contiene las instrucciones mínimas para ejecutar la versión **Web** del sistema Kardex V2 de Construfluidos S.A.S.

## 📋 Requisitos Mínimos
- **Node.js**: Versión 18 o superior.
- **npm** (incluido con Node.js).

---

## 🛠️ Instalación Rápida

1. Instale las dependencias del proyecto:
   ```bash
   npm install
   ```

2. Configure las credenciales de la base de datos:
   Cree un archivo llamado `.env` en la raíz del proyecto y pegue lo siguiente (reemplace con sus datos):
   ```env
   EXPO_PUBLIC_SUPABASE_URL=SU_URL_DE_SUPABASE
   EXPO_PUBLIC_SUPABASE_ANON_KEY=SU_LLAVE_ANONIMA
   ```

---

## 🚀 Ejecución en Navegador

Para iniciar el servidor de desarrollo web:
```bash
npx expo start --web
```

La aplicación se abrirá automáticamente en su navegador predeterminado (usualmente en `http://localhost:8081`).

---

## 📦 Generar Versión de Producción (Web)

Si desea generar los archivos estáticos para subirlos a un servidor o hosting:
```bash
npx expo export --platform web
```
Los archivos finales quedarán en la carpeta `dist`.

---

## ☁️ Requisitos del Servidor de Producción

A diferencia del entorno de desarrollo, la versión de producción **NO requiere Node.js** en el servidor. Al ser una aplicación de archivos estáticos (SPA), solo necesita:

1. **Servidor Web**: Cualquier servidor capaz de servir archivos estáticos (Nginx, Apache, IIS, Amazon S3, Vercel, Netlify).
2. **Protocolo HTTPS**: Es altamente recomendado para la seguridad de las conexiones con Supabase.
3. **Redirección de Rutas**: Si utiliza navegación interna (React Navigation), el servidor debe estar configurado para redirigir todas las peticiones al `index.html`.
4. **Conectividad**: El cliente final debe tener acceso a internet para comunicarse con la API de Supabase.

> [!IMPORTANT]
> **No abra el archivo `index.html` directamente**: Si intenta abrir el archivo haciendo doble clic (protocolo `file://`), la aplicación **no funcionará** debido a restricciones de seguridad del navegador (CORS) y problemas de rutas. Siempre debe servirse a través de un servidor HTTP o usarse la versión de escritorio de Electron.
