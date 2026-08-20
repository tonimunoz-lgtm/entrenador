# Forja21 — Entrenador personal hacia Granollers

App web (PWA) instalable en el móvil, mobile-first, con tu plan completo de
entreno, nutrición, suplementación y control de peso hasta junio de 2027.

## Qué hay dentro

```
forja21/
├── index.html          ← página principal (Vercel la sirve por defecto)
├── manifest.json        ← hace la app instalable en el móvil
├── sw.js                ← service worker (funciona sin conexión)
├── vercel.json           ← cabeceras de caché
├── css/style.css
├── js/data.js             ← todo tu plan (fases, semanas, comidas, pesos objetivo)
├── js/app.js               ← lógica de la app
└── icons/                  ← iconos generados para el manifest
```

No hay build step ni dependencias: es HTML + CSS + JS puro, así que Vercel
lo sirve tal cual.

## Desplegar en Vercel + GitHub

1. Crea un repositorio nuevo en GitHub y sube esta carpeta (`forja21/`) tal
   cual, con `index.html` en la raíz del repo.
   ```
   git init
   git add .
   git commit -m "Forja21 v2"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/forja21.git
   git push -u origin main
   ```
2. Entra en [vercel.com](https://vercel.com) → **Add New Project** → importa
   el repositorio.
3. Framework preset: **Other** (no hace falta build command ni output
   directory, dejar en blanco). Vercel detecta `index.html` en la raíz
   automáticamente.
4. Deploy. Ya tienes tu URL (`https://forja21-tuusuario.vercel.app`).

## Instalar en el móvil

- **Android (Chrome)**: abre la URL → menú (⋮) → "Añadir a pantalla de
  inicio". También puede aparecer un botón de instalación dentro de la
  propia app (icono de descarga arriba a la derecha) — una vez instalada,
  ese botón desaparece solo.
- **iPhone (Safari)**: abre la URL → botón compartir → "Añadir a pantalla
  de inicio". (iOS no soporta el prompt automático de instalación; este
  paso manual es el único camino, es una limitación de Apple, no de la app.)

Una vez instalada abre a pantalla completa, sin barra de navegador, y
funciona sin conexión gracias al service worker.

## Cómo funciona

- **Bienvenida (solo la primera vez)**: te explica el plan y sus objetivos, y te
  pide tu nombre, el lunes en que empiezas y tu peso de hoy. A partir de ahí no
  vuelve a aparecer — pasas directo al panel principal.
- **Hoy**: panel de inicio con saludo personalizado y 4 indicadores rápidos
  (semana actual, % de progreso de peso, entrenos hechos esta semana,
  suplementos tomados hoy), el entreno y la nutrición del día calculados
  automáticamente a partir de la fecha (nunca hay que saber "en qué semana
  estoy"), el checklist de suplementos con marca y dosis, avisos cuando mañana
  toca báscula, y el botón para registrar la sesión al terminar.
- **Calendario**: vista Semana (como antes) y vista **Mes**, con un punto de
  color por día según el tipo de entreno — toca cualquier día para ver su
  ficha completa y registrar una sesión si aplica.
- **Fases**: las 5 fases de todo el plan (ago. 2026 → jun. 2027).
- **Peso**: pesaje semanal, comparación con el objetivo, histórico completo.
- **Ajustes**: perfil, zonas de FC, fichas de suplementación y el historial de
  todas tus sesiones (con el ritmo objetivo del día y la desviación real).

### Seguimiento de ritmo
Cuando un día tiene un ritmo objetivo (ej. series a 4:45 min/km), al registrar
la sesión introduces tu ritmo real y la app calcula automáticamente la
desviación (ej. "+0:10/km" o "−0:05/km") y la guarda en el historial.

### Ejemplos de ejercicios
Cada ejercicio de gimnasio tiene un enlace "▶ Ver ejemplo" que abre una
búsqueda en YouTube con el nombre exacto del ejercicio — así siempre ves un
vídeo actualizado de la técnica o la máquina, sin depender de imágenes fijas
que puedan quedar desactualizadas o rotas.

Todos los datos (peso, sesiones, checklist, perfil) se guardan **solo en el
dispositivo** (localStorage) — no hace falta cuenta ni conexión. Si en algún
momento quieres sincronizar entre varios dispositivos, se puede añadir
Firebase (Firestore) sin tocar el resto de la app.

## Ajuste importante antes de usarla

En el onboarding (o luego en **Ajustes → Fecha de inicio del plan**) hay que
poner el **lunes** de tu semana 1 real. Las semanas van de lunes a domingo,
con el sábado como día de tirada larga y pesaje. Si esa fecha está en el
futuro, la app te lo dice claramente en vez de mostrar contenido de un día
que aún no toca.

## Notas sobre los iconos

Los iconos del manifest (192px, 512px, 512px maskable, apple-touch-icon)
se generaron localmente con un patrón de "pulso" en los colores de tus
zonas de frecuencia cardíaca (azul Z2 → verde Z3 → ámbar Z4), sin depender
de ninguna API externa de imágenes — así el proyecto no tiene ninguna
dependencia ni clave de API que gestionar para funcionar.
