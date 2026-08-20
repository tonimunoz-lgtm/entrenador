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
├── js/data.js            ← todo tu plan (fases, semanas, comidas, pesos objetivo)
├── js/app.js              ← lógica de la app
└── icons/                 ← iconos generados para el manifest
```

No hay build step ni dependencias: es HTML + CSS + JS puro, así que Vercel
lo sirve tal cual.

## Desplegar en Vercel + GitHub

1. Crea un repositorio nuevo en GitHub y sube esta carpeta (`forja21/`) tal
   cual, con `index.html` en la raíz del repo.
   ```
   git init
   git add .
   git commit -m "Forja21 v1"
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
  propia app (icono de descarga arriba a la derecha).
- **iPhone (Safari)**: abre la URL → botón compartir → "Añadir a pantalla
  de inicio". (iOS no soporta el prompt automático de instalación; este
  paso manual es el único camino, es una limitación de Apple, no de la app.)

Una vez instalada abre a pantalla completa, sin barra de navegador, y
funciona sin conexión gracias al service worker.

## Cómo funciona

- **Hoy**: qué toca entrenar y comer hoy según la fecha, con checklist de
  suplementos y botón para registrar la sesión al terminar (distancia,
  tiempo, ritmo, pulso medio, notas).
- **Semana**: las 7 tarjetas de la semana actual, cada una abre el detalle
  completo en una ficha.
- **Fases**: las 5 fases de todo el plan (ago. 2026 → jun. 2027) con su
  rango de peso, kcal objetivo y foco de entreno.
- **Peso**: pesaje semanal (sábados en ayunas), comparación automática con
  el objetivo de esa semana, e histórico completo.
- **Ajustes**: nombre, fecha de inicio del plan (para recalcular semanas si
  cambias de fecha real de arranque), zonas de FC, fichas de suplementación
  y el historial de todas tus sesiones registradas.

Todos los datos (peso, sesiones, checklist de suplementos) se guardan
**solo en el dispositivo** (localStorage) — no hace falta cuenta ni
conexión. Si en algún momento quieres sincronizar entre varios
dispositivos (móvil + ordenador), se puede añadir Firebase (Firestore) sin
tocar el resto de la app — dímelo cuando quieras y lo conectamos con tus
credenciales de un proyecto Firebase.

## Ajuste importante antes de usarla

En **Ajustes → Fecha de inicio del plan** hay que poner el **lunes** de tu
semana 1 real (por defecto está puesto el 24 de agosto de 2026). Las
semanas del plan van de lunes a domingo, con el sábado como día de tirada
larga y pesaje — así que ese campo debe ser siempre un lunes para que todo
cuadre con el calendario de fases y pesos.

## Notas sobre los iconos

Los iconos del manifest (192px, 512px, 512px maskable, apple-touch-icon)
se generaron localmente con un patrón de "pulso" en los colores de tus
zonas de frecuencia cardíaca (azul Z2 → verde Z3 → ámbar Z4), sin depender
de ninguna API externa de imágenes — así el proyecto no tiene ninguna
dependencia ni clave de API que gestionar para funcionar.
