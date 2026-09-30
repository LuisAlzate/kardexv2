const fs = require('fs');

async function testSupabaseConnection() {
  console.log('Validando conexión a Supabase...');
  
  try {
    // Leer el archivo .env
    const envContent = fs.readFileSync('.env', 'utf-8');
    
    // Parsear variables básicas
    let supabaseUrl = '';
    let supabaseKey = '';
    
    envContent.split('\n').forEach(line => {
      if (line.startsWith('EXPO_PUBLIC_SUPABASE_URL=')) {
        supabaseUrl = line.split('=')[1].trim();
      }
      if (line.startsWith('EXPO_PUBLIC_SUPABASE_ANON_KEY=')) {
        supabaseKey = line.split('=')[1].trim();
      }
    });

    if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('AQUI_TU_URL')) {
      console.error('❌ Error: Las variables EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY no están configuradas correctamente en el archivo .env');
      process.exit(1);
    }

    console.log(`URL detectada: ${supabaseUrl}`);
    console.log(`Haciendo ping a la API REST de Supabase...`);

    // Hacemos una petición REST normal probando la tabla "usuarios_sistema"
    // que creamos en el script SQL. Usamos "LIMIT 1" para no traer data innecesaria.
    const response = await fetch(`${supabaseUrl}/rest/v1/usuarios_sistema?select=*&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      console.log('✅ ¡Conexión exitosa! Las credenciales son válidas y la base de datos respondió correctamente.');
      const data = await response.json();
      console.log(`Respuesta de la tabla usuarios_sistema:`, data);
    } else {
      console.error(`❌ Error en la conexión. Código HTTP: ${response.status} ${response.statusText}`);
      const errText = await response.text();
      console.error(`Detalle: ${errText}`);
    }
  } catch (error) {
    console.error('❌ Error de red o ejecución:', error.message);
  }
}

testSupabaseConnection();
