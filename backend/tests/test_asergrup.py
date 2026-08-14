"""Backend tests for Control Diario Asergrup - turnos, naves, vehiculos, nave-checks."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('EXPO_BACKEND_URL', os.environ.get('EXPO_PUBLIC_BACKEND_URL')).rstrip('/')
API = f"{BASE_URL}/api"

GUARD = f"TEST_vigilante_{uuid.uuid4().hex[:6]}"
SERVICE = "Cándido Zamora"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# --- Services ---
def test_list_services(s):
    r = s.get(f"{API}/services")
    assert r.status_code == 200
    data = r.json()
    assert any(x["name"] == SERVICE for x in data)


# --- Naves seed ---
def test_ceramicas_nave_seeded(s):
    r = s.get(f"{API}/naves")
    assert r.status_code == 200
    naves = r.json()
    ceramicas = [n for n in naves if n["name"] == "Cerámicas"]
    assert len(ceramicas) >= 1, "Nave 'Cerámicas' debe estar sembrada por defecto"
    return ceramicas[0]["id"]


# --- Turnos: auto-start, active, finalizar, resumen ---
class TestTurnoFlow:
    turno_id = None
    nave_id = None

    def test_start_turno_auto(self, s):
        r = s.post(f"{API}/turnos", json={"guard": GUARD, "service_name": SERVICE})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "activo"
        assert d["guard"] == GUARD
        TestTurnoFlow.turno_id = d["id"]

    def test_start_turno_idempotent_returns_same_active(self, s):
        # starting again for same guard should return the SAME active turno (not create a duplicate)
        r = s.post(f"{API}/turnos", json={"guard": GUARD, "service_name": SERVICE})
        assert r.status_code == 200
        assert r.json()["id"] == TestTurnoFlow.turno_id

    def test_get_active_turno(self, s):
        r = s.get(f"{API}/turnos/active", params={"guard": GUARD})
        assert r.status_code == 200
        assert r.json()["id"] == TestTurnoFlow.turno_id

    def test_nave_checks_default_unchecked(self, s):
        naves = s.get(f"{API}/naves").json()
        nave = next(n for n in naves if n["name"] == "Cerámicas")
        TestTurnoFlow.nave_id = nave["id"]
        r = s.get(f"{API}/naves/{nave['id']}/checks", params={"turno_id": TestTurnoFlow.turno_id})
        assert r.status_code == 200
        checks = r.json()
        assert len(checks) == 2
        assert all(c["checked"] is False for c in checks)

    def test_toggle_check_and_verify(self, s):
        r = s.post(
            f"{API}/naves/{TestTurnoFlow.nave_id}/checks/Luces traseras/toggle",
            params={"guard": GUARD, "turno_id": TestTurnoFlow.turno_id},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["checked"] is True
        assert d["checked_by"] == GUARD
        # a chequeo event should have been logged
        events = s.get(f"{API}/events", params={"guard": GUARD, "turno_id": TestTurnoFlow.turno_id}).json()
        assert any(e["type"] == "chequeo" for e in events)

    def test_llamada_centralita_event(self, s):
        r = s.post(f"{API}/events", json={
            "guard": GUARD, "type": "llamada_centralita", "note": "TEST llamada",
            "turno_id": TestTurnoFlow.turno_id,
        })
        assert r.status_code == 200
        assert r.json()["type"] == "llamada_centralita"

    def test_descanso_events(self, s):
        r1 = s.post(f"{API}/events", json={"guard": GUARD, "type": "descanso_inicio", "turno_id": TestTurnoFlow.turno_id})
        r2 = s.post(f"{API}/events", json={"guard": GUARD, "type": "descanso_fin", "turno_id": TestTurnoFlow.turno_id})
        assert r1.status_code == 200 and r2.status_code == 200

    def test_entrada_salida_nave_events(self, s):
        r1 = s.post(f"{API}/events", json={
            "guard": GUARD, "type": "entrada_nave", "nave_id": TestTurnoFlow.nave_id,
            "nave_name": "Cerámicas", "turno_id": TestTurnoFlow.turno_id,
        })
        r2 = s.post(f"{API}/events", json={
            "guard": GUARD, "type": "salida_nave", "nave_id": TestTurnoFlow.nave_id,
            "nave_name": "Cerámicas", "turno_id": TestTurnoFlow.turno_id,
        })
        assert r1.status_code == 200 and r2.status_code == 200

    def test_finalizar_turno_summary(self, s):
        r = s.post(f"{API}/turnos/{TestTurnoFlow.turno_id}/finalizar")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "finalizado"
        assert d["end_time"] is not None
        summ = d["summary"]
        assert summ["llamadas_centralita"] == 1
        assert summ["entradas_nave"] == 1
        assert summ["salidas_nave"] == 1
        assert summ["chequeos"] >= 1
        assert summ["descansos"] == 1
        assert summ["duracion_segundos"] >= 0

    def test_get_turno_after_finalizar_persists(self, s):
        r = s.get(f"{API}/turnos/{TestTurnoFlow.turno_id}")
        assert r.status_code == 200
        assert r.json()["status"] == "finalizado"

    def test_active_turno_none_after_finalizar(self, s):
        r = s.get(f"{API}/turnos/active", params={"guard": GUARD})
        assert r.status_code == 200
        assert r.json() is None


# --- Nave checks reset per new turno (CRITICAL business rule) ---
class TestNaveChecksResetPerTurno:
    def test_checks_reset_for_new_turno_same_guard(self, s):
        naves = s.get(f"{API}/naves").json()
        nave = next(n for n in naves if n["name"] == "Cerámicas")
        # Start a fresh turno for a NEW guard entirely to avoid interference
        guard2 = f"TEST_vigilante2_{uuid.uuid4().hex[:6]}"
        t1 = s.post(f"{API}/turnos", json={"guard": guard2, "service_name": SERVICE}).json()
        # toggle check on
        s.post(f"{API}/naves/{nave['id']}/checks/Luces camiones/toggle",
               params={"guard": guard2, "turno_id": t1["id"]})
        checks_t1 = s.get(f"{API}/naves/{nave['id']}/checks", params={"turno_id": t1["id"]}).json()
        assert any(c["checked"] for c in checks_t1)
        # finalize and start new turno
        s.post(f"{API}/turnos/{t1['id']}/finalizar")
        t2 = s.post(f"{API}/turnos", json={"guard": guard2, "service_name": SERVICE}).json()
        assert t2["id"] != t1["id"]
        checks_t2 = s.get(f"{API}/naves/{nave['id']}/checks", params={"turno_id": t2["id"]}).json()
        assert all(c["checked"] is False for c in checks_t2), "Checks deben resetearse en turno nuevo"
        # cleanup: finalize t2
        s.post(f"{API}/turnos/{t2['id']}/finalizar")


# --- Vehiculos: seeded data, CRUD, reorder, persistence across turnos ---
class TestVehiculos:
    nave_id = None
    new_vehicle_id = None

    def test_seeded_vehicles_counts(self, s):
        naves = s.get(f"{API}/naves").json()
        nave = next(n for n in naves if n["name"] == "Cerámicas")
        TestVehiculos.nave_id = nave["id"]
        r = s.get(f"{API}/naves/{nave['id']}/vehiculos")
        assert r.status_code == 200
        vehicles = r.json()
        linea = [v for v in vehicles if v["zone"] == "linea"]
        frente = [v for v in vehicles if v["zone"] == "frente"]
        assert len(linea) >= 17, f"Expected >=17 linea vehicles, got {len(linea)}"
        assert len(frente) >= 4, f"Expected >=4 frente vehicles, got {len(frente)}"
        vandalizados_linea = [v for v in linea if v["vandalizado"]]
        assert len(vandalizados_linea) >= 1

    def test_create_vehicle(self, s):
        r = s.post(f"{API}/vehiculos", json={
            "nave_id": TestVehiculos.nave_id, "tipo": "Camión", "matricula": "TEST_9999 ABC",
            "zone": "linea", "vandalizado": False,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        TestVehiculos.new_vehicle_id = d["id"]
        assert d["matricula"] == "TEST_9999 ABC"

    def test_reject_invalid_tipo(self, s):
        r = s.post(f"{API}/vehiculos", json={
            "nave_id": TestVehiculos.nave_id, "tipo": "TipoInvalido", "matricula": "X", "zone": "linea",
        })
        assert r.status_code == 400

    def test_update_vehicle_to_vandalizado(self, s):
        r = s.patch(f"{API}/vehiculos/{TestVehiculos.new_vehicle_id}", json={
            "vandalizado": True, "vandalizado_detalle": "TEST detalle cerradura",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["vandalizado"] is True
        assert d["vandalizado_detalle"] == "TEST detalle cerradura"

    def test_vandalizado_persists_after_turno_lifecycle(self, s):
        # simulate a turno start/finalize cycle; vandalizado state must be untouched
        guard3 = f"TEST_vigilante3_{uuid.uuid4().hex[:6]}"
        t = s.post(f"{API}/turnos", json={"guard": guard3, "service_name": SERVICE}).json()
        s.post(f"{API}/turnos/{t['id']}/finalizar")
        r = s.get(f"{API}/naves/{TestVehiculos.nave_id}/vehiculos")
        v = next(x for x in r.json() if x["id"] == TestVehiculos.new_vehicle_id)
        assert v["vandalizado"] is True
        assert v["vandalizado_detalle"] == "TEST detalle cerradura"

    def test_reorder_vehicles_persists(self, s):
        vehicles = s.get(f"{API}/naves/{TestVehiculos.nave_id}/vehiculos").json()
        linea_ids = [v["id"] for v in vehicles if v["zone"] == "linea"]
        reversed_ids = list(reversed(linea_ids))
        r = s.post(f"{API}/vehiculos/reorder", json={
            "nave_id": TestVehiculos.nave_id, "zone": "linea", "ids": reversed_ids,
        })
        assert r.status_code == 200
        # reload and verify order persisted
        vehicles2 = s.get(f"{API}/naves/{TestVehiculos.nave_id}/vehiculos").json()
        linea_ids2 = [v["id"] for v in vehicles2 if v["zone"] == "linea"]
        assert linea_ids2 == reversed_ids, "El orden debe persistir tras recargar"

    def test_delete_vehicle_cleanup(self, s):
        r = s.delete(f"{API}/vehiculos/{TestVehiculos.new_vehicle_id}")
        assert r.status_code == 200
        vehicles = s.get(f"{API}/naves/{TestVehiculos.nave_id}/vehiculos").json()
        assert not any(v["id"] == TestVehiculos.new_vehicle_id for v in vehicles)


# --- Export with turno filter ---
def test_export_excel_with_turno_filter(s=requests.Session()):
    r = s.get(f"{API}/export/excel", params={"guard": GUARD})
    assert r.status_code == 200
    assert r.content[:2] == b"PK"


def test_export_pdf_with_turno_filter(s=requests.Session()):
    r = s.get(f"{API}/export/pdf", params={"guard": GUARD})
    assert r.status_code == 200
    assert r.content[:4] == b"%PDF"
