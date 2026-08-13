"""Backend tests for Control Guardia."""
import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://guard-scheduler-10.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

GUARD = f"TEST_guard_{uuid.uuid4().hex[:6]}"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# Root
def test_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("message")


# Naves CRUD
class TestNaves:
    nave_id = None

    def test_create_nave(self, s):
        r = s.post(f"{API}/naves", json={"name": "TEST_Nave_A", "address": "Calle 1"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_Nave_A"
        assert d["id"]
        TestNaves.nave_id = d["id"]

    def test_list_naves(self, s):
        r = s.get(f"{API}/naves")
        assert r.status_code == 200
        assert any(n["id"] == TestNaves.nave_id for n in r.json())

    def test_delete_nave(self, s):
        r = s.delete(f"{API}/naves/{TestNaves.nave_id}")
        assert r.status_code == 200
        # verify gone
        r2 = s.get(f"{API}/naves")
        assert not any(n["id"] == TestNaves.nave_id for n in r2.json())


# Events
class TestEvents:
    valid_types = ["entrada", "salida", "ronda_inicio", "ronda_fin", "incidencia",
                   "descanso_inicio", "descanso_fin", "tarea"]
    created_ids = []

    def test_create_valid_events(self, s):
        for t in self.valid_types:
            r = s.post(f"{API}/events", json={"guard": GUARD, "type": t, "note": f"n_{t}"})
            assert r.status_code == 200, f"{t}: {r.text}"
            TestEvents.created_ids.append(r.json()["id"])

    def test_reject_invalid_type(self, s):
        r = s.post(f"{API}/events", json={"guard": GUARD, "type": "bogus"})
        assert r.status_code == 400

    def test_filter_by_guard(self, s):
        r = s.get(f"{API}/events", params={"guard": GUARD})
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= len(self.valid_types)
        assert all(e["guard"] == GUARD for e in rows)


# Tasks
class TestTasks:
    task_id = None

    def test_create_task(self, s):
        r = s.post(f"{API}/tasks", json={"title": "TEST_Tarea", "description": "d"})
        assert r.status_code == 200
        d = r.json()
        assert d["done"] is False
        TestTasks.task_id = d["id"]

    def test_list_tasks(self, s):
        r = s.get(f"{API}/tasks")
        assert r.status_code == 200
        assert any(t["id"] == TestTasks.task_id for t in r.json())

    def test_toggle_task_done(self, s):
        r = s.post(f"{API}/tasks/{TestTasks.task_id}/toggle", params={"guard": GUARD})
        assert r.status_code == 200
        d = r.json()
        assert d["done"] is True
        assert d["done_by"] == GUARD
        # An event 'tarea' should have been created
        ev = s.get(f"{API}/events", params={"guard": GUARD}).json()
        assert any(e["type"] == "tarea" for e in ev)

    def test_toggle_task_undo(self, s):
        r = s.post(f"{API}/tasks/{TestTasks.task_id}/toggle", params={"guard": GUARD})
        assert r.status_code == 200
        assert r.json()["done"] is False

    def test_delete_task(self, s):
        r = s.delete(f"{API}/tasks/{TestTasks.task_id}")
        assert r.status_code == 200


# Incidents
class TestIncidents:
    def test_create_incident_creates_event(self, s):
        # count events before
        before = len(s.get(f"{API}/events", params={"guard": GUARD}).json())
        r = s.post(f"{API}/incidents", json={
            "guard": GUARD, "tipo": "intrusion", "description": "TEST desc"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["tipo"] == "intrusion"
        # incident-triggered event
        after = s.get(f"{API}/events", params={"guard": GUARD}).json()
        assert len(after) == before + 1
        assert after[0]["type"] == "incidencia"


# Upload
class TestUpload:
    path = None

    def test_upload_photo(self, s):
        # tiny valid PNG (1x1)
        png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
               b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\x00"
               b"\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        data = {"guard": GUARD}
        r = s.post(f"{API}/upload", files=files, data=data)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["path"]
        TestUpload.path = d["path"]

    def test_get_uploaded_file(self, s):
        assert TestUpload.path
        r = s.get(f"{API}/files/{TestUpload.path}")
        assert r.status_code == 200
        assert len(r.content) > 0


# Export
class TestExport:
    def test_export_excel(self, s):
        r = s.get(f"{API}/export/excel")
        assert r.status_code == 200
        # xlsx = zip file -> PK header
        assert r.content[:2] == b"PK"
        assert "spreadsheetml" in r.headers.get("content-type", "")

    def test_export_pdf(self, s):
        r = s.get(f"{API}/export/pdf")
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"
        assert "pdf" in r.headers.get("content-type", "")
