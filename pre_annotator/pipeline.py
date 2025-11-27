from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List

from .context_loader import ContextLoader, discover_images, default_table_id
from .llm_client import ask_for_grid_and_skeleton, client_from_config, load_config_from_env


def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def write_csv(path: Path, rows: List[List[str]]) -> None:
    import csv

    ensure_dir(path.parent)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        for r in rows:
            writer.writerow(r)


def write_json(path: Path, data: Dict) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Pre-annotator: LLM converts table images to CSV + skeleton with data_var_name.")
    parser.add_argument("--paper-dir", required=True, help="Path to project root (contains pdf/data/code). Example: D:\\Data\\...\\mnsc_2023_03369")
    parser.add_argument("--images-dir", required=True, help="Directory of table images (png/jpg).")
    parser.add_argument("--output-dir", required=True, help="Where to write csv/skeleton outputs.")
    parser.add_argument("--paper-id", required=False, help="Paper id (default from folder name).")
    parser.add_argument("--model", default=None, help="Override LLM model (default env PRE_ANNOTATOR_MODEL or gpt-4o).")
    args = parser.parse_args()

    paper_dir = Path(args.paper_dir)
    images_dir = Path(args.images_dir)
    out_dir = Path(args.output_dir)
    paper_id = args.paper_id or paper_dir.name

    ctx_loader = ContextLoader(paper_dir)
    ctx = ctx_loader.build(paper_id)

    cfg = load_config_from_env()
    if args.model:
        cfg.model = args.model
    client = client_from_config(cfg)

    images = discover_images(images_dir)
    if not images:
        print("No images found.")
        return

    for img in images:
        table_id = default_table_id(img)
        csv_path = out_dir / f"{paper_id}_{table_id}.csv"
        sk_path = out_dir / f"{paper_id}_{table_id}.skeleton.json"
        if csv_path.exists() and sk_path.exists():
            print(f"skip {img.name}, outputs exist")
            continue
        print(f"processing {img.name} -> {csv_path.name}")
        try:
            result = ask_for_grid_and_skeleton(
                client=client,
                model=cfg.model,
                image_path=img,
                paper_id=paper_id,
                table_id=table_id,
                pdf_text=ctx.pdf_text,
                candidate_columns=ctx.candidate_columns,
                candidate_code_vars=ctx.candidate_code_vars,
            )
            grid = result.get("grid") or result.get("rows") or []
            skeleton = result.get("skeleton") or {}
            # backfill metadata
            skeleton.setdefault("paper_id", paper_id)
            skeleton.setdefault("table_id", table_id)
            skeleton.setdefault("grid_file", csv_path.name)
            skeleton.setdefault("image_file", img.name)
            skeleton.setdefault("status", "in_progress")
            skeleton.setdefault("bracket_type_default", skeleton.get("bracket_type_default", "unknown"))
            write_csv(csv_path, grid)
            write_json(sk_path, skeleton)
        except Exception as e:
            print(f"failed on {img}: {e}")


if __name__ == "__main__":
    main()
