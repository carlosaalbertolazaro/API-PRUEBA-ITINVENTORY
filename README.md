# API-PRUEBA-ITINVENTORY

API académica para IT Inventory basada en `json-server` y `json-server-auth`. Incluye registro, login con JWT y CRUD protegido de equipos.

## Requisitos y ejecución

Se necesita Node.js 18 o superior.

```powershell
npm install
npm start
```

Valores predeterminados:

- URL local: `http://localhost:3000`.
- Desde el emulador Android: `http://10.0.2.2:3000`.
- Base de datos: `db.json` dentro de este proyecto.
- Host: `0.0.0.0`, para permitir pruebas desde un teléfono en la misma red.

Variables de entorno opcionales:

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto HTTP; predeterminado `3000`. |
| `HOST` | Interfaz de escucha; predeterminado `0.0.0.0`. |
| `DB_FILE` | Ruta a otra base JSON para no modificar `db.json`. |

Ejemplo en PowerShell con una base separada:

```powershell
$env:DB_FILE = "C:\ruta\a\db-pruebas.json"
$env:PORT = "3000"
npm start
```

El archivo indicado por `DB_FILE` debe existir y contener al menos las colecciones `users` y `equipos`.

## Cuentas iniciales

| Correo | Contraseña |
| --- | --- |
| `admin@inventory.local` | `admin1` |
| `carlos@inventory.local` | `dellpro` |

También puedes crear una cuenta desde la app o con `POST /register`. Las contraseñas se almacenan como hash bcrypt y las respuestas de autenticación no incluyen el campo `password`.

## Autenticación

### Registro

```http
POST /register
Content-Type: application/json

{
  "email": "nuevo@correo.com",
  "password": "clave123"
}
```

Devuelve `201` con `accessToken` y `user`.

### Login

```http
POST /login
Content-Type: application/json

{
  "email": "admin@inventory.local",
  "password": "admin1"
}
```

Devuelve `200` con el mismo formato de sesión. Para acceder al inventario, envía:

```http
Authorization: Bearer <accessToken>
```

## Equipos

Todos estos endpoints requieren un token válido:

| Método | Ruta | Operación |
| --- | --- | --- |
| `GET` | `/equipos` | Listar equipos. |
| `GET` | `/equipos/{id}` | Consultar un equipo. |
| `POST` | `/equipos` | Crear un equipo. |
| `PATCH` | `/equipos/{id}` | Actualizar campos de un equipo. |
| `PUT` | `/equipos/{id}` | Reemplazar un equipo. |
| `DELETE` | `/equipos/{id}` | Eliminar un equipo. |

Ejemplo de cuerpo para crear o reemplazar:

```json
{
  "numeroSerie": "SN-HP-004",
  "marca": "HP",
  "modelo": "ProDesk 600 G6",
  "fechaAdquisicion": "2024-02-29",
  "estado": "DISPONIBLE",
  "numeroInventario": 1004,
  "ubicacion": "Oficina 104"
}
```

Reglas de validación:

- Los campos de texto son obligatorios.
- `fechaAdquisicion` usa `AAAA-MM-DD` y debe ser una fecha real.
- `numeroInventario` debe ser un entero mayor que cero.
- `estado` admite `DISPONIBLE`, `EN_USO`, `MANTENIMIENTO` o `BAJA`.
- El número de serie (sin distinguir mayúsculas) y el número de inventario deben ser únicos.

Respuestas principales: `400` para datos o JSON inválidos, `401` sin autenticación válida, `404` si el equipo no existe y `409` ante duplicados. La colección `users` también está protegida y la ruta especial `/db` está deshabilitada para no exponer toda la base.

## Pruebas

```powershell
npm test
```

Las pruebas de integración levantan el servidor en un puerto libre y usan una base temporal que se elimina al terminar; no modifican `db.json`. Cubren autenticación, autorización, validaciones y el CRUD completo.

> Este backend está pensado para desarrollo académico local. Para producción harían falta, entre otros controles, HTTPS, gestión segura del secreto JWT, persistencia robusta, autorización por roles y una política de recuperación de cuentas.
