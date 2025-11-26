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

const withRoot = (path: string, rootDir: string) =>
  rootDir ? `${path}?root_dir=${encodeURIComponent(rootDir)}` : path;

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
