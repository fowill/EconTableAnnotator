from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional
import base64
import json
import os

import openai


@dataclass
class LLMConfig:
    api_key: Optional[str]
    base_url: Optional[str]
    model: str = "gpt-4o"


def load_config_from_env() -> LLMConfig:
    return LLMConfig(
        api_key=os.getenv("OPENAI_API_KEY") or os.getenv("PRE_ANNOTATOR_API_KEY"),
        base_url=os.getenv("OPENAI_BASE_URL") or os.getenv("PRE_ANNOTATOR_BASE_URL"),
        model=os.getenv("PRE_ANNOTATOR_MODEL", "gpt-4o"),
    )


def load_config_from_file(path: Path) -> Optional[LLMConfig]:
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return LLMConfig(
            api_key=data.get("api_key"),
            base_url=data.get("base_url"),
            model=data.get("model") or "gpt-4o",
        )
    except Exception:
        return None


def client_from_config(cfg: LLMConfig) -> openai.OpenAI:
    if not cfg.api_key:
        raise ValueError("Missing OPENAI_API_KEY / PRE_ANNOTATOR_API_KEY")
    kwargs: Dict[str, Any] = {"api_key": cfg.api_key}
    if cfg.base_url:
        kwargs["base_url"] = cfg.base_url
    return openai.OpenAI(**kwargs)


def image_to_data_url(path) -> str:
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:image/{path.suffix.lstrip('.')};base64,{b64}"


def parse_llm_json(content: str) -> Dict[str, Any]:
    """Robustly parse JSON content (handles ```json fences)."""
    text = content.strip()
    if text.startswith("```"):
        # strip first fence
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1 :]
        if text.endswith("```"):
            text = text[:-3]
    return json.loads(text)


def ask_for_grid_and_skeleton(
    client: openai.OpenAI,
    model: str,
    image_path,
    paper_id: str,
    table_id: str,
    code_text: str,
    candidate_columns,
    candidate_code_vars,
    example_text: str = "",
) -> Dict[str, Any]:
    """
    Call LLM to return a JSON payload:
    {
      "grid": [["row_id","c1",...], ...],
      "skeleton": {...}
    }
    """
    # Keep context concise
    col_list = list(candidate_columns)[:400]
    code_list = list(candidate_code_vars)[:400]

    example_block = """
Example (table with interactions):
Code fragment:
  reg EntryGrowth PostOffice FinancialServices PostOffice#FinancialServices controls..., fe industry cohort
Data columns (sample):
  entry_growth, post_offices, fin_services, post_offices_x_fin_services, size, roe, industry_fe, cohort_fe
Expected CSV (partial):
row,c1,c2,c3,c4,c5
1,1(Post Offices),0.030**,0.038**,0.038***,0.016,0.025**
2,,(0.013),(0.015),(0.013),(0.011),(0.013)
3,Financial Services,0.021,,,,
5,1(Post Offices) × Financial Services,0.008,,,,
...
Expected skeleton (partial):
  y_columns: col=1..5 depvar_label=Entry Growth depvar_data_name=entry_growth
  x_rows:
    row1: display_label=1(Post Offices), data_var_name=post_offices, role=key
    row3: display_label=Financial Services, data_var_name=fin_services, role=control
    row5: display_label=1(Post Offices) × Financial Services, data_var_name=post_offices_x_fin_services, role=interaction
    ...
  obs_rows: row27 Observations
  bracket_type_default: std_err
"""
    stem = Path(image_path).stem.lower()
    panel_hint = stem.endswith("wp") or stem.endswith("_wp") or "_wp" in stem

    prompt = (
        "You extract regression tables from an image and map each row/column to dataset variable names.\n"
        f"- Panel rule (hard): {'FILENAME HAS _WP: ALWAYS split into panels (Panel A/B/C...) even if ambiguous; return multiple panels.' if panel_hint else 'FILENAME HAS NO _WP: NEVER split panels; always return a single grid/skeleton, ignore any panel-looking text.'}\n"
        "- If panels are present (wp case), return multiple entries with distinct panel_id and grids; otherwise return a single grid/skeleton.\n"
        "- For each panel: reconstruct the grid (rows as arrays). First column is row_id (1-based).\n"
        "- Provide skeleton JSON per panel: y_columns, x_rows, fe_rows, obs_rows, bracket_type_default.\n"
        "- CRUCIAL: For every y_column, x_row, and fe_row, fill data_var_name based on regression code and dataset column names. Use the actual variable names in the regression code (e.g., reghdfe absorb(), i(var)#t, l.var) to map to dataset columns. Fixed effects often appear as absorb(industry), i(industry_year), fevar, etc. Do NOT leave blank; if impossible, set 'unknown'. Consider interactions (x*y), lags, prefixes, case/underscore variants.\n"
        "- Match depvar_label / display labels from the table text. Keep numbers/asterisks/brackets exactly.\n"
        f"Paper id: {paper_id}, table id: {table_id}.\n"
        f"Candidate dataset columns (full): {', '.join(col_list)}\n"
        f"Variable names seen in code (full): {', '.join(code_list)}\n"
        "Use the regression code and column names to choose the closest data_var_name for each row/column.\n"
        "Return pure JSON. Preferred structure:\n"
        "{ \"panels\": [ {\"panel_id\":\"A\",\"grid\": [...], \"skeleton\": {...}}, ... ] }\n"
        "If single panel, you may return {\"grid\": [...], \"skeleton\": {...}}.\n"
        "Skeleton fields: paper_id, table_id, grid_file, image_file, panel_id (if any), status, bracket_type_default, y_columns[{col,depvar_label,depvar_data_name,note}], x_rows[{row,display_label,data_var_name,role,note}], fe_rows[{row,label,data_var_name,note}], obs_rows[{row,label,note}], notes{rows,cols,cells}, last_modified.\n"
        "\nReference format example:\n"
        + example_block
    )
    if example_text:
        prompt += "\nAdditional sample fragments:\n" + example_text
    messages = [
        {"role": "system", "content": "You are a precise data extraction assistant."},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt + "\n\nFULL code context (use to infer data_var_name):\n" + code_text[:20000]},
                {"type": "image_url", "image_url": {"url": image_to_data_url(image_path)}},
            ],
        },
    ]
    resp = client.chat.completions.create(model=model, messages=messages, temperature=0)
    content = resp.choices[0].message.content
    # Content expected to be JSON; try to parse
    return parse_llm_json(content)
