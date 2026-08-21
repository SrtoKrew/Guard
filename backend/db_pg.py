"""
Adaptador que imita el subconjunto de la API de Motor/MongoDB usado en server.py,
pero habla con Postgres (Supabase) por debajo vía asyncpg.

Soporta exactamente los patrones usados en server.py:
  - find(query, projection).sort(field, direction).to_list(n)
  - find(query) usado como cursor async (`async for row in cursor`)
  - find_one(query, projection=None)
  - insert_one(doc)
  - update_one(query, update, upsert=False)   update: {"$set": {...}, "$setOnInsert": {...}}
  - update_many(query, update)
  - delete_one(query)
  - count_documents(query)

No es un ORM genérico: es intencionalmente mínimo y solo cubre lo que la app usa.
"""
import json
import asyncpg
from typing import Any, Optional


def _where(query: Optional[dict], params: list) -> str:
    """Convierte un dict tipo Mongo simple en una cláusula WHERE.
    Soporta igualdad directa y {"$exists": True/False}."""
    if not query:
        return ""
    clauses = []
    for field, value in query.items():
        col = f'"{field}"' if field == "order" else field
        if isinstance(value, dict) and "$exists" in value:
            clauses.append(f"{col} IS {'NOT NULL' if value['$exists'] else 'NULL'}")
        else:
            params.append(value)
            clauses.append(f"{col} = ${len(params)}")
    return " WHERE " + " AND ".join(clauses) if clauses else ""


class Cursor:
    def __init__(self, collection: "Collection", query: Optional[dict]):
        self._collection = collection
        self._query = query
        self._sort_field = None
        self._sort_dir = 1

    def sort(self, field: str, direction: int = 1):
        self._sort_field = field
        self._sort_dir = direction
        return self

    def _build_sql(self, limit: Optional[int] = None):
        params: list = []
        where = _where(self._query, params)
        sql = f"SELECT * FROM {self._collection.table}{where}"
        if self._sort_field:
            col = f'"{self._sort_field}"' if self._sort_field == "order" else self._sort_field
            direction = "ASC" if self._sort_dir >= 0 else "DESC"
            sql += f" ORDER BY {col} {direction}"
        if limit:
            sql += f" LIMIT {int(limit)}"
        return sql, params

    async def to_list(self, length: int = 1000):
        sql, params = self._build_sql(limit=length)
        pool = self._collection.db.pool
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *params)
        return [self._collection._row_to_dict(r) for r in rows]

    def __aiter__(self):
        return self._aiter_impl()

    async def _aiter_impl(self):
        for row in await self.to_list(length=100000):
            yield row


class Collection:
    def __init__(self, db: "Database", table: str, json_fields: Optional[set] = None):
        self.db = db
        self.table = table
        self.json_fields = json_fields or set()

    def _row_to_dict(self, row: asyncpg.Record) -> dict:
        d = dict(row)
        for f in self.json_fields:
            if isinstance(d.get(f), str):
                d[f] = json.loads(d[f])
        return d

    def _prep_value(self, field: str, value: Any):
        if field in self.json_fields and value is not None and not isinstance(value, str):
            return json.dumps(value)
        return value

    def find(self, query: Optional[dict] = None, projection: Optional[dict] = None) -> Cursor:
        return Cursor(self, query)

    async def find_one(self, query: Optional[dict] = None, projection: Optional[dict] = None) -> Optional[dict]:
        params: list = []
        where = _where(query, params)
        sql = f"SELECT * FROM {self.table}{where} LIMIT 1"
        async with self.db.pool.acquire() as conn:
            row = await conn.fetchrow(sql, *params)
        return self._row_to_dict(row) if row else None

    async def insert_one(self, doc: dict):
        fields = list(doc.keys())
        cols = ", ".join(f'"{f}"' if f == "order" else f for f in fields)
        placeholders = ", ".join(f"${i+1}" for i in range(len(fields)))
        params = [self._prep_value(f, doc[f]) for f in fields]
        sql = f"INSERT INTO {self.table} ({cols}) VALUES ({placeholders})"
        async with self.db.pool.acquire() as conn:
            await conn.execute(sql, *params)
        return doc

    async def update_one(self, query: dict, update: dict, upsert: bool = False):
        set_fields = dict(update.get("$set", {}))
        params: list = []
        where = _where(query, params)
        if set_fields:
            set_parts = []
            for f, v in set_fields.items():
                params.append(self._prep_value(f, v))
                col = f'"{f}"' if f == "order" else f
                set_parts.append(f"{col} = ${len(params)}")
            sql = f"UPDATE {self.table} SET {', '.join(set_parts)}{where}"
            async with self.db.pool.acquire() as conn:
                result = await conn.execute(sql, *params)
            updated = int(result.split(" ")[-1]) if result else 0
        else:
            updated = 0

        if updated == 0 and upsert:
            insert_doc = {}
            if query:
                insert_doc.update(query)
            insert_doc.update(update.get("$setOnInsert", {}))
            insert_doc.update(set_fields)
            await self.insert_one(insert_doc)

    async def update_many(self, query: dict, update: dict):
        set_fields = update.get("$set", {})
        if not set_fields:
            return
        params: list = []
        where = _where(query, params)
        set_parts = []
        for f, v in set_fields.items():
            params.append(self._prep_value(f, v))
            col = f'"{f}"' if f == "order" else f
            set_parts.append(f"{col} = ${len(params)}")
        sql = f"UPDATE {self.table} SET {', '.join(set_parts)}{where}"
        async with self.db.pool.acquire() as conn:
            await conn.execute(sql, *params)

    async def delete_one(self, query: dict):
        params: list = []
        where = _where(query, params)
        sql = f"DELETE FROM {self.table}{where}"
        async with self.db.pool.acquire() as conn:
            result = await conn.execute(sql, *params)
        deleted = int(result.split(" ")[-1]) if result else 0
        return type("DeleteResult", (), {"deleted_count": deleted})()

    async def count_documents(self, query: Optional[dict] = None) -> int:
        params: list = []
        where = _where(query, params)
        sql = f"SELECT COUNT(*) FROM {self.table}{where}"
        async with self.db.pool.acquire() as conn:
            return await conn.fetchval(sql, *params)


class Database:
    """Contenedor de colecciones, análogo a la `db` de Motor. El pool se asigna
    de forma asíncrona en el evento de startup de FastAPI."""

    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.naves = Collection(self, "naves", json_fields={"check_items", "custom_actions"})
        self.events = Collection(self, "events")
        self.incidents = Collection(self, "incidents")
        self.turnos = Collection(self, "turnos", json_fields={"summary"})
        self.vehicles = Collection(self, "vehicles")
        self.nave_checks = Collection(self, "nave_checks")
        self.tasks = Collection(self, "tasks")

    async def connect(self, dsn: str):
        self.pool = await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=10)

    async def close(self):
        if self.pool:
            await self.pool.close()
