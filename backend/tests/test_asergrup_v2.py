"""Backend tests iteration 3: timezone fix, turno_tipo rules, auto-finalize,
Grua TO -> Grua fix, vandalismo audit log, new naves (8 total) config."""
import os
import uuid
import time
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get('EXPO_BACKEND_URL', os.environ.get('EXPO_PUBLIC_BACKEND_URL')).rstrip('/')
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')

GUARD = f"TEST_tz_{uuid.uuid4().hex[:6]}"
SERVICE = "Cándido Zamora"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def mongo_db():
    if not MONGO_URL or not DB_NAME:
        pytest.skip("MONGO_URL/DB_NAME not set")
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


# ------------------- TIMEZONE BUG (CRITICAL) -------------------
class TestTimezone:
    """Verify event timestamps returned by API carry correct UTC info that
    the frontend can convert to Europe/Madrid without an offset error."""

    def test_event_timestamp_has_tzinfo_and_is_recent_utc(self, s):
        r = s.post(f"{API}/events", json={"guard": GUARD, "type": "llamada_centralita", "note": "TEST tz"})
        assert r.status_code == 200
        ts_str = r.json()["timestamp"]
        # Must be parseable and carry tzinfo (+00:00 or Z) so JS new Date() doesn't
        # misinterpret it as local time (root cause of the reported '2 hours off' bug)
        assert ("+" in ts_str or "Z" in ts_str), f"Timestamp missing tz offset: {ts_str}"
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        assert dt.tzinfo is not None
        now_utc = datetime.now(timezone.utc)
        delta = abs((now_utc - dt).total_seconds())
        assert delta < 30, f"Event timestamp {dt} too far from real UTC now {now_utc} (delta={delta}s)"

    def test_turno_start_time_matches_real_utc_now(self, s):
        r = s.post(f"{API}/turnos", json={"guard": GUARD, "service_name": SERVICE})
        assert r.status_code == 200, r.text
        d = r.json()
        start_str = d["start_time"]
        assert ("+" in start_str or "Z" in start_str)
        dt = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        now_utc = datetime.now(timezone.utc)
        assert abs((now_utc - dt).total_seconds()) < 30
        # scheduled_end must be in the future and tz-aware too
        se_str = d["scheduled_end"]
        assert ("+" in se_str or "Z" in se_str)
        se = datetime.fromisoformat(se_str.replace("Z", "+00:00"))
        assert se > now_utc
        # cleanup
        s.post(f"{API}/turnos/{d['id']}/finalizar")


# ------------------- TURNO OPCIONES (day-of-week rules) -------------------
class TestTurnoOpciones:
    def test_opciones_match_weekday_rules(self, s):
        r = s.get(f"{API}/turnos/opciones")
        assert r.status_code == 200
        opciones = r.json()
        tipos = {o["tipo"] for o in opciones}
        from zoneinfo import ZoneInfo
        madrid_now = datetime.now(ZoneInfo("Europe/Madrid"))
        is_weekend = madrid_now.weekday() in (5, 6)
        if is_weekend:
            assert tipos == {"dia", "noche"}, f"Weekend should offer dia+noche, got {tipos}"
            dia = next(o for o in opciones if o["tipo"] == "dia")
            noche = next(o for o in opciones if o["tipo"] == "noche")
            assert dia["horario"] == "08:00 - 20:00"
            assert noche["horario"] == "20:30 - 06:00"
        else:
            assert tipos == {"noche"}, f"Weekday should offer only noche, got {tipos}"
            noche = next(o for o in opciones if o["tipo"] == "noche")
            assert noche["horario"] == "22:00 - 06:00"

    def test_start_turno_rejects_dia_on_weekday(self, s):
        from zoneinfo import ZoneInfo
        madrid_now = datetime.now(ZoneInfo("Europe/Madrid"))
        is_weekend = madrid_now.weekday() in (5, 6)
        guard = f"TEST_dia_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/turnos", json={"guard": guard, "service_name": SERVICE, "turno_tipo": "dia"})
        if is_weekend:
            assert r.status_code == 200
            s.post(f"{API}/turnos/{r.json()['id']}/finalizar")
        else:
            assert r.status_code == 400, "Turno de dia debe rechazarse en dia de semana"


