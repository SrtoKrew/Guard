#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

## user_problem_statement: "Control Diario Asergrup" - app para vigilantes de seguridad (Cándido Zamora). Sin login tradicional: se ingresa nombre y se elige servicio/turno para iniciar sesión de turno. Funciones: fichaje de turno con reloj y tiempo transcurrido, gestión de "naves" (ubicaciones) con checklist y acciones personalizadas, gestión de vehículos (Cerámicas) con drag-and-drop, incidencias con foto, llamadas de centralita, exportación de control a Excel/PDF, auto-finalización de turno según horario (Madrid, margen 1-1.5h), historial de turnos anteriores, notificaciones Toast. Todo en español.

## backend:
  - task: "Timezone Europe/Madrid enforcement + auto-finalize background loop"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "to_madrid()/now_madrid() helpers added, compute_scheduled_end() sets scheduled_end based on turno_tipo (dia 08-20, noche 22-06 or 20:30-06 weekend). _maybe_autofinalize() closes turno 90 min (AUTOFINALIZE_GRACE_MINUTES) after scheduled_end; legacy turnos without scheduled_end close after 16h (LEGACY_TURNO_MAX_HOURS). _autofinalize_loop() runs every 120s as background asyncio task from app startup. Needs verification that turnos auto-close at the right time and that active turno lookups (/turnos/active) trigger autofinalize check too."

  - task: "PDF export report (/api/export/pdf)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Report includes: guard name, service, turno type, día de servicio, horas trabajadas (info table), histórico de novedades table with incidencia/llamada_centralita rows highlighted in red/pink, detalle de incidencias section, and for servicio Cándido Zamora a Resumen de vehículos - Nave Cerámicas table with vandalizado rows highlighted. Needs verification that PDF generates correctly with real turno data and displays all sections."

  - task: "Excel export report (/api/export/excel)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Similar structure to PDF: turno info header, events sheet with highlight fill for incidencia/llamada_centralita rows, second sheet 'Vehículos Cerámicas' with vandalizado highlighting. Needs verification."

  - task: "Turno lifecycle endpoints (start/active/finalizar/list)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /turnos starts new turno (blocks if guard already has active one, unless autofinalize applies), GET /turnos/active?guard=, POST /turnos/{id}/finalizar, GET /turnos?guard= for history. Used by new historial.tsx screen. Needs verification that listTurnos returns finalized turnos correctly for a guard and that starting a new turno always resets start_time to now."

## frontend:
  - task: "Historial de turnos screen (new)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/historial.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "New screen created. Accessible from index.tsx via 'Ver historial de turnos' button (testID view-history-button) requiring guard name entered first. Lists guard's finalized turnos (api.listTurnos filtered status==='finalizado') sorted desc, shows date/time range, duration, incidencias/llamadas/eventos counts, AUTO badge if auto-finalizado, and Excel/PDF export buttons per turno (testID historial-export-excel-{id}, historial-export-pdf-{id}) using Linking.openURL. Empty state shown if no finalized turnos. Route was already registered in app/_layout.tsx Stack but file was missing until now."

  - task: "Naves screen - Grid/List toggle + drag reorder"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/naves.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Uses react-native-sortables Sortable.Grid (columns=1) with customHandle + hapticsEnabled. Two render modes: NaveCardGrande (image card) and NaveCardLista (compact row), toggled via viewToggle buttons (testID view-mode-grande / view-mode-lista), persisted in AsyncStorage. onDragEnd calls api.reorderNaves. Needs verification that reordering persists after refresh and toggling grid/list works without losing order."

  - task: "Panel dashboard - live clock + elapsed shift time"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/panel.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "formatElapsed() computes elapsed time from turno.start_time (backend value, fresh per new turno) vs current time, updates every second (testID elapsed-time). Needs verification: starting a brand new turno shows elapsed time starting near 0h 00min, not carrying over from a previous turno."

  - task: "Toast notifications (global ToastProvider)"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/toast.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "ToastProvider wraps root Stack in app/_layout.tsx. useToast().show(msg, icon) used in panel.tsx (descanso/fin descanso). Needs verification toast appears and auto-dismisses without blocking taps (pointerEvents none)."

  - task: "Tabs - 'Tareas' tab removed"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/_layout.tsx"
    stuck_count: 0
    priority: "low"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Tabs now only Panel, Naves, Control. Needs verification no dead links to a Tareas tab remain and no crash."

## metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 4
  run_ui: false

## test_plan:
  current_focus:
    - "Timezone Europe/Madrid enforcement + auto-finalize background loop"
    - "PDF export report (/api/export/pdf)"
    - "Excel export report (/api/export/excel)"
    - "Turno lifecycle endpoints (start/active/finalizar/list)"
    - "Historial de turnos screen (new)"
    - "Naves screen - Grid/List toggle + drag reorder"
    - "Panel dashboard - live clock + elapsed shift time"
    - "Toast notifications (global ToastProvider)"
  stuck_tasks: []
  test_all: true
  test_priority: "high_first"

## agent_communication:
    - agent: "main"
      message: "Retomando el proyecto tras handoff. Se creó la pantalla faltante app/historial.tsx (ruta ya registrada en _layout.tsx pero sin archivo) y su punto de entrada en index.tsx ('Ver historial de turnos'). Se revisó el código y se confirmó que el reporte PDF/Excel YA incluye todos los requisitos pedidos (histórico resaltado, resumen vehículos Cerámicas, fecha/horas/nombre). El toggle grid/list de naves, el ToastProvider, la eliminación de la pestaña Tareas y el tiempo transcurrido en panel ya estaban implementados en el código pero NUNCA fueron verificados con testing_agent (pendiente desde iteración anterior). Se solicita testing completo backend+frontend. No hay login tradicional: se debe usar cualquier nombre de vigilante y el servicio 'Cándido Zamora'. Turno de día solo disponible sábado/domingo; turno nocturno disponible todos los días. IMPORTANTE: responder y reportar todo en español."