# Control Guardia — PRD

## Objetivo
App móvil (React Native / Expo) para que un guardia de seguridad controle sus tareas, rondas, incidencias y horarios durante el turno. Sin login: solo se registra el nombre del guardia al inicio.

## Alcance MVP
- Identificación por nombre (persistido con AsyncStorage)
- Panel de control con reloj en tiempo real, estado de turno y acciones rápidas
- Fichar entrada / salida (con control de estado)
- Rondas (iniciar / finalizar)
- Descansos (iniciar / finalizar)
- Gestión de Naves (añadir, listar, eliminar con long-press)
- Gestión de Tareas (crear, marcar como completada, eliminar; opcionalmente asociada a una nave)
- Reporte de Incidencias con tipo, ubicación (nave), descripción y foto de evidencia (Emergent Object Storage)
- Control Horario: cronología de todos los eventos con filtro Todos/Hoy
- Exportación del control horario a Excel (.xlsx) y PDF (.pdf)

## Stack
- Frontend: Expo SDK 54 + expo-router + React Native, expo-image, expo-linear-gradient, expo-haptics, expo-image-picker, MaterialCommunityIcons
- Backend: FastAPI + Motor (MongoDB) + openpyxl (Excel) + reportlab (PDF)
- Storage: Emergent Object Storage (fotos de incidencias)

## Endpoints backend (`/api`)
- GET `/` health
- Naves: GET `/naves`, POST `/naves`, DELETE `/naves/{id}`
- Events: GET `/events?guard=`, POST `/events`, DELETE `/events/{id}`
  - Tipos válidos: entrada, salida, ronda_inicio, ronda_fin, tarea, incidencia, descanso_inicio, descanso_fin
- Tasks: GET `/tasks`, POST `/tasks`, POST `/tasks/{id}/toggle?guard=`, DELETE `/tasks/{id}`
- Incidents: GET `/incidents?guard=`, POST `/incidents` (además crea evento tipo incidencia)
- Upload: POST `/upload` (multipart, guarda en Emergent Object Storage), GET `/files/{path}`
- Export: GET `/export/excel?guard=`, GET `/export/pdf?guard=`

## Diseño
- Personalidad "Dark-First Utility": fondo `#121212`, acento naranja `#FF9800`
- Bottom tabs: Panel · Naves · Tareas · Control
- Modales: nueva-nave, nueva-tarea, incidencia

## Testing
- Backend: 17/17 tests pytest (endpoints y Object Storage)
- Frontend: flujos críticos verificados por testing agent

## Pendiente / Futuro
- Configurar múltiples guardias por app (perfiles)
- Turnos programados
- Notificaciones de tareas
- Firma electrónica de fichajes