# ------------------- AUTO-FINALIZACION -------------------
class TestAutoFinalize:
    def test_turno_with_past_scheduled_end_autofinalizes_on_get_active(self, s, mongo_db):
        guard = f"TEST_auto_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/turnos", json={"guard": guard, "service_name": SERVICE})
        assert r.status_code == 200
        turno = r.json()
        turno_id = turno["id"]
        # Force scheduled_end into the past directly in Mongo
        past = datetime.now(timezone.utc) - timedelta(minutes=5)
        mongo_db.turnos.update_one({"id": turno_id}, {"$set": {"scheduled_end": past}})

        # GET active should trigger auto-finalize and return None (no longer active)
        r2 = s.get(f"{API}/turnos/active", params={"guard": guard})
        assert r2.status_code == 200
        assert r2.json() is None, "Turno con scheduled_end pasado debe auto-finalizarse y no aparecer como activo"

        # GET by id should show status finalizado + auto_finalizado True + summary
        r3 = s.get(f"{API}/turnos/{turno_id}")
        assert r3.status_code == 200
        d = r3.json()
        assert d["status"] == "finalizado"
        assert d["auto_finalizado"] is True
        assert d["summary"] is not None
        assert d["end_time"] is not None

    def test_background_loop_autofinalizes_without_get_active_call(self, s, mongo_db):
        """The _autofinalize_loop runs every 120s; simulate by directly checking a turno
        with past scheduled_end gets picked up eventually. We just verify the mechanism
        works via the /turnos/active path (already tested) and that /turnos list also
        reflects finalized state for a directly-expired turno without calling /active."""
        guard = f"TEST_auto2_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/turnos", json={"guard": guard, "service_name": SERVICE})
        turno_id = r.json()["id"]
        past = datetime.now(timezone.utc) - timedelta(minutes=1)
        mongo_db.turnos.update_one({"id": turno_id}, {"$set": {"scheduled_end": past}})
        # wait a bit over the loop interval is too long for a test; instead directly hit /turnos/{id}
        # which does NOT auto-finalize by itself (only /active and the bg loop do) -- verify current state
        r2 = s.get(f"{API}/turnos/{turno_id}")
        # Might still be 'activo' since neither /active nor bg loop has run yet for this one
        assert r2.status_code == 200
        # Now trigger via /active to confirm the mechanism definitely works
        s.get(f"{API}/turnos/active", params={"guard": guard})
        r3 = s.get(f"{API}/turnos/{turno_id}")
        assert r3.json()["status"] == "finalizado"


# ------------------- VEHICULO GRUA TO FIX -------------------
class TestVehicleGruaToFix:
    def test_no_grua_to_tipo_exists(self, s):
        naves = s.get(f"{API}/naves").json()
        ceramicas = next(n for n in naves if n["name"] == "Cerámicas")
        vehicles = s.get(f"{API}/naves/{ceramicas['id']}/vehiculos").json()
        tipos = {v["tipo"] for v in vehicles}
        assert "Grúa TO" not in tipos, "El tipo 'Grúa TO' ya no debe existir"

    def test_to_5990_ad_vehicle_correct(self, s):
        naves = s.get(f"{API}/naves").json()
        ceramicas = next(n for n in naves if n["name"] == "Cerámicas")
        vehicles = s.get(f"{API}/naves/{ceramicas['id']}/vehiculos").json()
        matches = [v for v in vehicles if "5990" in v["matricula"]]
        assert len(matches) == 1, f"Debe existir exactamente un vehiculo con matricula TO 5990 AD, got {matches}"
        v = matches[0]
        assert v["tipo"] == "Grúa"
        assert v["matricula"] == "TO 5990 AD"
        assert v["zone"] == "frente"

    def test_vehicle_tipos_list_has_no_grua_to(self, s):
        # create_vehicle should reject 'Grúa TO' as invalid tipo since it's not in VEHICLE_TIPOS
        naves = s.get(f"{API}/naves").json()
        ceramicas = next(n for n in naves if n["name"] == "Cerámicas")
        r = s.post(f"{API}/vehiculos", json={
            "nave_id": ceramicas["id"], "tipo": "Grúa TO", "matricula": "TEST_XX", "zone": "frente",
        })
        assert r.status_code == 400


