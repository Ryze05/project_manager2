# Especificaciones: Gestor de proyectos colaborativo

Nov 5, 2026 · @Rommel Romero

## Resumen

Aplicación web para gestionar proyectos en equipo o en solitario: cada proyecto tiene miembros con roles, y el trabajo se organiza en tareas y subtareas que avanzan por un tablero, con comentarios y un panel personal de tareas asignadas.

Un proyecto individual es simplemente uno con un solo miembro, así que no existen dos flujos distintos. El proyecto se construye por niveles: no se empieza uno hasta tener el anterior funcionando y revisado.

## Alcance por niveles

### Nivel 1: núcleo (obligatorio)

- Registro, inicio y cierre de sesión (contraseña de mínimo 8 caracteres con una mayúscula y un número; sesión con un token de 24 horas)
- Crear, editar y borrar proyectos
- Miembros: añadir por email (usuarios ya registrados), quitar y listar, con roles de propietario y miembro
- Tareas con título, descripción, estado (por hacer, en curso, hecha), prioridad, fecha límite y responsable
- Tablero con una columna por estado y progreso de subtareas en cada tarjeta
- Subtareas con los mismos campos que una tarea, de un solo nivel de profundidad y con responsable propio
- Comentarios en tareas y en subtareas
- Panel "mis tareas" con todo lo asignado al usuario en todos sus proyectos, ordenado por fecha límite; por defecto muestra pendientes y en curso, con un interruptor para ver las hechas

### Nivel 2: valor añadido

- Etiquetas y filtros por etiqueta, responsable, prioridad o fecha
- Historial de actividad del proyecto
- Arrastrar y soltar tareas en el tablero (requiere guardar una posición por tarea)
- Invitaciones con aceptar o rechazar
- Panel de métricas del proyecto
- Archivar proyectos: solo el propietario, el proyecto pasa a una pestaña "Archivados" y queda en solo lectura hasta que se desarchiva
- Traspaso de la propiedad de un proyecto
- Varios propietarios por proyecto, promoviendo a miembros
- Sesión con token corto (unos 15 minutos) y token de renovación
- Mover una subtarea a otro padre y convertir una tarea en subtarea
- Iniciales de los responsables de las subtareas en cada tarjeta del tablero

### Nivel 3: extras

- Rol de solo lectura
- Notificaciones dentro de la aplicación
- Actualización del tablero en tiempo real
- Adjuntos en las tareas
- Docker Compose y pruebas end-to-end

## Roles y permisos

Hay dos roles dentro de cada proyecto, propietario y miembro. Quien no es miembro de un proyecto no puede ver ni consultar nada de él.

| Acción | Propietario | Miembro |
| --- | --- | --- |
| Ver el proyecto y su contenido | Sí | Sí |
| Crear, editar y mover tareas y subtareas | Sí | Sí |
| Borrar tareas y subtareas | Todas | Solo las que creó |
| Escribir comentarios | Sí | Sí |
| Editar un comentario | Solo el suyo | Solo el suyo |
| Borrar un comentario | Cualquiera | Solo el suyo |
| Añadir o quitar miembros | Sí | No |
| Editar o borrar el proyecto | Sí | No |

## Reglas de negocio

La lógica del back-end se concentra en mantener coherentes las tareas y sus subtareas y en respetar los permisos.

### Tareas y subtareas

- Una tarea no puede marcarse como hecha si tiene subtareas pendientes.
- Si se reabre o se crea una subtarea con la tarea padre hecha, la padre vuelve a "en curso".
- La tarea padre nunca se completa sola: cerrarla es siempre una decisión manual.
- Una subtarea no puede tener subtareas propias (un solo nivel).
- Una subtarea nace dentro de su tarea padre y no se puede mover a otro padre; tampoco se puede convertir una tarea existente en subtarea.
- El progreso (2/4) se calcula a partir del estado de las subtareas, no se almacena.
- Una subtarea puede tener un responsable distinto al de su tarea padre.
- Solo se puede asignar una tarea o subtarea a miembros del proyecto.

### Miembros y borrados

- Al crear un proyecto, su creador queda como propietario y único miembro.
- Solo se puede añadir a usuarios ya registrados, por su email. Si el email no corresponde a nadie, se muestra un error claro.
- Al quitar a un miembro, sus tareas y subtareas de ese proyecto quedan sin responsable.
- Cada proyecto tiene un único propietario, que no puede abandonarlo ni ser quitado: su única salida es borrar el proyecto.
- Al borrar una tarea se borran sus subtareas y comentarios.
- Al borrar un proyecto se borra todo su contenido.

## Modelo de datos

Cinco entidades. Las subtareas son tareas que apuntan a otra tarea mediante un campo "padre", sin tabla aparte.

