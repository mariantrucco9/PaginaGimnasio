# PaginaGimnasio — Workout Tracker

Aplicación monolítica: React/Vite, API REST en Go y PostgreSQL. Para despliegue, el frontend puede publicarse en Vercel, la API en Render y la base de datos en Supabase.

## Iniciar el entorno

```sh
cp .env.example .env
# Cambia las claves de ejemplo en .env antes de usar datos reales.
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:8080
- PostgreSQL: `localhost:5432`

El backend aplica las migraciones GORM al iniciar. Air observa los archivos Go y reinicia la API ante cambios; Vite hace lo mismo para el frontend. Los datos locales de PostgreSQL persisten en el volumen `postgres_data`.
Si el puerto local `5432` ya está ocupado, cambia `POSTGRES_PORT` en `.env`.
Para `POSTGRES_PASSWORD` local, usa caracteres seguros para URL (letras, números, guion o guion bajo), ya que Compose construye con ese valor el `DB_URL` del backend.

Los valores por defecto del Compose son solo para desarrollo local. No expongas esos puertos ni uses las claves de ejemplo en un entorno accesible desde Internet.

## Variables de entorno para despliegue

- **Render (backend):** usa `backend` como directorio raíz, `go build -o bin/api ./cmd/api` como comando de build y `./bin/api` como comando de inicio. Configura `DB_URL` con la cadena PostgreSQL de Supabase, `JWT_SECRET` y `PIN_HMAC_SECRET` con secretos aleatorios de al menos 32 bytes, y `CORS_ALLOWED_ORIGINS` con el dominio exacto de Vercel (sin barra final). Render proporciona `PORT` automáticamente.
- **Vercel (frontend):** usa `frontend` como directorio raíz, `npm run build` como comando de build y `dist` como directorio de salida. Configura `VITE_API_URL` con la URL pública del backend de Render, sin una ruta adicional; el frontend agrega `/api/...`.
- **Supabase (base de datos):** copia la cadena de conexión PostgreSQL del proyecto a `DB_URL`. Usa el modo SSL requerido por esa cadena (`sslmode=require` para las conexiones que lo requieran). Si la contraseña contiene caracteres reservados de URL, usa la versión codificada que entrega Supabase.

La migración del código no copia registros desde la antigua base MySQL. La API creará el esquema PostgreSQL al arrancar, pero para conservar usuarios, rutinas y sesiones hay que exportar/importar los datos a PostgreSQL y revisar las secuencias de IDs antes de habilitar el servicio. El volumen local `mysql_data` tampoco se elimina ni se convierte automáticamente.

## Poblar la rutina Powerbuilding

El seed usa `UserID = 1`, abre la base con la configuración normal del backend y aplica las migraciones antes de cargar los datos. Inicia PostgreSQL con Compose y ejecuta:

```sh
docker compose run --build --rm backend go run ./cmd/seed
```

La operación es transaccional e idempotente: se puede repetir sin duplicar ejercicios, la rutina compuesta, días ni posiciones de ejercicios.

## Alta privada de usuarios

No hay endpoint público de registro. Para crear usuarios, guarda en `users.pin_digest` el HMAC-SHA-256 del PIN usando `PIN_HMAC_SECRET` como clave. El PIN no se guarda en claro. Por ejemplo, con Python 3 y el `.env` cargado en el entorno:

```sh
python3 -c 'import getpass,hmac,hashlib,os; pin=getpass.getpass("PIN de 6 dígitos: "); print(hmac.new(os.environ["PIN_HMAC_SECRET"].encode(),pin.encode(),hashlib.sha256).hexdigest())'
```

Carga primero las variables del archivo en la sesión de terminal y calcula el digest:

```sh
set -a
. ./.env
set +a
python3 -c 'import getpass,hmac,hashlib,os; pin=getpass.getpass("PIN de 6 dígitos: "); print(hmac.new(os.environ["PIN_HMAC_SECRET"].encode(),pin.encode(),hashlib.sha256).hexdigest())'
```

Inserta el digest resultante en PostgreSQL, opcionalmente junto con el nombre:

```sql
INSERT INTO users (pin_digest, name, created_at, updated_at)
VALUES ('<digest-HMAC>', 'Nombre', NOW(), NOW());
```

El secreto usado para generar el digest debe ser el mismo `PIN_HMAC_SECRET` configurado en el backend. Si se rota, deben actualizarse los digests existentes.

## API inicial

- `POST /api/auth/login` — recibe `{"pin":"123456"}` y devuelve un token Bearer firmado y los datos básicos del usuario.
- `GET /api/routines` — devuelve solo las rutinas del usuario autenticado; requiere `Authorization: Bearer <token>`.
- `GET /health` — comprobación básica de disponibilidad.

## Entrenamientos y calendario

Las rutas de esta sección requieren `Authorization: Bearer <token>`:

- `POST /api/workouts` — crea u obtiene la sesión del usuario para una rutina y fecha (`{"routineId":1,"date":"2026-11-03"}`). Al crearla, precarga los ejercicios planificados. Devuelve `201` si la crea y `200` si ya existía.
- `GET /api/routines/:id/workouts` — devuelve las sesiones anteriores de esa rutina con al menos una serie.
- `GET /api/workouts/:id` — devuelve una sesión del usuario con sus ejercicios y series para consultar el historial.
- `POST /api/workouts/:id/complete` — marca la sesión como terminada. La fecha de finalización queda guardada en `completed_at`; las sesiones terminadas pasan a ser de solo lectura.
- `POST /api/exercise-logs/:id/sets` — agrega una serie a un ejercicio de una sesión del usuario (`{"weight":100.5,"reps":8,"weightUnit":"kg"}`). El número de serie se asigna automáticamente.
- `POST /api/workouts/:id/extra-exercise` — agrega un ejercicio a una sesión, aunque no pertenezca a la rutina (`{"exerciseId":5,"exerciseName":"Bíceps alterno"}`). `exerciseId` puede omitirse para un ejercicio personalizado.
- `GET /api/calendar` — devuelve las fechas con al menos una serie o una sesión finalizada por el usuario, en formato `YYYY-MM-DD`.

Las operaciones verifican que la rutina, sesión o ejercicio de entrenamiento correspondan al usuario autenticado. Finalizar la sesión es opcional; el calendario cuenta días con al menos una serie o una sesión finalizada.

### API de rutinas compuestas

- `GET /api/programs` — devuelve las rutinas compuestas del usuario, con días y ejercicios.
- `POST /api/programs` — crea una rutina compuesta con días y ejercicios.
- `PUT /api/programs/:id` — edita el nombre, los días y los ejercicios de la rutina compuesta.
- `DELETE /api/programs/:id` — archiva la composición y sus días; no elimina sesiones ni series históricas.

## Flujo del frontend

Después de iniciar sesión, el dashboard está disponible en `/app/dashboard`. El calendario muestra inicialmente el mes actual y permite recorrer meses o abrir la vista anual para consultar otros años. El bloque de una rutina compuesta abre `/app/programs/:programId`, donde se muestran sus días y ejercicios. Desde allí, cada día lleva a `/app/workouts/:routineId`, una pantalla dedicada para cargar ejercicios y series, consultar sesiones anteriores y finalizar opcionalmente el entrenamiento. Los ejercicios extra quedan asociados solo a esa sesión; no cambian la definición de la rutina. El frontend usa `localStorage` para conservar el JWT durante la sesión del navegador y lo adjunta a las rutas protegidas.

## Identidad visual del sitio

Coloca el ícono o foto que quieras usar como favicon en `frontend/public/branding/workout-tracker.png`. Vite lo servirá como `/branding/workout-tracker.png`; se usa en la pestaña del navegador y puede usarse como favicon en resultados de búsqueda una vez que el sitio esté publicado e indexado.
