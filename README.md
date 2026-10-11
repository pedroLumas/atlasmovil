# ATLAS · versión móvil

Lecciones de historia para leer en el móvil, con un mapa en anillo que se ilumina según lo que lees.
Estilo «Cristal negro»: negro puro, gris oscuro y vidrio. Son 244 lecciones (generado el 2026-10-11).

- **Lecciones:** lista con búsqueda, filtros por estado y región, y lectura a pantalla completa.
- **Mapa:** cada punto es una lección; se ilumina al leerla hasta el final. Las cuerdas unen lecciones relacionadas.
- **Sin conexión:** en «Ajustes» (arriba a la derecha) se pueden guardar todas las lecciones en el móvil.
- **Progreso:** se guarda solo en el navegador del móvil.

## Ver en el móvil (GitHub Pages)

1. En el repositorio: **Settings → Pages → Build and deployment → Deploy from a branch**.
2. Rama `main`, carpeta `/ (root)` y **Save**.
3. A los pocos minutos queda en `https://<usuario>.github.io/<repositorio>/`.
4. En el móvil, abre ese enlace y usa **Añadir a pantalla de inicio** (en iPhone: Compartir → Añadir a pantalla de inicio).

## Acceso con clave

El contenido (lecciones, índice e imágenes) está **cifrado** con AES-256-GCM: sin la clave, el repositorio solo contiene datos ilegibles.
La clave se escribe una vez en cada dispositivo y se queda guardada (en Ajustes → «Bloquear este dispositivo» se olvida).

## Aviso

Las lecciones se redactaron con ayuda de IA y están **sin verificar** por una persona (`verificado: no`): contrasta los datos importantes.
Las imágenes proceden de Wikimedia Commons, con su autoría y licencia en el pie de cada una. Licencia del contenido: CC BY-NC-SA 4.0.

## Cómo se genera

Esta carpeta es el resultado de `herramientas/construir-movil.py` del paquete ATLAS de escritorio. No se edita a mano:
cuando cambian las lecciones se vuelve a generar (con la misma clave) y se hace commit.
