export type TableListItem = {
  paper_id: string;
  table_id: string;
  csv_path: string;
  image_path: string | null;
  skeleton_path: string | null;
  status: string;
};

export type GridData = {
  header: string[];
  rows: string[][];
};

export type SkeletonModel = {
  paper_id: string;
  table_id: string;
  grid_file: string;
  image_file?: string | null;
  status: string;
  bracket_type_default: string;
  bracket_type_overrides: Record<string, string>;
  y_columns: any[];
  x_rows: any[];
  fe_rows: any[];
  obs_rows: any[];
  notes: {
    rows: Record<string, string>;
    cols: Record<string, string>;
    cells: Record<string, string>;
  };
  last_modified?: string;
};

export type TableDetail = {
  info: TableListItem;
  grid: GridData;
  skeleton: SkeletonModel;
};

export type AppConfig = {
  root_dir: string;
  openai_base_url?: string | null;
  openai_api_key_set?: boolean;
};

const withRoot = (path: string, rootDir: string) => {
  if (!rootDir) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}root_dir=${encodeURIComponent(rootDir)}`;
};

export async function getConfig(): Promise<AppConfig> {
  const res = await fetch("/api/config");
  if (!res.ok) {
    throw new Error("加载配置失败");
  }
  return res.json();
}

export async function updateConfig(cfg: Partial<AppConfig> & { openai_api_key?: string | null }): Promise<AppConfig> {
  const res = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      root_dir: cfg.root_dir,
      openai_base_url: cfg.openai_base_url,
      openai_api_key: cfg.openai_api_key
    })
  });
  if (!res.ok) {
    throw new Error("保存配置失败");
  }
  return res.json();
}

export async function fetchProjects(rootDir: string): Promise<TableListItem[]> {
  const res = await fetch(withRoot("/api/projects", rootDir));
  if (!res.ok) {
    throw new Error("Failed to load projects");
  }
  return res.json();
}

export async function fetchTableDetail(
  paperId: string,
  tableId: string,
  rootDir: string
): Promise<TableDetail> {
  const res = await fetch(withRoot(`/api/table/${paperId}/${tableId}`, rootDir));
  if (!res.ok) {
    throw new Error("Failed to load table detail");
  }
  return res.json();
}

export function imageUrl(paperId: string, tableId: string, rootDir: string): string {
  return withRoot(`/api/table/${paperId}/${tableId}/image`, rootDir);
}

export type PaperContext = {
  columns: string[];
  pdfs: string[];
  code_docs: string[];
};

export async function fetchPaperContext(paperId: string, rootDir: string): Promise<PaperContext> {
  const res = await fetch(withRoot(`/api/paper/${paperId}/context`, rootDir));
  if (!res.ok) {
    throw new Error("Failed to load paper context");
  }
  return res.json();
}

export function docUrl(paperId: string, relativePath: string, rootDir: string): string {
  const encoded = encodeURIComponent(relativePath);
  return withRoot(`/api/paper/${paperId}/doc?path=${encoded}`, rootDir);
}

export async function saveCsv(
  paperId: string,
  tableId: string,
  rootDir: string,
  grid: GridData
): Promise<void> {
  const res = await fetch(withRoot(`/api/table/${paperId}/${tableId}/save_csv`, rootDir), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(grid)
  });
  if (!res.ok) {
    throw new Error("保存 CSV 失败");
  }
}

export async function saveSkeleton(
  paperId: string,
  tableId: string,
  rootDir: string,
  skeleton: SkeletonModel
): Promise<void> {
  const res = await fetch(withRoot(`/api/table/${paperId}/${tableId}/save_skeleton`, rootDir), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(skeleton)
  });
  if (!res.ok) {
    throw new Error("保存 Skeleton 失败");
  }
}

export async function suggestGrid(
  paperId: string,
  tableId: string,
  rootDir: string,
  instruction?: string
): Promise<string[][]> {
  const res = await fetch(withRoot(`/api/table/${paperId}/${tableId}/suggest_grid`, rootDir), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction })
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`LLM 建议失败: ${msg}`);
  }
  const data = await res.json();
  return data.rows;
}
