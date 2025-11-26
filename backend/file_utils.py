import csv
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .models import GridData, NoteCollection, SkeletonModel, TableInfo, XRow, YColumn


def parse_table_filename(filename: str) -> Optional[Tuple[str, str]]:
    """Extract paper_id and table_id from filenames like foo_table1.csv."""
    stem = Path(filename).stem
    if stem.endswith(".skeleton"):
        stem = stem[: -len(".skeleton")]
    match = re.match(r"(?P<paper_id>.+?)_(?P<table_id>(?:table|figure)\\d+)", stem, flags=re.IGNORECASE)
    if not match:
        return None
    return match.group("paper_id"), match.group("table_id")


def find_image_path(directory: Path, base_prefix: str) -> Optional[Path]:
    for ext in (".png", ".jpg", ".jpeg"):
        candidate = directory / f"{base_prefix}{ext}"
        if candidate.exists():
            return candidate
    return None


def find_skeleton_path(directory: Path, base_prefix: str) -> Optional[Path]:
    preferred = directory / f"{base_prefix}.skeleton.json"
    if preferred.exists():
        return preferred
    fallback = directory / f"{base_prefix}.json"
    if fallback.exists():
        return fallback
    return None


def safe_relative(path: Path, root_dir: Path) -> bool:
    try:
        path.resolve().relative_to(root_dir.resolve())
        return True
    except ValueError:
        return False


def scan_tables(root_dir: Path) -> List[TableInfo]:
    root = Path(root_dir)
    tables: Dict[Tuple[str, str], TableInfo] = {}
    for csv_path in root.rglob("*.csv"):
        parsed = parse_table_filename(csv_path.name)
        if not parsed:
            continue
        paper_id, table_id = parsed
        base_prefix = f"{paper_id}_{table_id}"
        image_path = find_image_path(csv_path.parent, base_prefix)
        skeleton_path = find_skeleton_path(csv_path.parent, base_prefix)
        status = "not_started"
        if skeleton_path:
            status = read_skeleton_status(skeleton_path) or "in_progress"
        tables[(paper_id, table_id)] = TableInfo(
            paper_id=paper_id,
            table_id=table_id,
            csv_path=csv_path,
            image_path=image_path,
            skeleton_path=skeleton_path,
            status=status,
        )
    return sorted(tables.values(), key=lambda t: (t.paper_id, t.table_id))


def read_skeleton_status(path: Path) -> Optional[str]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("status")
    except Exception:
        return None


def locate_csv(root_dir: Path, paper_id: str, table_id: str) -> Optional[Path]:
    root = Path(root_dir)
    for csv_path in root.rglob("*.csv"):
        parsed = parse_table_filename(csv_path.name)
        if parsed == (paper_id, table_id):
            return csv_path
    return None


def locate_image(csv_path: Path) -> Optional[Path]:
    parsed = parse_table_filename(csv_path.name)
    if not parsed:
        return None
    paper_id, table_id = parsed
    base_prefix = f"{paper_id}_{table_id}"
    return find_image_path(csv_path.parent, base_prefix)


def locate_skeleton(csv_path: Path) -> Optional[Path]:
    parsed = parse_table_filename(csv_path.name)
    if not parsed:
        return None
    paper_id, table_id = parsed
    base_prefix = f"{paper_id}_{table_id}"
    return find_skeleton_path(csv_path.parent, base_prefix)


def read_csv_grid(path: Path) -> GridData:
    with path.open(newline="", encoding="utf-8") as f:
        reader = list(csv.reader(f))
    if not reader:
        return GridData(header=[], rows=[])
    header, *rows = reader
    return GridData(header=header, rows=rows)


def write_csv_grid(path: Path, grid: GridData) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(grid.header)
        for row in grid.rows:
            writer.writerow(row)


def default_skeleton(paper_id: str, table_id: str, csv_path: Path, image_path: Optional[Path]) -> SkeletonModel:
    grid_file = csv_path.name
    image_file = image_path.name if image_path else None
    return SkeletonModel(
        paper_id=paper_id,
        table_id=table_id,
        grid_file=grid_file,
        image_file=image_file,
        status="in_progress",
        bracket_type_default="unknown",
        bracket_type_overrides={},
        y_columns=[],
        x_rows=[],
        fe_rows=[],
        obs_rows=[],
        notes=NoteCollection(),
        last_modified=datetime.utcnow(),
    )


def load_skeleton(csv_path: Path) -> SkeletonModel:
    parsed = parse_table_filename(csv_path.name)
    if not parsed:
        raise ValueError("Cannot infer paper_id/table_id from CSV name")
    paper_id, table_id = parsed
    image_path = locate_image(csv_path)
    skeleton_path = locate_skeleton(csv_path)
    if skeleton_path and skeleton_path.exists():
        data = json.loads(skeleton_path.read_text(encoding="utf-8"))
        return SkeletonModel(**data)
    return default_skeleton(paper_id, table_id, csv_path, image_path)


def save_skeleton(csv_path: Path, skeleton: SkeletonModel) -> Path:
    parsed = parse_table_filename(csv_path.name)
    if not parsed:
        raise ValueError("Cannot infer file prefix for skeleton save")
    paper_id, table_id = parsed
    base_prefix = f"{paper_id}_{table_id}"
    target = csv_path.parent / f"{base_prefix}.skeleton.json"
    skeleton.last_modified = datetime.utcnow()
    content = json.dumps(json.loads(skeleton.json()), ensure_ascii=False, indent=2)
    target.write_text(content, encoding="utf-8")
    return target

