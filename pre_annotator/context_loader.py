from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Set
import re

SUPPORTED_IMAGE_EXTS = {".png", ".jpg", ".jpeg"}
SUPPORTED_CODE_EXTS = {".py", ".r", ".jl", ".m", ".sas", ".do", ".ado", ".qmd", ".ipynb"}
DATA_EXTS = {".csv", ".tsv", ".dta", ".sav", ".sas7bdat", ".rds", ".rdata", ".feather", ".parquet", ".xlsx", ".xls", ".pkl"}


@dataclass
class ProjectContext:
    paper_id: str
    pdf_path: Optional[Path]
    data_files: List[Path]
    code_files: List[Path]
    candidate_columns: Set[str]
    candidate_code_vars: Set[str]
    pdf_text: str


class ContextLoader:
    def __init__(self, project_root: Path) -> None:
        self.root = Path(project_root)

    def find_pdf(self) -> Optional[Path]:
        pdfs = list(self.root.glob("nomask_*.pdf")) or list(self.root.glob("*.pdf"))
        return pdfs[0] if pdfs else None

    def find_data_files(self) -> List[Path]:
        files: List[Path] = []
        for ext in DATA_EXTS:
            files += list(self.root.rglob(f"*{ext}"))
        return files

    def find_code_files(self) -> List[Path]:
        files: List[Path] = []
        for ext in SUPPORTED_CODE_EXTS:
            files += [p for p in self.root.rglob(f"*{ext}") if "log" not in p.name.lower()]
        return files

    def load_pdf_text(self, pdf: Optional[Path], limit_chars: int = 12000) -> str:
        if not pdf or not pdf.exists():
            return ""
        try:
            import pdfplumber
        except Exception:
            return ""
        try:
            texts: List[str] = []
            with pdfplumber.open(pdf) as doc:
                for page in doc.pages:
                    texts.append(page.extract_text() or "")
                    if sum(len(t) for t in texts) > limit_chars:
                        break
            out = "\n".join(texts)
            return out[:limit_chars]
        except Exception:
            return ""

    def load_columns_from_data(self, paths: List[Path], limit: int = 50) -> Set[str]:
        cols: Set[str] = set()
        for p in paths:
            if len(cols) > 3000:
                break
            ext = p.suffix.lower()
            try:
                if ext in {".csv", ".tsv"}:
                    import pandas as pd
                    df = pd.read_csv(p, nrows=0, sep="," if ext == ".csv" else "\t")
                    cols.update(df.columns.tolist())
                elif ext in {".xlsx", ".xls"}:
                    import pandas as pd
                    xls = pd.ExcelFile(p)
                    for sheet in xls.sheet_names[:limit]:
                        df = xls.parse(sheet, nrows=0)
                        cols.update(df.columns.tolist())
                elif ext in {".dta", ".sav", ".sas7bdat"}:
                    import pyreadstat
                    meta = pyreadstat.read_filemeta(str(p))
                    cols.update(meta.column_names)
                elif ext in {".rds", ".rdata"}:
                    import pyreadr
                    res = pyreadr.read_r(str(p))
                    for _, df in res.items():
                        try:
                            cols.update(df.columns.tolist())
                        except Exception:
                            pass
                elif ext in {".feather", ".parquet"}:
                    import pandas as pd
                    df = pd.read_feather(p, columns=None) if ext == ".feather" else pd.read_parquet(p, columns=None)
                    cols.update(df.columns.tolist())
                elif ext == ".pkl":
                    import pickle
                    with p.open("rb") as f:
                        obj = pickle.load(f)
                    if hasattr(obj, "columns"):
                        try:
                            cols.update(obj.columns.tolist())
                        except Exception:
                            pass
                    elif isinstance(obj, dict):
                        for v in obj.values():
                            if hasattr(v, "columns"):
                                try:
                                    cols.update(v.columns.tolist())
                                except Exception:
                                    pass
                if len(cols) > 3000:
                    cols = set(list(cols)[:3000])
            except Exception:
                continue
        return cols

    def parse_code_vars(self, paths: List[Path], limit_chars: int = 8000) -> Set[str]:
        vars: Set[str] = set()
        pat = re.compile(r"[A-Za-z_][A-Za-z0-9_\\.]*")
        for p in paths:
            try:
                txt = p.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            txt = txt[:limit_chars]
            for m in pat.finditer(txt):
                name = m.group(0)
                if len(name) <= 60 and not name.isdigit():
                    vars.add(name)
            if len(vars) > 3000:
                break
        return vars

    def build(self, paper_id: str) -> ProjectContext:
        pdf = self.find_pdf()
        data_files = self.find_data_files()
        code_files = self.find_code_files()
        cols = self.load_columns_from_data(data_files)
        code_vars = self.parse_code_vars(code_files)
        pdf_text = self.load_pdf_text(pdf)
        return ProjectContext(
            paper_id=paper_id,
            pdf_path=pdf,
            data_files=data_files,
            code_files=code_files,
            candidate_columns=cols,
            candidate_code_vars=code_vars,
            pdf_text=pdf_text,
        )


def discover_images(images_dir: Path) -> List[Path]:
    imgs: List[Path] = []
    for ext in SUPPORTED_IMAGE_EXTS:
        imgs += list(Path(images_dir).glob(f"*{ext}"))
    return imgs


def default_table_id(path: Path) -> str:
    stem = path.stem
    m = re.search(r"table\d+", stem, re.IGNORECASE)
    if m:
        return m.group(0).lower()
    return stem


if __name__ == "__main__":
    root = Path(".")
    ctx = ContextLoader(root).build("demo")
    print({
        "pdf": str(ctx.pdf_path) if ctx.pdf_path else None,
        "data_files": len(ctx.data_files),
        "code_files": len(ctx.code_files),
        "columns": len(ctx.candidate_columns),
        "code_vars": len(ctx.candidate_code_vars),
    })