| Entidad | Campos principales | Relaciones |
| --- | --- | --- |
| Usuario | nombre, email (único), contraseña cifrada, fecha de creación | Miembro de varios proyectos, creador y responsable de tareas, autor de comentarios |
| Proyecto | nombre, descripción, fechas de creación y actualización, fecha de archivado (opcional, nivel 2) | Tiene miembros y tareas |
| Miembro del proyecto | rol (propietario o miembro) | Une un usuario con un proyecto; clave compuesta usuario + proyecto |
| Tarea | título, descripción, estado, prioridad, fecha límite, fechas de creación y actualización | Proyecto (obligatorio), creador (obligatorio), un solo responsable (opcional), tarea padre (opcional) y comentarios |
| Comentario | contenido, fecha de creación, fecha de edición | Tarea o subtarea (obligatoria) y autor (obligatorio) |

Todas las entidades usan el mismo tipo de identificador. Al borrar un proyecto se borra todo su contenido, y al borrar una tarea se borran sus subtareas y comentarios. Que el responsable sea miembro del proyecto y que una subtarea no tenga subtareas propias se validan en el servicio.

## Flujo de uso

Ejemplo con un equipo que prepara una app de gestión de entrenamientos. Marta crea el proyecto y Pablo y Lucía se unen.

1. Marta se registra, inicia sesión y crea el proyecto "Gestor de entrenamientos". Queda como propietaria y única miembro.
2. Añade a Pablo y a Lucía escribiendo su email. Ambos ya estaban registrados y entran como miembros.
3. Crea tres tareas en el tablero, todas en "por hacer": diseñar la base de datos (Pablo, prioridad alta), pantalla de registro de entrenamientos (Lucía) y gráficas de progreso (sin responsable).
4. En "diseñar la base de datos" crea tres subtareas: definir entidades y diseñar relaciones (para Pablo) y revisar el diseño con el equipo (para ella). La tarjeta muestra el progreso 0/3.
5. Pablo abre "mis tareas", ve lo que tiene asignado ordenado por fecha y termina "definir entidades" y "diseñar relaciones". El progreso pasa a 2/3.
6. Pablo duda de una unidad de medida y lo escribe como comentario en la subtarea. Marta responde en el mismo hilo.
7. Pablo intenta cerrar la tarea padre, pero el sistema no le deja porque la revisión de Marta sigue pendiente. Cuando ella la marca como hecha, Pablo puede cerrarla.
8. Lucía deja el proyecto y Marta la quita de los miembros. Su tarea queda sin responsable y Marta se la reasigna a Pablo. Lucía ya no ve el proyecto.

## Pantallas

- **Login y registro:** formularios sencillos; sin sesión, el resto de rutas redirige al login.
- **Proyectos:** tarjetas con el nombre, el rol del usuario y el número de miembros, más un botón para crear un proyecto.
- **Tablero del proyecto:** tres columnas por estado; cada tarjeta muestra título, prioridad, fecha límite, responsable y progreso de subtareas. Las subtareas no aparecen como tarjetas, solo dentro de su tarea padre. Las tarjetas se ordenan por prioridad y, a igual prioridad, por fecha límite.
- **Detalle de tarea:** panel lateral o modal con los campos editables, la lista de subtareas y el hilo de comentarios.
- **Detalle de subtarea:** igual que una tarea, con un enlace para volver a la tarea padre.
- **Miembros:** lista con roles, campo de email para añadir y botón de quitar (solo para el propietario).
- **Mis tareas:** lista ordenada por fecha límite que indica el proyecto y, si es subtarea, su tarea padre. Por defecto solo muestra pendientes y en curso.

## Tecnologías y orden de construcción

Back-end con NestJS y front-end con Next.js, comunicados por una API REST protegida con JWT. La base de datos, el ORM y las librerías de apoyo son una propuesta pendiente de confirmar.

- **Back-end:** NestJS con TypeScript, un módulo por funcionalidad (autenticación, proyectos, tareas, comentarios).
- **Base de datos:** PostgreSQL con Prisma (propuesta).
- **Seguridad:** JWT, contraseñas cifradas con bcrypt y validación de entrada con class-validator.
- **Documentación de la API:** Swagger.
- **Front-end:** Next.js (React) con Tailwind CSS (propuesta).

Orden de construcción del nivel 1, para tener algo funcional lo antes posible:

1. Autenticación, proyectos y miembros
2. Tareas y tablero
3. Subtareas con sus reglas
4. Comentarios
5. Mis tareas

Si el tiempo aprieta se recorta por el final: primero "mis tareas". Los niveles 2 y 3 solo se abordan con el nivel 1 completo y revisado.

## Fuera de alcance

- Subtareas anidadas a más de un nivel
- Roles adicionales
- Integraciones externas
- Aplicación móvil

La checklist dentro de las tareas se descartó: las subtareas cubren ese uso.
