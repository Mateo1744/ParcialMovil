/**
 * RESUMEN DEL ARCHIVO
 * Crea valores aleatorios y transforma las contraseñas en un hash. Así la
 * contraseña real nunca se guarda directamente en la base de datos.
 */

// Expo Crypto ofrece generación aleatoria y el algoritmo SHA-256.
import * as Crypto from 'expo-crypto';

// Convierte cada byte aleatorio en dos caracteres hexadecimales legibles.
function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    // padStart asegura que valores pequeños conserven dos caracteres.
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

// Genera un salt diferente para cada cuenta y dificulta comparar contraseñas.
export async function createSalt() {
  // Solicita 16 bytes aleatorios al sistema.
  const bytes = await Crypto.getRandomBytesAsync(16);
  return bytesToHex(bytes);
}

// Une contraseña y salt, y devuelve su resumen SHA-256.
export async function hashPassword(password: string, salt: string) {
  return Crypto.digestStringAsync(
    // Algoritmo de resumen usado para proteger el texto original.
    Crypto.CryptoDigestAlgorithm.SHA256,
    // Se añade el salt antes de calcular el hash.
    `${salt}:${password}`
  );
}
