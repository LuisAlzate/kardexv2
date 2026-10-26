// Configuración e inicialización del cliente de Supabase
// Se asegura compatibilidad multiplataforma (Web, Android, iOS, Desktop)
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Obtenemos las credenciales desde las variables de entorno expuestas por Expo (prefijo EXPO_PUBLIC_)
const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const envAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validamos si las credenciales fueron provistas y no son el valor de plantilla por defecto
const isConfigured = Boolean(
  envUrl &&
  envAnonKey &&
  !envUrl.includes('tu-proyecto') &&
  !envUrl.includes('AQUI_TU_URL')
);

if (!isConfigured) {
  console.warn(
    '⚠️ [Supabase] No se encontraron credenciales válidas en .env. ' +
    'La aplicación funcionará en modo local / offline usando la base de datos SQLite.'
  );
}

// Fallback seguro: Evita que createClient lance una excepción fatal en tiempo de importación
// si el desarrollador aún no ha configurado su archivo .env.
const supabaseUrl = isConfigured && envUrl ? envUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = isConfigured && envAnonKey ? envAnonKey : 'placeholder-anon-key';

/**
 * Cliente global de Supabase configurado con persistencia de sesión a través de AsyncStorage.
 * Si no hay credenciales configuradas, apuntará a la URL placeholder y las llamadas fallarán
 * de forma controlada permitiendo que el AuthContext maneje el estado offline.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

