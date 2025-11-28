from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class NoteCollection(BaseModel):
    rows: Dict[str, str] = Field(default_factory=dict)
    cols: Dict[str, str] = Field(default_factory=dict)
    cells: Dict[str, str] = Field(default_factory=dict)


class YColumn(BaseModel):
    col: int
    depvar_label: Optional[str] = None
    depvar_data_name: Optional[str] = None
    note: Optional[str] = None


class XRow(BaseModel):
    row: int
    display_label: Optional[str] = None
    data_var_name: Optional[str] = None
    role: str = "key"
    note: Optional[str] = None


class FERow(BaseModel):
    row: int
    label: str
    data_var_name: Optional[str] = None
    note: Optional[str] = None


class ObsRow(BaseModel):
    row: int
    label: str
    note: Optional[str] = None


class SkeletonModel(BaseModel):
    paper_id: str
    table_id: str
    grid_file: str
    image_file: Optional[str] = None
    status: str = "in_progress"
    bracket_type_default: str = "unknown"
    bracket_type_overrides: Dict[str, str] = Field(default_factory=dict)
    y_columns: List[YColumn] = Field(default_factory=list)
    x_rows: List[XRow] = Field(default_factory=list)
    fe_rows: List[FERow] = Field(default_factory=list)
    obs_rows: List[ObsRow] = Field(default_factory=list)
    notes: NoteCollection = Field(default_factory=NoteCollection)
    last_modified: datetime = Field(default_factory=datetime.utcnow)


class TableInfo(BaseModel):
    paper_id: str
    table_id: str
    csv_path: Path
    image_path: Optional[Path] = None
    skeleton_path: Optional[Path] = None
    status: str = "not_started"

    class Config:
        arbitrary_types_allowed = True


class GridData(BaseModel):
    header: List[str]
    rows: List[List[str]]


class TableDetail(BaseModel):
    info: TableInfo
    grid: GridData
    skeleton: SkeletonModel
