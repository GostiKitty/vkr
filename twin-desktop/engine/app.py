from typing import Any, List
from pathlib import Path
import json
import uuid
import datetime

from fastapi import Body, FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import ifcopenshell

app = FastAPI(title="Twin Engine", version="0.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT = Path(__file__).resolve().parents[1]
PROJECTS_DIR = ROOT / "projects"
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)


class ImportResponse(BaseModel):
    project_id: str
    spaces_count: int


class RunMetric(BaseModel):
    key: str
    label: str | None = None
    unit: str | None = None
    value: float


class RunResult(BaseModel):
    id: str
    project_id: str
    status: str
    started_at: datetime.datetime
    finished_at: datetime.datetime
    metrics: List[RunMetric]
    payload: dict[str, Any] | None = None


class RunRequest(BaseModel):
    project_id: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ping")
def ping() -> dict[str, Any]:
    return {"ok": True, "time": datetime.datetime.utcnow().isoformat() + "Z"}


def ifc_to_twin(ifc_path: Path) -> dict[str, Any]:
    model = ifcopenshell.open(str(ifc_path))
    spaces = model.by_type("IfcSpace")

    out_spaces = []
    for sp in spaces:
        guid = getattr(sp, "GlobalId", None)
        name = getattr(sp, "Name", None) or "Unnamed space"
        longname = getattr(sp, "LongName", None)

        out_spaces.append(
            {
                "id": guid or str(uuid.uuid4()),
                "name": name,
                "long_name": longname,
                "level": None,
                "area_m2": None,
                "volume_m3": None,
            }
        )

    twin = {
        "meta": {
            "schema_version": "0.1",
            "source": "ifc",
            "created_at": datetime.datetime.utcnow().isoformat() + "Z",
            "ifc_filename": ifc_path.name,
        },
        "building": {"name": None},
        "spaces": out_spaces,
        "envelope": [],
        "systems": {"heating": None, "ventilation": None, "itp": None},
        "assumptions": {},
    }
    return twin


def project_dir(project_id: str) -> Path:
    return PROJECTS_DIR / project_id


def load_twin(project_id: str) -> dict[str, Any]:
    twin_path = project_dir(project_id) / "twin.json"
    if not twin_path.exists():
        raise HTTPException(status_code=404, detail="twin.json не найден")
    return json.loads(twin_path.read_text(encoding="utf-8"))


def save_twin_data(project_id: str, twin: dict[str, Any]) -> None:
    proj_dir = project_dir(project_id)
    proj_dir.mkdir(parents=True, exist_ok=True)
    twin_path = proj_dir / "twin.json"
    twin_path.write_text(json.dumps(twin, ensure_ascii=False, indent=2), encoding="utf-8")


@app.post("/import/ifc", response_model=ImportResponse)
@app.post("/import", response_model=ImportResponse)
@app.post("/api/import", response_model=ImportResponse)
async def import_ifc(file: UploadFile = File(...)) -> ImportResponse:
    project_id = str(uuid.uuid4())[:8]
    proj_dir = project_dir(project_id)
    proj_dir.mkdir(parents=True, exist_ok=True)

    ifc_path = proj_dir / file.filename
    with open(ifc_path, "wb") as f:
        f.write(await file.read())

    twin = ifc_to_twin(ifc_path)
    save_twin_data(project_id, twin)

    return ImportResponse(project_id=project_id, spaces_count=len(twin["spaces"]))


@app.get("/twin/{project_id}")
def get_twin(project_id: str) -> dict[str, Any]:
    return load_twin(project_id)


@app.post("/twin/{project_id}")
def save_twin(project_id: str, twin: dict[str, Any] = Body(...)) -> dict[str, str]:
    save_twin_data(project_id, twin)
    return {"status": "ok"}


def build_run_metrics(spaces: List[dict[str, Any]]) -> List[RunMetric]:
    count = max(len(spaces), 1)
    energy = float(count) * 5.0
    peak_heat = float(count) * 1.4
    cooling = float(count) * 0.9
    return [
        RunMetric(key="energy_demand_kwh", label="Энергопотребление", unit="kWh", value=energy),
        RunMetric(key="peak_heating_kw", label="Пиковая отопительная нагрузка", unit="kW", value=peak_heat),
        RunMetric(key="cooling_load_kw", label="Пиковая холодопроизводительность", unit="kW", value=cooling),
    ]


@app.post("/run", response_model=RunResult)
def run_simulation(request: RunRequest) -> RunResult:
    twin = load_twin(request.project_id)
    spaces = twin.get("spaces", [])
    started = datetime.datetime.utcnow()
    finished = started + datetime.timedelta(seconds=1)
    metrics = build_run_metrics(spaces)
    return RunResult(
        id=str(uuid.uuid4()),
        project_id=request.project_id,
        status="completed",
        started_at=started,
        finished_at=finished,
        metrics=metrics,
        payload={"spaces": len(spaces)},
    )
