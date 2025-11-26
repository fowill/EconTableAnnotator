from pathlib import Path
from typing import Optional

from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pydantic_settings import BaseSettings
from openai import OpenAI

from backend.file_utils import (
    default_skeleton,
    load_skeleton,
    locate_csv,
    locate_image,
    locate_skeleton,
    read_csv_grid,
    save_skeleton,
    scan_tables,
    write_csv_grid,
)
from backend.models import GridData, SkeletonModel, TableDetail, TableInfo


class AppConfig(BaseSettings):
    root_dir: Path = Path.cwd()
    openai_api_key: str | None = None
    openai_base_url: str | None = None

    class Config:
        env_prefix = "APP_"
        arbitrary_types_allowed = True


class ConfigUpdate(BaseModel):
    root_dir: Path
    openai_api_key: str | None = None
    openai_base_url: str | None = None


settings = AppConfig()

app = FastAPI(title="Econ Table Annotator", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def resolve_root_dir(root_dir: Optional[Path]) -> Path:
    candidate = Path(root_dir) if root_dir else settings.root_dir
    if not candidate.exists():
        raise HTTPException(status_code=400, detail="root_dir does not exist")
    return candidate


@app.get("/api/config")
def get_config():
    return {
        "root_dir": str(settings.root_dir.resolve()),
        "openai_base_url": settings.openai_base_url,
        "openai_api_key_set": bool(settings.openai_api_key),
    }


@app.post("/api/config")
def update_config(update: ConfigUpdate):
    if not update.root_dir.exists():
        raise HTTPException(status_code=400, detail="Provided root_dir does not exist")
    settings.root_dir = update.root_dir.resolve()
    if update.openai_api_key is not None:
        settings.openai_api_key = update.openai_api_key
    if update.openai_base_url is not None:
        settings.openai_base_url = update.openai_base_url
    return {
        "root_dir": str(settings.root_dir),
        "openai_base_url": settings.openai_base_url,
        "openai_api_key_set": bool(settings.openai_api_key),
    }


@app.get("/api/projects")
def list_projects(root_dir: Optional[Path] = Query(None)):
    base = resolve_root_dir(root_dir)
    tables = scan_tables(base)
    return [
        {
            "paper_id": t.paper_id,
            "table_id": t.table_id,
            "csv_path": str(t.csv_path),
            "image_path": str(t.image_path) if t.image_path else None,
            "skeleton_path": str(t.skeleton_path) if t.skeleton_path else None,
            "status": t.status,
        }
        for t in tables
    ]


def find_table_paths(base: Path, paper_id: str, table_id: str):
    csv_path = locate_csv(base, paper_id, table_id)
    if not csv_path:
        raise HTTPException(status_code=404, detail="CSV not found for table")
    image_path = locate_image(csv_path)
    skeleton_path = locate_skeleton(csv_path)
    return csv_path, image_path, skeleton_path


@app.get("/api/table/{paper_id}/{table_id}")
def get_table_detail(paper_id: str, table_id: str, root_dir: Optional[Path] = Query(None)) -> TableDetail:
    base = resolve_root_dir(root_dir)
    csv_path, image_path, skeleton_path = find_table_paths(base, paper_id, table_id)
    grid = read_csv_grid(csv_path)
    try:
        skeleton = load_skeleton(csv_path)
    except Exception:
        skeleton = default_skeleton(paper_id, table_id, csv_path, image_path)
    info = TableInfo(
        paper_id=paper_id,
        table_id=table_id,
        csv_path=csv_path,
        image_path=image_path,
        skeleton_path=skeleton_path,
        status=skeleton.status if skeleton else "in_progress",
    )
    return TableDetail(info=info, grid=grid, skeleton=skeleton)


class GridUpdate(BaseModel):
    header: list[str]
    rows: list[list[str]]


@app.post("/api/table/{paper_id}/{table_id}/save_csv")
def save_csv(
    paper_id: str,
    table_id: str,
    payload: GridUpdate = Body(...),
    root_dir: Optional[Path] = Query(None),
):
    base = resolve_root_dir(root_dir)
    csv_path, _, _ = find_table_paths(base, paper_id, table_id)
    write_csv_grid(csv_path, GridData(header=payload.header, rows=payload.rows))
    return {"ok": True, "csv_path": str(csv_path)}


@app.post("/api/table/{paper_id}/{table_id}/save_skeleton")
def save_skeleton_api(
    paper_id: str,
    table_id: str,
    skeleton: SkeletonModel,
    root_dir: Optional[Path] = Query(None),
):
    base = resolve_root_dir(root_dir)
    csv_path, _, _ = find_table_paths(base, paper_id, table_id)
    saved_path = save_skeleton(csv_path, skeleton)
    return {"ok": True, "skeleton_path": str(saved_path)}


@app.get("/api/table/{paper_id}/{table_id}/image")
def fetch_image(paper_id: str, table_id: str, root_dir: Optional[Path] = Query(None)):
    base = resolve_root_dir(root_dir)
    csv_path, image_path, _ = find_table_paths(base, paper_id, table_id)
    if not image_path or not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found for table")
    return FileResponse(image_path)


class SuggestRequest(BaseModel):
    instruction: str | None = None


@app.post("/api/table/{paper_id}/{table_id}/suggest_grid")
def suggest_grid(
    paper_id: str,
    table_id: str,
    payload: SuggestRequest,
    request: Request,
    root_dir: Optional[Path] = Query(None),
):
    if not settings.openai_api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")

    base = resolve_root_dir(root_dir)
    csv_path, image_path, _ = find_table_paths(base, paper_id, table_id)
    grid = read_csv_grid(csv_path)

    image_url = None
    if image_path:
        # Build absolute URL for the served image
        image_url = str(request.url_for("fetch_image", paper_id=paper_id, table_id=table_id))

    prompt = (
        "You are given a regression table image. "
        "Return a CSV grid (header included) as JSON with the same dimensions as provided. "
        "Keep the first column as row labels. Fill missing cells from the image where possible. "
        "Respond ONLY with JSON object: {\"rows\": [...]} where rows is a list of row arrays matching the header length. "
    )
    if payload.instruction:
        prompt += f"User instruction: {payload.instruction}"

    client = OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
    messages: list[dict] = [
        {"role": "system", "content": prompt},
        {
          "role": "user",
          "content": [
            {"type": "text", "text": f"Header: {grid.header}. Current rows: {grid.rows[:4]} ... total {len(grid.rows)} rows."}
          ],
        },
    ]
    if image_url:
        messages[1]["content"].append(
            {"type": "image_url", "image_url": {"url": image_url}}
        )

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.2,
        )
        content = resp.choices[0].message.content if resp.choices else None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM request failed: {e}")

    import json

    try:
        data = json.loads(content or "{}")
        rows = data.get("rows")
        if not isinstance(rows, list):
            raise ValueError("rows missing")
        # Ensure row width equals header
        normalized = []
        for r in rows:
            if not isinstance(r, list):
                continue
            if len(r) < len(grid.header):
                r = r + [""] * (len(grid.header) - len(r))
            elif len(r) > len(grid.header):
                r = r[: len(grid.header)]
            normalized.append([str(x) for x in r])
        if len(normalized) != len(grid.rows):
            raise ValueError("row count mismatch")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse LLM output: {e}")

    return {"ok": True, "rows": normalized}
