from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List

from .context_loader import ContextLoader, discover_images, default_table_id
from .llm_client import ask_for_grid_and_skeleton, client_from_config, load_config_from_env, load_config_from_file


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


def load_examples(example_dir: Path, limit_pairs: int = 3) -> str:
    """
    Build a short text snippet showing expected csv/skeleton structure from existing samples.
    """
    pairs = []
    if not example_dir.exists():
        return ""
    csv_files = sorted(example_dir.glob("*.csv"))
    for csv_file in csv_files:
        sk_file = csv_file.with_suffix(".skeleton.json")
        if not sk_file.exists():
            continue
        try:
            csv_preview = "\n".join(csv_file.read_text(encoding="utf-8").splitlines()[:6])
            sk = json.loads(sk_file.read_text(encoding="utf-8"))
            y_cols = sk.get("y_columns", [])
            x_rows = sk.get("x_rows", [])
            obs = sk.get("obs_rows", [])
            fe = sk.get("fe_rows", [])
            pairs.append(
                f"Example {csv_file.name}:\nCSV preview:\n{csv_preview}\n"
                f"Skeleton summary: bracket_type_default={sk.get('bracket_type_default')}, "
                f"y_columns={[{'col':c.get('col'),'depvar_label':c.get('depvar_label'),'depvar_data_name':c.get('depvar_data_name')} for c in y_cols]}, "
                f"x_rows={[{'row':r.get('row'),'display_label':r.get('display_label'),'data_var_name':r.get('data_var_name'),'role':r.get('role')} for r in x_rows]}, "
                f"fe_rows={fe}, obs_rows={obs}\n"
            )
        except Exception:
            continue
        if len(pairs) >= limit_pairs:
            break
    return "\n".join(pairs)


def main() -> None:
    parser = argparse.ArgumentParser(description="Pre-annotator: LLM converts table images to CSV + skeleton with data_var_name.")
    parser.add_argument("--paper-dir", required=True, help="Path to project root (contains pdf/data/code). Example: D:\\Data\\...\\mnsc_2023_03369")
    parser.add_argument("--images-dir", required=True, help="Directory of table images (png/jpg).")
    parser.add_argument("--output-dir", required=True, help="Where to write csv/skeleton outputs.")
    parser.add_argument("--paper-id", required=False, help="Paper id (default from folder name).")
    parser.add_argument("--model", default=None, help="Override LLM model (default env PRE_ANNOTATOR_MODEL or gpt-4o).")
    parser.add_argument("--examples-dir", default="sample_data", help="Directory containing reference csv+skeleton to show the LLM expected format.")
    args = parser.parse_args()

    paper_dir = Path(args.paper_dir)
    images_dir = Path(args.images_dir)
    out_dir = Path(args.output_dir)
    paper_id = args.paper_id or paper_dir.name

    ctx_loader = ContextLoader(paper_dir)
    ctx = ctx_loader.build(paper_id)

    # Load API config: prefer config.local.json in pre_annotator or --output-dir dir, then env
    cfg = load_config_from_file(Path("pre_annotator/config.local.json")) or load_config_from_env()
    if args.model:
        cfg.model = args.model
    client = client_from_config(cfg)

    example_text = load_examples(Path(args.examples_dir))

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
                example_text=example_text,
            )
            panels = result.get("panels")
            if panels and isinstance(panels, list):
                for idx, panel in enumerate(panels):
                    panel_id = panel.get("panel_id") or panel.get("id") or chr(ord("A") + idx)
                    p_csv = out_dir / f"{paper_id}_{table_id}_{panel_id}.csv"
                    p_sk = out_dir / f"{paper_id}_{table_id}_{panel_id}.skeleton.json"
                    grid = panel.get("grid") or panel.get("rows") or []
                    skeleton = panel.get("skeleton") or {}
                    skeleton.setdefault("paper_id", paper_id)
                    skeleton.setdefault("table_id", f"{table_id}_{panel_id}")
                    skeleton.setdefault("panel_id", panel_id)
                    skeleton.setdefault("grid_file", p_csv.name)
                    skeleton.setdefault("image_file", img.name)
                    skeleton.setdefault("status", "in_progress")
                    skeleton.setdefault("bracket_type_default", skeleton.get("bracket_type_default", "unknown"))
                    write_csv(p_csv, grid)
                    write_json(p_sk, skeleton)
            else:
                grid = result.get("grid") or result.get("rows") or []
                skeleton = result.get("skeleton") or {}
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
