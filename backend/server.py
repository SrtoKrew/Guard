from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import Response, StreamingResponse
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
import uuid
import requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone

from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ---------------- Emergent Object Storage ----------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "control-guardia"
storage_key: Optional[str] = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    global storage_key
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 503:
        storage_key = None
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple[bytes, str]:
    global storage_key
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    if resp.status_code == 503:
        storage_key = None
        key = init_storage()
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------- FastAPI ----------------
app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------------- Models ----------------
EVENT_TYPES = [
    "entrada", "salida", "ronda_inicio", "ronda_fin", "tarea", "incidencia", "descanso_inicio", "descanso_fin",
    "entrada_nave", "salida_nave", "llamada_centralita", "chequeo",
]

SERVICES = ["Cándido Zamora"]
NAVE_CHECK_ITEMS = ["Luces traseras", "Luces camiones"]
VEHICLE_TIPOS = ["Camión", "Grúa", "Grúa TO", "Contenedor", "Furgoneta", "Otro"]


class Nave(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: Optional[str] = None
    notes: Optional[str] = None
    service_name: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class NaveCreate(BaseModel):
    name: str
    address: Optional[str] = None
    notes: Optional[str] = None
    service_name: Optional[str] = None


class Event(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    guard: str
    type: str
    nave_id: Optional[str] = None
    nave_name: Optional[str] = None
    note: Optional[str] = None
    turno_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EventCreate(BaseModel):
    guard: str
    type: str
    nave_id: Optional[str] = None
    nave_name: Optional[str] = None
    note: Optional[str] = None
    turno_id: Optional[str] = None


class Incident(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    guard: str
    tipo: str
    nave_id: Optional[str] = None
    nave_name: Optional[str] = None
    description: str
    photo_path: Optional[str] = None
    turno_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class IncidentCreate(BaseModel):
    guard: str
    tipo: str
    nave_id: Optional[str] = None
    nave_name: Optional[str] = None
    description: str
    photo_path: Optional[str] = None
    turno_id: Optional[str] = None


class Turno(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    guard: str
    service_name: str
    start_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    end_time: Optional[datetime] = None
    status: str = "activo"  # activo | finalizado
    summary: Optional[dict] = None


class TurnoCreate(BaseModel):
    guard: str
    service_name: str


class Vehicle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nave_id: str
    tipo: str
    matricula: str
    zone: str = "linea"  # linea (cochera) | frente (aparcados)
    order: int = 0
    vandalizado: bool = False
    vandalizado_detalle: Optional[str] = None
    photo_path: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VehicleCreate(BaseModel):
    nave_id: str
    tipo: str
    matricula: str
    zone: str = "linea"
    vandalizado: bool = False
    vandalizado_detalle: Optional[str] = None
    photo_path: Optional[str] = None


class VehicleUpdate(BaseModel):
    tipo: Optional[str] = None
    matricula: Optional[str] = None
    zone: Optional[str] = None
    vandalizado: Optional[bool] = None
    vandalizado_detalle: Optional[str] = None
    photo_path: Optional[str] = None


class ReorderPayload(BaseModel):
    nave_id: str
    zone: str
    ids: List[str]


class NaveCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nave_id: str
    turno_id: str
    item_name: str
    checked: bool = False
    checked_by: Optional[str] = None
    checked_at: Optional[datetime] = None


class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    nave_id: Optional[str] = None
    nave_name: Optional[str] = None
    done: bool = False
    done_by: Optional[str] = None
    done_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    nave_id: Optional[str] = None
    nave_name: Optional[str] = None


# ---------------- Helpers ----------------
def clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


# ---------------- Routes ----------------
@api_router.get("/")
async def root():
    return {"message": "Control Guardia API"}


# --- Naves ---
@api_router.get("/naves", response_model=List[Nave])
async def list_naves():
    rows = await db.naves.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Nave(**r) for r in rows]


@api_router.post("/naves", response_model=Nave)
async def create_nave(payload: NaveCreate):
    obj = Nave(**payload.dict())
    await db.naves.insert_one(obj.dict())
    return obj


@api_router.delete("/naves/{nave_id}")
async def delete_nave(nave_id: str):
    res = await db.naves.delete_one({"id": nave_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Nave no encontrada")
    return {"ok": True}


# --- Servicios ---
@api_router.get("/services")
async def list_services():
    return [{"name": s} for s in SERVICES]


# --- Turnos (sesiones de trabajo) ---
@api_router.post("/turnos", response_model=Turno)
async def start_turno(payload: TurnoCreate):
    existing = await db.turnos.find_one({"guard": payload.guard, "status": "activo"}, {"_id": 0})
    if existing:
        return Turno(**existing)
    obj = Turno(guard=payload.guard, service_name=payload.service_name)
    await db.turnos.insert_one(obj.dict())
    return obj


@api_router.get("/turnos/active")
async def get_active_turno(guard: str = Query(...)):
    row = await db.turnos.find_one({"guard": guard, "status": "activo"}, {"_id": 0})
    return Turno(**row) if row else None


@api_router.get("/turnos", response_model=List[Turno])
async def list_turnos(guard: Optional[str] = None, limit: int = 100):
    q = {}
    if guard:
        q["guard"] = guard
    rows = await db.turnos.find(q, {"_id": 0}).sort("start_time", -1).to_list(limit)
    return [Turno(**r) for r in rows]


@api_router.get("/turnos/{turno_id}", response_model=Turno)
async def get_turno(turno_id: str):
    row = await db.turnos.find_one({"id": turno_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Turno no encontrado")
    return Turno(**row)


@api_router.post("/turnos/{turno_id}/finalizar", response_model=Turno)
async def finalizar_turno(turno_id: str):
    row = await db.turnos.find_one({"id": turno_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Turno no encontrado")
    if row.get("status") == "finalizado":
        return Turno(**row)
    end_time = datetime.now(timezone.utc)
    events = await db.events.find({"turno_id": turno_id}, {"_id": 0}).to_list(3000)
    incidencias = await db.incidents.count_documents({"turno_id": turno_id})
    start_time = row.get("start_time")
    duracion_segundos = None
    if isinstance(start_time, datetime):
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        duracion_segundos = (end_time - start_time).total_seconds()
    summary = {
        "total_eventos": len(events),
        "incidencias": incidencias,
        "llamadas_centralita": sum(1 for e in events if e.get("type") == "llamada_centralita"),
        "entradas_nave": sum(1 for e in events if e.get("type") == "entrada_nave"),
        "salidas_nave": sum(1 for e in events if e.get("type") == "salida_nave"),
        "descansos": sum(1 for e in events if e.get("type") == "descanso_inicio"),
        "chequeos": sum(1 for e in events if e.get("type") == "chequeo"),
        "duracion_segundos": duracion_segundos,
    }
    update = {"end_time": end_time, "status": "finalizado", "summary": summary}
    await db.turnos.update_one({"id": turno_id}, {"$set": update})
    row.update(update)
    return Turno(**row)


# --- Vehículos ---
@api_router.get("/naves/{nave_id}/vehiculos", response_model=List[Vehicle])
async def list_vehicles(nave_id: str):
    rows = await db.vehicles.find({"nave_id": nave_id}, {"_id": 0}).sort("order", 1).to_list(500)
    return [Vehicle(**r) for r in rows]


@api_router.post("/vehiculos", response_model=Vehicle)
async def create_vehicle(payload: VehicleCreate):
    if payload.tipo not in VEHICLE_TIPOS:
        raise HTTPException(400, "Tipo de vehículo inválido")
    count = await db.vehicles.count_documents({"nave_id": payload.nave_id, "zone": payload.zone})
    obj = Vehicle(**payload.dict(), order=count)
    await db.vehicles.insert_one(obj.dict())
    return obj


@api_router.patch("/vehiculos/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(vehicle_id: str, payload: VehicleUpdate):
    row = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Vehículo no encontrado")
    update = {k: v for k, v in payload.dict(exclude_unset=True).items()}
    update["updated_at"] = datetime.now(timezone.utc)
    await db.vehicles.update_one({"id": vehicle_id}, {"$set": update})
    row.update(update)
    return Vehicle(**row)


@api_router.delete("/vehiculos/{vehicle_id}")
async def delete_vehicle(vehicle_id: str):
    res = await db.vehicles.delete_one({"id": vehicle_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Vehículo no encontrado")
    return {"ok": True}


@api_router.post("/vehiculos/reorder")
async def reorder_vehicles(payload: ReorderPayload):
    for idx, vid in enumerate(payload.ids):
        await db.vehicles.update_one(
            {"id": vid, "nave_id": payload.nave_id},
            {"$set": {"zone": payload.zone, "order": idx}},
        )
    return {"ok": True}


# --- Cajetines de verificación de nave (se reinician en cada turno nuevo) ---
@api_router.get("/naves/{nave_id}/checks")
async def get_nave_checks(nave_id: str, turno_id: str = Query(...)):
    result = []
    for item in NAVE_CHECK_ITEMS:
        row = await db.nave_checks.find_one({"nave_id": nave_id, "turno_id": turno_id, "item_name": item}, {"_id": 0})
        if not row:
            row = {"nave_id": nave_id, "turno_id": turno_id, "item_name": item, "checked": False, "checked_by": None, "checked_at": None}
        result.append(row)
    return result


@api_router.post("/naves/{nave_id}/checks/{item_name}/toggle")
async def toggle_nave_check(nave_id: str, item_name: str, guard: str = Query(...), turno_id: str = Query(...)):
    if item_name not in NAVE_CHECK_ITEMS:
        raise HTTPException(400, "Ítem no válido")
    row = await db.nave_checks.find_one({"nave_id": nave_id, "turno_id": turno_id, "item_name": item_name}, {"_id": 0})
    new_checked = not (row.get("checked") if row else False)
    now = datetime.now(timezone.utc)
    update = {
        "nave_id": nave_id,
        "turno_id": turno_id,
        "item_name": item_name,
        "checked": new_checked,
        "checked_by": guard if new_checked else None,
        "checked_at": now if new_checked else None,
    }
    await db.nave_checks.update_one(
        {"nave_id": nave_id, "turno_id": turno_id, "item_name": item_name},
        {"$set": update, "$setOnInsert": {"id": str(uuid.uuid4())}},
        upsert=True,
    )
    nave = await db.naves.find_one({"id": nave_id}, {"_id": 0})
    ev = Event(
        guard=guard, type="chequeo", nave_id=nave_id, nave_name=nave.get("name") if nave else None,
        turno_id=turno_id,
        note=f"{item_name}: {'Verificado' if new_checked else 'Desmarcado'}",
    )
    await db.events.insert_one(ev.dict())
    result = await db.nave_checks.find_one({"nave_id": nave_id, "turno_id": turno_id, "item_name": item_name}, {"_id": 0})
    result.pop("_id", None)
    return result


# --- Events / Control Horario ---
@api_router.get("/events", response_model=List[Event])
async def list_events(guard: Optional[str] = None, turno_id: Optional[str] = None, limit: int = 500):
    q = {}
    if guard:
        q["guard"] = guard
    if turno_id:
        q["turno_id"] = turno_id
    rows = await db.events.find(q, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return [Event(**r) for r in rows]


@api_router.post("/events", response_model=Event)
async def create_event(payload: EventCreate):
    if payload.type not in EVENT_TYPES:
        raise HTTPException(400, "Tipo de evento inválido")
    obj = Event(**payload.dict())
    await db.events.insert_one(obj.dict())
    return obj


@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str):
    res = await db.events.delete_one({"id": event_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Evento no encontrado")
    return {"ok": True}


# --- Incidents ---
@api_router.get("/incidents", response_model=List[Incident])
async def list_incidents(guard: Optional[str] = None, turno_id: Optional[str] = None):
    q = {}
    if guard:
        q["guard"] = guard
    if turno_id:
        q["turno_id"] = turno_id
    rows = await db.incidents.find(q, {"_id": 0}).sort("timestamp", -1).to_list(500)
    return [Incident(**r) for r in rows]


@api_router.post("/incidents", response_model=Incident)
async def create_incident(payload: IncidentCreate):
    obj = Incident(**payload.dict())
    await db.incidents.insert_one(obj.dict())
    # also register a matching event
    ev = Event(
        guard=obj.guard,
        type="incidencia",
        nave_id=obj.nave_id,
        nave_name=obj.nave_name,
        turno_id=obj.turno_id,
        note=f"{obj.tipo}: {obj.description[:60]}",
    )
    await db.events.insert_one(ev.dict())
    return obj


# --- Tasks ---
@api_router.get("/tasks", response_model=List[Task])
async def list_tasks():
    rows = await db.tasks.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Task(**r) for r in rows]


@api_router.post("/tasks", response_model=Task)
async def create_task(payload: TaskCreate):
    obj = Task(**payload.dict())
    await db.tasks.insert_one(obj.dict())
    return obj


@api_router.post("/tasks/{task_id}/toggle", response_model=Task)
async def toggle_task(task_id: str, guard: str = Query(...)):
    row = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Tarea no encontrada")
    new_done = not row.get("done", False)
    update = {
        "done": new_done,
        "done_by": guard if new_done else None,
        "done_at": datetime.now(timezone.utc) if new_done else None,
    }
    await db.tasks.update_one({"id": task_id}, {"$set": update})
    row.update(update)
    if new_done:
        ev = Event(
            guard=guard, type="tarea", nave_id=row.get("nave_id"), nave_name=row.get("nave_name"),
            note=f"Completada: {row.get('title')}"
        )
        await db.events.insert_one(ev.dict())
    return Task(**row)


@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    res = await db.tasks.delete_one({"id": task_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Tarea no encontrada")
    return {"ok": True}


# --- File upload (photos) ---
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), guard: str = Form("anon")):
    ext = (file.filename or "photo.jpg").split(".")[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp", "heic"):
        ext = "jpg"
    safe_guard = "".join(c for c in guard if c.isalnum() or c in "-_") or "anon"
    obj_path = f"{APP_NAME}/uploads/{safe_guard}/{uuid.uuid4().hex}.{ext}"
    data = await file.read()
    content_type = file.content_type or f"image/{ext}"
    await run_in_threadpool(put_object, obj_path, data, content_type)
    return {"path": obj_path, "size": len(data)}


@api_router.get("/files/{full_path:path}")
async def get_file(full_path: str):
    try:
        data, ct = await run_in_threadpool(get_object, full_path)
    except Exception:
        raise HTTPException(404, "Archivo no encontrado")
    return Response(content=data, media_type=ct)


# --- Export ---
def _format_timestamp(ts) -> str:
    if isinstance(ts, str):
        try:
            ts = datetime.fromisoformat(ts)
        except Exception:
            return ts
    if isinstance(ts, datetime):
        return ts.strftime("%d/%m/%Y %H:%M:%S")
    return str(ts)


EVENT_LABELS = {
    "entrada": "Fichar Entrada",
    "salida": "Fichar Salida",
    "ronda_inicio": "Inicio Ronda",
    "ronda_fin": "Fin Ronda",
    "tarea": "Tarea",
    "incidencia": "Incidencia",
    "descanso_inicio": "Inicio Descanso",
    "descanso_fin": "Fin Descanso",
    "entrada_nave": "Entrada a Nave",
    "salida_nave": "Salida de Nave",
    "llamada_centralita": "Llamada Centralita",
    "chequeo": "Chequeo",
}


@api_router.get("/export/excel")
async def export_excel(guard: Optional[str] = None, turno_id: Optional[str] = None):
    q = {}
    if guard:
        q["guard"] = guard
    if turno_id:
        q["turno_id"] = turno_id
    rows = await db.events.find(q, {"_id": 0}).sort("timestamp", 1).to_list(5000)

    wb = Workbook()
    ws = wb.active
    ws.title = "Control Horario"
    ws.append(["Fecha/Hora", "Vigilante", "Evento", "Nave", "Notas"])
    for r in rows:
        ws.append([
            _format_timestamp(r.get("timestamp")),
            r.get("guard", ""),
            EVENT_LABELS.get(r.get("type", ""), r.get("type", "")),
            r.get("nave_name") or "",
            r.get("note") or "",
        ])
    for col_idx, width in enumerate([22, 20, 20, 24, 40], start=1):
        ws.column_dimensions[chr(64 + col_idx)].width = width

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"control_horario_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.get("/export/pdf")
async def export_pdf(guard: Optional[str] = None, turno_id: Optional[str] = None):
    q = {}
    if guard:
        q["guard"] = guard
    if turno_id:
        q["turno_id"] = turno_id
    rows = await db.events.find(q, {"_id": 0}).sort("timestamp", 1).to_list(5000)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title="Control Diario Asergrup")
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph("<b>Control Diario Asergrup - Seguridad Integral</b>", styles["Title"]))
    subtitle = f"Vigilante: {guard}" if guard else "Todos los vigilantes"
    story.append(Paragraph(subtitle, styles["Normal"]))
    story.append(Paragraph(f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles["Normal"]))
    story.append(Spacer(1, 12))

    data = [["Fecha/Hora", "Vigilante", "Evento", "Nave", "Notas"]]
    for r in rows:
        data.append([
            _format_timestamp(r.get("timestamp")),
            r.get("guard", ""),
            EVENT_LABELS.get(r.get("type", ""), r.get("type", "")),
            r.get("nave_name") or "-",
            (r.get("note") or "")[:60],
        ])
    if len(data) == 1:
        data.append(["Sin registros", "", "", "", ""])

    tbl = Table(data, repeatRows=1, colWidths=[110, 80, 90, 100, 130])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E53935")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#F2F4F7")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#5A606C")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F2F4F7"), colors.white]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(tbl)
    doc.build(story)
    buf.seek(0)
    filename = f"control_horario_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------- App wiring ----------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def seed_defaults():
    existing = await db.naves.find_one({"name": "Cerámicas"})
    if existing:
        return
    nave = Nave(name="Cerámicas", notes="Nave principal del servicio", service_name="Cándido Zamora")
    await db.naves.insert_one(nave.dict())

    linea_data = [
        ("Camión", "8536 GVP", False, None),
        ("Camión", "5064 KHZ", False, None),
        ("Camión", "3847 MMX", False, None),
        ("Camión", "7126 FZB", False, None),
        ("Camión", "7650 FMC", False, None),
        ("Camión", "4613 HMS", False, None),
        ("Camión", "4849 HTV", False, None),
        ("Camión", "8458 JHB", False, None),
        ("Grúa", "6207 DGG", False, None),
        ("Grúa", "2507 DZM", False, None),
        ("Grúa", "3192 FXJ", False, None),
        ("Grúa", "2103 BSS", False, None),
        ("Grúa", "8327 DTW", False, None),
        ("Grúa", "9004 DJT", True, "Ambas cerraduras"),
        ("Contenedor", "9425 FLS", False, None),
        ("Contenedor", "6754 KTM", False, None),
        ("Contenedor", "4742 MHH", False, None),
    ]
    frente_data = [
        ("Grúa", "9859 CNS", False, None),
        ("Grúa TO", "5990 AD", True, "Cerradura Copiloto"),
        ("Grúa", "5573 BHX", True, "Cerradura Copiloto"),
        ("Grúa", "3882 CCP", True, "Cerradura Conductor"),
    ]
    for idx, (tipo, matricula, vand, detalle) in enumerate(linea_data):
        v = Vehicle(nave_id=nave.id, tipo=tipo, matricula=matricula, zone="linea", order=idx,
                    vandalizado=vand, vandalizado_detalle=detalle)
        await db.vehicles.insert_one(v.dict())
    for idx, (tipo, matricula, vand, detalle) in enumerate(frente_data):
        v = Vehicle(nave_id=nave.id, tipo=tipo, matricula=matricula, zone="frente", order=idx,
                    vandalizado=vand, vandalizado_detalle=detalle)
        await db.vehicles.insert_one(v.dict())
    logger.info("Datos por defecto (Cerámicas + vehículos) sembrados correctamente")


@app.on_event("startup")
async def on_startup():
    try:
        await run_in_threadpool(init_storage)
        logger.info("Object storage initialized")
    except Exception as e:
        logger.warning(f"Object storage init failed: {e}")
    try:
        await seed_defaults()
    except Exception as e:
        logger.warning(f"Seed defaults failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