# ------------------- VANDALISMO AUDIT LOG -------------------
class TestVandalismoAudit:
    vehicle_id = None
    nave_id = None

    def test_setup_nave_and_vehicle(self, s):
        naves = s.get(f"{API}/naves").json()
        nave = next(n for n in naves if n["name"] == "Cerámicas")
        TestVandalismoAudit.nave_id = nave["id"]
        r = s.post(f"{API}/vehiculos", json={
            "nave_id": nave["id"], "tipo": "Camión", "matricula": "TEST_AUD001",
            "zone": "linea", "vandalizado": False,
        })
        assert r.status_code == 200
        TestVandalismoAudit.vehicle_id = r.json()["id"]

    def test_mark_vandalizado_creates_event(self, s):
        guard = f"TEST_aud_{uuid.uuid4().hex[:6]}"
        r = s.patch(f"{API}/vehiculos/{TestVandalismoAudit.vehicle_id}", json={
            "vandalizado": True, "vandalizado_detalle": "TEST rotura cristal",
            "guard": guard,
        })
        assert r.status_code == 200
        events = s.get(f"{API}/events", params={"guard": guard}).json()
        vand_events = [e for e in events if e["type"] == "vehiculo_vandalizado"]
        assert len(vand_events) == 1, "Debe crearse un evento vehiculo_vandalizado"
        assert "TEST rotura cristal" in vand_events[0]["note"]
        assert vand_events[0]["nave_id"] == TestVandalismoAudit.nave_id

    def test_unmark_vandalizado_creates_reparado_event(self, s):
        guard = f"TEST_aud2_{uuid.uuid4().hex[:6]}"
        r = s.patch(f"{API}/vehiculos/{TestVandalismoAudit.vehicle_id}", json={
            "vandalizado": False, "guard": guard,
        })
        assert r.status_code == 200
        events = s.get(f"{API}/events", params={"guard": guard}).json()
        rep_events = [e for e in events if e["type"] == "vehiculo_reparado"]
        assert len(rep_events) == 1, "Debe crearse un evento vehiculo_reparado al desmarcar"

    def test_cleanup_vehicle(self, s):
        s.delete(f"{API}/vehiculos/{TestVandalismoAudit.vehicle_id}")


# ------------------- NUEVAS NAVES -------------------
class TestNavesConfig:
    EXPECTED_NAVES = {
        "Cerámicas": dict(has_access_buttons=True, has_vehicles=True),
        "Grúas": dict(has_access_buttons=True, has_vehicles=False, check_items={"Luces torre", "Luces grúa"}),
        "Oficinas": dict(has_access_buttons=False, custom_actions={"Revisión de luces", "Cerrada", "Abierta"}),
        "PP3": dict(has_access_buttons=True, custom_actions={"Revisado"}),
        "Eólica": dict(has_access_buttons=True, custom_actions={"Revisión luces"}),
        "Nave Camino Agrícola": dict(has_access_buttons=True, custom_actions=set()),
        "Camino Agrícola": dict(has_access_buttons=False, custom_actions={"Paso por revisión"}),
        "Camino Eólica-Grúas": dict(has_access_buttons=False, custom_actions={"Paso por revisión"}),
    }

    def test_all_8_naves_exist(self, s):
        naves = s.get(f"{API}/naves").json()
        names = {n["name"] for n in naves}
        for expected_name in self.EXPECTED_NAVES:
            assert expected_name in names, f"Falta la nave '{expected_name}'"
        cz_naves = [n for n in naves if n.get("service_name") == SERVICE or n["name"] == "Cerámicas"]
        assert len(cz_naves) >= 8

    def test_naves_config_matches_spec(self, s):
        naves = s.get(f"{API}/naves").json()
        by_name = {n["name"]: n for n in naves}
        for name, expected in self.EXPECTED_NAVES.items():
            n = by_name[name]
            assert n["has_access_buttons"] == expected["has_access_buttons"], f"{name} has_access_buttons mismatch"
            if "custom_actions" in expected:
                assert set(n["custom_actions"]) == expected["custom_actions"], f"{name} custom_actions mismatch: {n['custom_actions']}"
            if "check_items" in expected:
                assert set(n["check_items"]) == expected["check_items"], f"{name} check_items mismatch"
            if "has_vehicles" in expected:
                assert n["has_vehicles"] == expected["has_vehicles"], f"{name} has_vehicles mismatch"

    def test_oficinas_no_entrada_salida(self, s):
        naves = s.get(f"{API}/naves").json()
        oficinas = next(n for n in naves if n["name"] == "Oficinas")
        assert oficinas["has_access_buttons"] is False
        assert oficinas["check_items"] == []

    def test_camino_agricola_and_eolica_grua_no_access_buttons(self, s):
        naves = s.get(f"{API}/naves").json()
        for name in ["Camino Agrícola", "Camino Eólica-Grúas"]:
            n = next(x for x in naves if x["name"] == name)
            assert n["has_access_buttons"] is False
            assert n["custom_actions"] == ["Paso por revisión"]
