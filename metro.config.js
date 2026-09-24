/**
 * RESUMEN DEL ARCHIVO
 * Configura Metro para que SQLite funcione también en el navegador mediante
 * su archivo WebAssembly y los encabezados de seguridad requeridos.
 */

// Obtiene la configuración oficial de Metro incluida con Expo.
const { getDefaultConfig } = require('expo/metro-config');

// Crea la configuración base para esta carpeta del proyecto.
const config = getDefaultConfig(__dirname);

// Permite que Metro reconozca los archivos .wasm usados por SQLite en web.
config.resolver.assetExts.push('wasm');

// Añade los encabezados que permiten ejecutar SQLite WebAssembly de forma aislada.
config.server.enhanceMiddleware = (middleware) => {
  return (request, response, next) => {
    response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    // Continúa con el procesamiento normal de la solicitud.
    return middleware(request, response, next);
  };
};

// Exporta la configuración para que Expo la use al iniciar el servidor.
module.exports = config;
