# Documentación de EntreMóvil

## Resumen

EntreMóvil es una aplicación desarrollada con Expo, React Native, Expo Router y SQLite. Permite registrar cuentas, aprobar usuarios, controlar el acceso por rol, administrar clientes y productos, y registrar compras conservando su encabezado, detalles e historial.

## Roles

- **Administrador:** aprueba solicitudes, asigna roles y administra clientes, productos y compras.
- **Cliente:** completa y actualiza su perfil, consulta productos, registra compras y consulta su propio historial.

## Organización del código

### `src/app`

Contiene las rutas de Expo Router. Cada archivo representa una dirección de la aplicación y conecta esa ruta con su pantalla correspondiente.

- `_layout.tsx`: abre SQLite, comparte la autenticación y registra las pantallas.
- `index.tsx`: decide si la aplicación abre Login o Home.
- `login.tsx` y `register.tsx`: rutas públicas.
- `home.tsx`: ruta del menú principal.
- `perfil.tsx`: ruta para completar el perfil inicial.
- `clientes.tsx`, `productos.tsx`, `encabezados.tsx` y `detalles.tsx`: módulos principales.
- `solicitudes.tsx`: aprobación de cuentas.
- `nueva-compra.tsx`: creación de compras para clientes.

### `screens`

Contiene la interfaz y la lógica de cada pantalla. Al inicio de cada archivo hay un resumen; dentro del archivo hay comentarios que explican estados, validaciones, consultas, permisos, eventos y elementos visuales.

### `src/context/auth-context.tsx`

Centraliza la sesión. Permite registrar, iniciar y cerrar sesión, recuperar una sesión anterior y mantener actualizado el correo de la cuenta conectada.

### `src/database`

- `database.ts`: crea las tablas, ejecuta migraciones y registra el administrador inicial.
- `password.ts`: protege contraseñas con un salt aleatorio y SHA-256.
- `purchases.ts`: contiene las transacciones de compra y mantiene sincronizados stock, encabezados, detalles y totales.

## Base de datos

- **Login:** credenciales, estado y rol.
- **Cliente:** datos personales relacionados con una cuenta.
- **Producto:** nombre, descripción, precio y stock.
- **Encabezado:** cliente, fecha y total de una compra.
- **Detalles:** productos, cantidades y subtotales de la compra.
- **Sesion:** conserva la cuenta conectada.

## Reglas principales

1. Una cuenta nueva queda pendiente hasta que un administrador la procese.
2. Una cuenta pendiente o inactiva no puede iniciar sesión.
3. El cliente debe completar su perfil en el primer ingreso.
4. El cliente solo puede consultar sus propios datos y compras.
5. No se puede comprar una cantidad superior al stock disponible.
6. Cada compra se registra mediante una transacción para evitar datos incompletos.
7. Al editar o eliminar detalles se ajusta el stock y se recalcula el total.
8. Los clientes o productos con historial no se eliminan, para conservar las relaciones.

## Archivos de configuración

- `app.json`: configuración general de Expo, plataformas y complemento de SQLite.
- `package.json`: dependencias y comandos del proyecto.
- `metro.config.js`: soporte de SQLite WebAssembly y encabezados necesarios en web.
- `tsconfig.json`: configuración de TypeScript y alias de importación.
- `.gitignore`: excluye dependencias, compilaciones y archivos temporales.

Los archivos JSON no admiten comentarios. Por eso se explican aquí en lugar de modificarlos y arriesgar que Expo deje de leerlos.

## Ejecución en web

Para conservar la misma base de datos del navegador se debe usar siempre el mismo navegador, perfil y puerto:

```powershell
npx expo start --clear --port 8082
```

Abrir una sola pestaña en `http://localhost:8082`. SQLite web guarda los datos de forma separada para cada puerto.

## Administrador inicial

- Correo: `davidnaranjo337@gmail.com`
- Contraseña: `123456`

