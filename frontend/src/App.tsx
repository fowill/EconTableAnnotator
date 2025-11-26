import { useEffect, useMemo, useState } from "react";
import { fetchProjects, fetchTableDetail, imageUrl, TableDetail, TableListItem } from "./api";

const statusBadge = (status: string) => {
  const normalized = status?.toLowerCase();
  if (normalized === "done") return <span className="badge green">完成</span>;
  if (normalized === "in_progress") return <span className="badge amber">进行中</span>;
  return <span className="badge gray">未开始</span>;
};

const GridPreview = ({ detail }: { detail: TableDetail }) => {
  if (!detail) return null;
  const previewRows = detail.grid.rows.slice(0, 8);
  return (
    <div className="grid-preview">
      <div style={{ fontWeight: 700, marginBottom: 6 }}>CSV 预览</div>
      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              {detail.grid.header.map((col, idx) => (
                <th key={idx}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, ridx) => (
              <tr key={ridx}>
                {row.map((cell, cidx) => (
                  <td key={cidx}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function App() {
  const [rootDir, setRootDir] = useState("");
  const [projects, setProjects] = useState<TableListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TableListItem | null>(null);
  const [detail, setDetail] = useState<TableDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((cfg) => setRootDir(cfg.root_dir || ""))
      .catch(() => {});
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    setDetail(null);
    try {
      const list = await fetchProjects(rootDir);
      setProjects(list);
    } catch (err: any) {
      setError(err.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (item: TableListItem) => {
    setSelected(item);
    setDetail(null);
    setDetailError(null);
    try {
      const data = await fetchTableDetail(item.paper_id, item.table_id, rootDir);
      setDetail(data);
    } catch (err: any) {
      setDetailError(err.message || "加载失败");
    }
  };

  const imageSrc = useMemo(() => {
    if (!selected) return "";
    return imageUrl(selected.paper_id, selected.table_id, rootDir);
  }, [selected, rootDir]);

  return (
    <div className="page">
      <h1 style={{ margin: 0 }}>Econ Table Annotator</h1>
      <p style={{ margin: 0, opacity: 0.8 }}>
        本地标注站：左看图片，右修 CSV / Skeleton。先加载项目列表，再点选表格进入标注模式。
      </p>

      <div className="card">
        <div className="row">
          <input
            className="input"
            placeholder="root_dir (后端可访问的目录)"
            value={rootDir}
            onChange={(e) => setRootDir(e.target.value)}
          />
          <button className="button" onClick={loadProjects} disabled={loading}>
            {loading ? "加载中..." : "加载项目"}
          </button>
        </div>
        {error && <div style={{ color: "#fca5a5", marginTop: 8 }}>{error}</div>}
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 120 }}>paper_id</th>
              <th style={{ width: 80 }}>table_id</th>
              <th>csv</th>
              <th style={{ width: 140 }}>状态</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((item) => (
              <tr
                key={`${item.paper_id}-${item.table_id}`}
                onClick={() => openDetail(item)}
                style={{ cursor: "pointer", background: selected === item ? "rgba(255,255,255,0.04)" : "transparent" }}
              >
                <td>{item.paper_id}</td>
                <td>{item.table_id}</td>
                <td style={{ fontSize: 12, opacity: 0.8 }}>{item.csv_path}</td>
                <td>{statusBadge(item.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card">
          <div className="row" style={{ alignItems: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {selected.paper_id} / {selected.table_id}
            </div>
            <div>{statusBadge(selected.status)}</div>
            <div style={{ flex: 1 }} />
            <button className="button secondary" onClick={() => setSelected(null)}>
              关闭
            </button>
          </div>
          {detailError && <div style={{ color: "#fca5a5", marginTop: 8 }}>{detailError}</div>}
          <div className="row" style={{ alignItems: "flex-start" }}>
            {selected.image_path ? (
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>图片预览</div>
                <img className="image-preview" src={imageSrc} alt="table" />
              </div>
            ) : (
              <div style={{ flex: 1, minWidth: 280, color: "#fbbf24" }}>没有找到配套图片</div>
            )}

            {detail ? (
              <div style={{ flex: 2, minWidth: 400 }}>
                <GridPreview detail={detail} />
                <div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>
                  Skeleton 状态: {detail.skeleton.status} · 默认括号: {detail.skeleton.bracket_type_default}
                </div>
              </div>
            ) : (
              <div style={{ flex: 2, minWidth: 400 }}>正在加载表格内容...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
