
import { useEffect, useMemo, useState } from "react";
import {
  fetchProjects,
  fetchTableDetail,
  getConfig,
  imageUrl,
  saveCsv,
  saveSkeleton,
  suggestGrid,
  updateConfig,
  SkeletonModel,
  TableDetail,
  TableListItem
} from "./api";

type XRow = SkeletonModel["x_rows"][number];
type YCol = SkeletonModel["y_columns"][number];
type MenuState = { type: "row" | "col"; index: number; x: number; y: number } | null;

const statusBadge = (status: string) => {
  const normalized = status?.toLowerCase();
  if (normalized === "done") return <span className="badge green">完成</span>;
  if (normalized === "in_progress") return <span className="badge amber">进行中</span>;
  return <span className="badge gray">未开始</span>;
};

const getRowId = (row: string[], idx: number) => {
  const maybe = parseInt(row[0], 10);
  return Number.isFinite(maybe) ? maybe : idx + 1;
};

function App() {
  const [rootDir, setRootDir] = useState("");
  const [projects, setProjects] = useState<TableListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<TableListItem | null>(null);
  const [detail, setDetail] = useState<TableDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [gridDraft, setGridDraft] = useState<string[][]>([]);
  const [skeletonDraft, setSkeletonDraft] = useState<SkeletonModel | null>(null);

  const [savingCsv, setSavingCsv] = useState(false);
  const [savingSkeleton, setSavingSkeleton] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [gridDirty, setGridDirty] = useState(false);
  const [skeletonDirty, setSkeletonDirty] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [showImageModal, setShowImageModal] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestInstruction, setSuggestInstruction] = useState("");
  const [suggestedRows, setSuggestedRows] = useState<string[][] | null>(null);
  const [llmStatus, setLlmStatus] = useState<string>("");

  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);

  const [menu, setMenu] = useState<MenuState>(null);

  useEffect(() => {
    getConfig()
      .then((cfg) => {
        setRootDir(cfg.root_dir || "");
        setBaseUrl(cfg.openai_base_url || "");
        setApiKeySet(Boolean(cfg.openai_api_key_set));
      })
      .catch(() => {});
  }, []);
  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    setDetail(null);
    setEditMode(false);
    setGridDirty(false);
    setSkeletonDirty(false);
    try {
      const list = await fetchProjects(rootDir);
      setProjects(list);
    } catch (err: any) {
      setError(err.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const refreshProjects = async () => {
    try {
      const list = await fetchProjects(rootDir);
      setProjects(list);
      return list;
    } catch (err: any) {
      setError(err.message || "加载失败");
      return projects;
    }
  };

  const openDetail = async (item: TableListItem) => {
    setSelected(item);
    setDetail(null);
    setDetailError(null);
    setEditMode(false);
    setGridDirty(false);
    setSkeletonDirty(false);
    setSuggestedRows(null);
    try {
      const data = await fetchTableDetail(item.paper_id, item.table_id, rootDir);
      setDetail(data);
      setGridDraft(data.grid.rows.map((r) => [...r]));
      setSkeletonDraft(structuredClone(data.skeleton));
    } catch (err: any) {
      setDetailError(err.message || "加载失败");
    }
  };

  const imageSrc = useMemo(() => {
    if (!selected) return "";
    return imageUrl(selected.paper_id, selected.table_id, rootDir);
  }, [selected, rootDir]);

  const onCellChange = (r: number, c: number, value: string) => {
    setGridDraft((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = value;
      return next;
    });
    setGridDirty(true);
  };
  const saveAll = async (andNext?: boolean) => {
    if (!detail || !skeletonDraft) return;
    setSavingCsv(true);
    setSavingSkeleton(true);
    setSaveMsg(null);
    try {
      await saveCsv(detail.info.paper_id, detail.info.table_id, rootDir, {
        header: detail.grid.header,
        rows: gridDraft
      });
      await saveSkeleton(detail.info.paper_id, detail.info.table_id, rootDir, skeletonDraft);
      setSaveMsg(andNext ? "已保存，跳转中..." : "已保存全部");
      setGridDirty(false);
      setSkeletonDirty(false);
      if (andNext) {
        const list = await refreshProjects();
        const currentIndex = list.findIndex(
          (p) => p.paper_id === detail.info.paper_id && p.table_id === detail.info.table_id
        );
        const next =
          list.slice(currentIndex + 1).find((p) => p.status !== "done") ||
          list.find((p) => p.status !== "done" && !(p.paper_id === detail.info.paper_id && p.table_id === detail.info.table_id));
        if (next) {
          await openDetail(next);
          setEditMode(true);
        } else {
          setSaveMsg("已保存，暂无未完成任务");
        }
      }
    } catch (err: any) {
      setSaveMsg(err.message || "保存失败");
    } finally {
      setSavingCsv(false);
      setSavingSkeleton(false);
    }
  };

  const updateSkeleton = (updater: (s: SkeletonModel) => SkeletonModel) => {
    setSkeletonDraft((prev) => {
      if (!prev) return prev;
      setSkeletonDirty(true);
      return updater(structuredClone(prev));
    });
  };

  const toggleYCol = (col: number) => {
    updateSkeleton((s) => {
      const exists = s.y_columns.find((c) => c.col === col);
      if (exists) {
        s.y_columns = s.y_columns.filter((c) => c.col !== col);
      } else {
        s.y_columns.push({ col, depvar_label: "", depvar_data_name: "", note: "" });
      }
      return s;
    });
  };

  const updateYField = (col: number, key: keyof YCol, value: string) => {
    updateSkeleton((s) => {
      s.y_columns = s.y_columns.map((c) => (c.col === col ? { ...c, [key]: value } : c));
      return s;
    });
  };

  const toggleXRow = (row: number, defaultLabel: string) => {
    updateSkeleton((s) => {
      const exists = s.x_rows.find((r) => r.row === row);
      if (exists) {
        s.x_rows = s.x_rows.filter((r) => r.row !== row);
      } else {
        s.x_rows.push({
          row,
          display_label: defaultLabel,
          data_var_name: "",
          role: "key",
          note: ""
        });
      }
      return s;
    });
  };

  const updateXField = (row: number, key: keyof XRow, value: string) => {
    updateSkeleton((s) => {
      s.x_rows = s.x_rows.map((r) => (r.row === row ? { ...r, [key]: value } : r));
      return s;
    });
  };

  const setCoreRow = (row: number, defaultLabel: string) => {
    updateSkeleton((s) => {
      const exists = s.x_rows.find((r) => r.row === row);
      if (exists) {
        exists.role = "key";
      } else {
        s.x_rows.push({
          row,
          display_label: defaultLabel,
          data_var_name: "",
          role: "key",
          note: ""
        });
      }
      return s;
    });
  };

  const toggleFERow = (row: number, label: string) => {
    updateSkeleton((s) => {
      const exists = s.fe_rows.find((r) => r.row === row);
      if (exists) {
        s.fe_rows = s.fe_rows.filter((r) => r.row !== row);
      } else {
        s.fe_rows.push({ row, label, note: "" });
      }
      return s;
    });
  };

  const toggleObsRow = (row: number, label: string) => {
    updateSkeleton((s) => {
      const exists = s.obs_rows.find((r) => r.row === row);
      if (exists) {
        s.obs_rows = s.obs_rows.filter((r) => r.row !== row);
      } else {
        s.obs_rows.push({ row, label, note: "" });
      }
      return s;
    });
  };
  const updateStatusOnly = async (status: "done" | "in_progress") => {
    if (!detail || !skeletonDraft) return;
    setSavingSkeleton(true);
    setSaveMsg(null);
    try {
      const payload = { ...skeletonDraft, status };
      await saveSkeleton(detail.info.paper_id, detail.info.table_id, rootDir, payload);
      setSkeletonDraft(payload);
      setDetail((prev) => (prev ? { ...prev, skeleton: { ...prev.skeleton, status } } : prev));
      setSelected((prev) => (prev ? { ...prev, status } : prev));
      const list = await refreshProjects();
      setSaveMsg(status === "done" ? "已标记为完成" : "已标记为未完成");
      setGridDirty(false);
      setSkeletonDirty(false);
      if (status === "done") {
        const currentIndex = list.findIndex(
          (p) => p.paper_id === detail.info.paper_id && p.table_id === detail.info.table_id
        );
        const next =
          list.slice(currentIndex + 1).find((p) => p.status !== "done") ||
          list.find((p) => p.status !== "done" && !(p.paper_id === detail.info.paper_id && p.table_id === detail.info.table_id));
        if (next) {
          await openDetail(next);
          setEditMode(true);
        } else {
          setSaveMsg("已标记完成，暂无未完成任务");
        }
      }
    } catch (err: any) {
      setSaveMsg(err.message || "保存失败");
    } finally {
      setSavingSkeleton(false);
    }
  };

  const attemptJump = async (item: TableListItem) => {
    const dirty = gridDirty || skeletonDirty;
    if (selected && dirty) {
      const ok = window.confirm("有未保存的改动，是否保存后跳转？取消则留在当前页面。");
      if (!ok) return;
      try {
        if (detail) {
          await saveAll(false);
        }
      } catch (e) {
        setSaveMsg("保存失败，未跳转");
        return;
      }
    }
    openDetail(item);
  };

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      if (a.paper_id === b.paper_id) return a.table_id.localeCompare(b.table_id);
      return a.paper_id.localeCompare(b.paper_id);
    });
  }, [projects]);

  const normalizeHeader = (len: number) => ["row", ...Array.from({ length: len - 1 }, (_v, i) => `c${i + 1}`)];

  const applyGridUpdate = (rows: string[][], headerLen: number) => {
    const header = normalizeHeader(headerLen);
    const fixedRows = rows.map((r) => {
      const row = [...r];
      while (row.length < headerLen) row.push("");
      return row.slice(0, headerLen);
    });
    setGridDraft(fixedRows);
    setGridDirty(true);
    setDetail((prev) => (prev ? { ...prev, grid: { ...prev.grid, header } } : prev));
  };

  const removeColumn = (idx: number) => {
    if (idx === 0) return;
    const newRows = gridDraft.map((row) => row.filter((_, c) => c !== idx));
    applyGridUpdate(newRows, Math.max(2, (detail?.grid.header.length || 1) - 1));
  };

  const removeRow = (ridx: number) => {
    const newRows = gridDraft.filter((_, i) => i !== ridx);
    applyGridUpdate(newRows, detail?.grid.header.length || (gridDraft[0]?.length ?? 1));
  };

  const insertColumnAt = (idx: number) => {
    if (idx < 1) idx = 1;
    const newRows = gridDraft.map((row) => {
      const copy = [...row];
      copy.splice(idx, 0, "");
      return copy;
    });
    const headerLen = (detail?.grid.header.length || (gridDraft[0]?.length ?? 1)) + 1;
    applyGridUpdate(newRows, headerLen);
  };

  const insertRowAt = (idx: number) => {
    const headerLen = detail?.grid.header.length || (gridDraft[0]?.length ?? 1);
    const emptyRow = Array.from({ length: headerLen }, () => "");
    const newRows = [...gridDraft.slice(0, idx), emptyRow, ...gridDraft.slice(idx)];
    applyGridUpdate(newRows, headerLen);
  };

  const runSuggest = async () => {
    if (!detail) return;
    setSuggestLoading(true);
    setSaveMsg(null);
    setLlmStatus("LLM 请求中...");
    try {
      const rows = await suggestGrid(detail.info.paper_id, detail.info.table_id, rootDir, suggestInstruction);
      setSuggestedRows(rows);
      setSaveMsg("已生成 LLM 建议，可选择 Accept 或 Reject");
      setLlmStatus("已生成建议，等待确认");
    } catch (err: any) {
      setSaveMsg(err.message || "LLM 建议失败");
      setLlmStatus(`LLM 失败: ${err.message || ""}`);
    } finally {
      setSuggestLoading(false);
    }
  };

  const acceptSuggest = () => {
    if (!suggestedRows) return;
    setGridDraft(suggestedRows);
    setGridDirty(true);
    setSuggestedRows(null);
    setSaveMsg("已应用 LLM 建议，请保存");
    setLlmStatus("已应用建议，记得保存");
  };

  const rejectSuggest = () => {
    setSuggestedRows(null);
    setSaveMsg("已拒绝 LLM 建议");
    setLlmStatus("已拒绝建议");
  };

  const saveConfig = async () => {
    try {
      const res = await updateConfig({
        root_dir: rootDir,
        openai_base_url: baseUrl || null,
        openai_api_key: apiKey ? apiKey : undefined
      });
      setRootDir(res.root_dir || rootDir);
      setBaseUrl(res.openai_base_url || "");
      setApiKeySet(Boolean(res.openai_api_key_set));
      if (apiKey) setApiKey("");
      setSaveMsg("配置已保存");
    } catch (err: any) {
      setSaveMsg(err.message || "配置保存失败");
    }
  };

  const forgetApiKey = async () => {
    try {
      const res = await updateConfig({
        root_dir: rootDir,
        openai_base_url: baseUrl || null,
        openai_api_key: ""
      });
      setApiKey("");
      setApiKeySet(Boolean(res.openai_api_key_set));
      setSaveMsg("已清除 API Key");
    } catch (err: any) {
      setSaveMsg(err.message || "清除失败");
    }
  };

  const isYCol = (col: number) => skeletonDraft?.y_columns.some((c) => c.col === col);
  const yCol = (col: number) => skeletonDraft?.y_columns.find((c) => c.col === col);
  const xRow = (row: number) => skeletonDraft?.x_rows.find((r) => r.row === row);
  const isFERow = (row: number) => skeletonDraft?.fe_rows.some((r) => r.row === row);
  const isObsRow = (row: number) => skeletonDraft?.obs_rows.some((r) => r.row === row);

  const saving = savingCsv || savingSkeleton;
  return (
    <div className="page" onClick={() => setMenu(null)}>
      <h1 style={{ margin: 0 }}>Econ Table Annotator</h1>
      <p style={{ margin: 0, opacity: 0.8 }}>
        本地标注站：左看图片，右修 CSV / Skeleton。先加载项目列表，再点选表格进入标注模式。
      </p>

      {!editMode && (
        <div className="card">
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{ fontSize: 12, color: "#6b7280" }}>root_dir</label>
              <input
                className="input"
                placeholder="后端可访问的目录"
                value={rootDir}
                onChange={(e) => setRootDir(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 12, color: "#6b7280" }}>OpenAI Base URL (可选)</label>
              <input
                className="input"
                placeholder="如 https://api.shubiaobiao.cn/v1/"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 12, color: "#6b7280" }}>
                API Key {apiKeySet ? "（已设置）" : ""}
              </label>
              {!apiKeySet ? (
                <input
                  className="input"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  type="password"
                />
              ) : (
                <div style={{ fontSize: 13, color: "#065f46" }}>已设置，除非更换无需再次填写</div>
              )}
            </div>
            <button className="button" onClick={saveConfig} style={{ height: 42 }}>
              保存配置
            </button>
            <button className="button secondary" onClick={forgetApiKey} style={{ height: 42 }}>
              忘记 API Key
            </button>
            <button className="button" onClick={loadProjects} disabled={loading} style={{ height: 42 }}>
              {loading ? "加载中..." : "加载项目"}
            </button>
          </div>
          {error && <div style={{ color: "#b91c1c", marginTop: 8 }}>{error}</div>}
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 120 }}>paper_id</th>
                <th style={{ width: 80 }}>table_id</th>
                <th>csv</th>
                <th style={{ width: 140 }}>状态</th>
                <th style={{ width: 160 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((item) => (
                <tr
                  key={`${item.paper_id}-${item.table_id}`}
                  onClick={() => openDetail(item)}
                  style={{ cursor: "pointer", background: selected === item ? "#eef2ff" : "transparent" }}
                >
                  <td>{item.paper_id}</td>
                  <td>{item.table_id}</td>
                  <td style={{ fontSize: 12, opacity: 0.8 }}>{item.csv_path}</td>
                  <td>{statusBadge(item.status)}</td>
                  <td>
                    <button
                      className="mini-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selected?.paper_id === item.paper_id && selected?.table_id === item.table_id) {
                          updateStatusOnly("done");
                        } else {
                          openDetail(item).then(() => updateStatusOnly("done"));
                        }
                      }}
                    >
                      标记完成
                    </button>
                    <button
                      className="mini-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selected?.paper_id === item.paper_id && selected?.table_id === item.table_id) {
                          updateStatusOnly("in_progress");
                        } else {
                          openDetail(item).then(() => updateStatusOnly("in_progress"));
                        }
                      }}
                    >
                      标记未完成
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <div className="card">
          <div className="row" style={{ alignItems: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {selected.paper_id} / {selected.table_id}
            </div>
            <div>{statusBadge(selected.status)}</div>
            <div style={{ flex: 1 }} />
            {detail && (
              <button className="button secondary" onClick={() => setEditMode((v) => !v)}>
                {editMode ? "退出编辑" : "进入编辑"}
              </button>
            )}
            {!editMode && (
              <button className="button secondary" onClick={loadProjects}>
                返回列表
              </button>
            )}
            <button className="button secondary" onClick={() => setSelected(null)}>
              关闭
            </button>
          </div>
          {detailError && <div style={{ color: "#b91c1c", marginTop: 8 }}>{detailError}</div>}

          {detail ? (
            <div className="row edit-shell vertical">
              <div className="status-rail">
                <div style={{ fontWeight: 700, marginBottom: 8 }}>任务</div>
                <div className="status-list">
                  {sortedProjects.map((p) => (
                    <div
                      key={`${p.paper_id}-${p.table_id}`}
                      className={`status-item ${
                        selected?.paper_id === p.paper_id && selected?.table_id === p.table_id ? "active" : ""
                      }`}
                      onClick={() => attemptJump(p)}
                    >
                      <div className="status-top">
                        <span>{p.paper_id}</span>
                        <span className={`pill ${p.status}`}>{p.status}</span>
                      </div>
                      <div className="status-sub">{p.table_id}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="image-panel">
                <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 700 }}>图片预览</div>
                  <div className="row" style={{ alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>缩放</span>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.05"
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                    />
                    <span style={{ fontSize: 12, color: "#6b7280", width: 40 }}>{Math.round(zoom * 100)}%</span>
                    <button className="button secondary" onClick={() => setShowImageModal(true)}>
                      查看大图
                    </button>
                  </div>
                </div>
                {selected.image_path ? (
                  <div className="image-container">
                    <img className="image-preview" style={{ transform: `scale(${zoom})` }} src={imageSrc} alt="table" />
                  </div>
                ) : (
                  <div style={{ color: "#d97706" }}>没有找到配套图片</div>
                )}
              </div>
              <div className="edit-panel">
                {editMode ? (
                  <>
                    <div className="grid-preview" style={{ maxHeight: 520 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>可编辑 CSV + 点选标注</div>
                      <div style={{ overflowX: "auto" }}>
                        <table className="table annotate-table">
                          <thead>
                            <tr>
                              {detail.grid.header.map((col, idx) => {
                                const displayName = idx === 0 ? "row" : `c${idx}`;
                                const colNum = idx;
                                const active = idx !== 0 && isYCol(colNum);
                                return (
                                  <th
                                    key={idx}
                                    className={active ? "highlight" : ""}
                                    onClick={() => {
                                      if (idx !== 0) toggleYCol(colNum);
                                    }}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      if (idx === 0) return;
                                      setMenu({ type: "col", index: idx, x: e.clientX, y: e.clientY });
                                    }}
                                    title={idx === 0 ? "行编号" : "点击标注/取消为 Y 列，右键更多操作"}
                                  >
                                    <div className="col-header">
                                      {idx > 0 && (
                                        <button
                                          className="gap-add danger"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeColumn(idx);
                                          }}
                                        >
                                          -
                                        </button>
                                      )}
                                      <span>{displayName}</span>
                                      {idx > 0 && (
                                        <button
                                          className="gap-add"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            insertColumnAt(idx + 1);
                                          }}
                                        >
                                          +
                                        </button>
                                      )}
                                    </div>
                                    {active && (
                                      <div className="small-inputs" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          placeholder="depvar_label"
                                          value={yCol(colNum)?.depvar_label || ""}
                                          onChange={(e) => updateYField(colNum, "depvar_label", e.target.value)}
                                        />
                                        <input
                                          placeholder="data_var_name"
                                          value={yCol(colNum)?.depvar_data_name || ""}
                                          onChange={(e) => updateYField(colNum, "depvar_data_name", e.target.value)}
                                        />
                                      </div>
                                    )}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {gridDraft.map((row, ridx) => {
                              const rowId = getRowId(row, ridx);
                              const x = xRow(rowId);
                              const fe = isFERow(rowId);
                              const obs = isObsRow(rowId);
                              const isCore = x?.role === "key";
                              return (
                                <tr key={ridx} className={x || fe || obs ? "highlight-row" : ""}>
                                  {row.map((cell, cidx) => (
                                    <td key={cidx}>
                                      {cidx === 0 ? (
                                        <div className="row row-labels">
                                          <span className="row-index">#{rowId}</span>
                                          <button
                                            className="gap-add danger"
                                            onClick={() => removeRow(ridx)}
                                            title="删除该行"
                                          >
                                            -
                                          </button>
                                          <button
                                            className={`mini-btn ${x ? "active" : ""}`}
                                            onClick={() => toggleXRow(rowId, row[1] || "")}
                                            title="标注为 X 行"
                                          >
                                            X
                                          </button>
                                          <button
                                            className={`mini-btn ${isCore ? "active core" : ""}`}
                                            onClick={() => setCoreRow(rowId, row[1] || "")}
                                            title="标注为核心 X"
                                          >
                                            核心
                                          </button>
                                          <button
                                            className={`mini-btn ${fe ? "active" : ""}`}
                                            onClick={() => toggleFERow(rowId, row[1] || "FE")}
                                            title="标注为 FE 行"
                                          >
                                            FE
                                          </button>
                                          <button
                                            className={`mini-btn ${obs ? "active" : ""}`}
                                            onClick={() => toggleObsRow(rowId, row[1] || "N")}
                                            title="标注为 N/Obs 行"
                                          >
                                            N
                                          </button>
                                          <button
                                            className="gap-add"
                                            onClick={() => insertRowAt(ridx + 1)}
                                            title="在当前行下方插入"
                                          >
                                            +
                                          </button>
                                        </div>
                                      ) : (
                                        <input
                                          className="cell-input"
                                          value={cell}
                                          onChange={(e) => onCellChange(ridx, cidx, e.target.value)}
                                        />
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="card" style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>X 行详情</div>
                      {skeletonDraft?.x_rows.map((r) => (
                        <div className="row" key={r.row} style={{ marginBottom: 8 }}>
                          <span style={{ width: 60 }}>Row {r.row}</span>
                          <input
                            className="input slim"
                            placeholder="display_label"
                            value={r.display_label || ""}
                            onChange={(e) => updateXField(r.row, "display_label", e.target.value)}
                          />
                          <input
                            className="input slim"
                            placeholder="data_var_name"
                            value={r.data_var_name || ""}
                            onChange={(e) => updateXField(r.row, "data_var_name", e.target.value)}
                          />
                          <select
                            className="input slim"
                            value={r.role}
                            onChange={(e) => updateXField(r.row, "role", e.target.value)}
                          >
                            <option value="key">key(核心)</option>
                            <option value="control">control</option>
                            <option value="interaction">interaction</option>
                            <option value="other">other</option>
                          </select>
                        </div>
                      ))}
                    </div>
                    {suggestedRows && (
                      <div className="card" style={{ marginTop: 10 }}>
                        <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ fontWeight: 700 }}>LLM 建议预览（未应用）</div>
                          <div className="row" style={{ gap: 8 }}>
                            <button className="button secondary" onClick={acceptSuggest}>
                              Accept
                            </button>
                            <button className="button secondary" onClick={rejectSuggest}>
                              Reject
                            </button>
                          </div>
                        </div>
                        <div className="grid-preview" style={{ maxHeight: 240 }}>
                          <table className="table">
                            <tbody>
                              {suggestedRows.slice(0, 6).map((row, idx) => (
                                <tr key={idx}>
                                  {row.map((cell, cidx) => (
                                    <td key={cidx}>{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="action-bar">
                      <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <button className="button big" onClick={() => saveAll(false)} disabled={saving}>
                          {saving ? "保存中..." : "保存全部"}
                        </button>
                        <button className="button big secondary" onClick={() => saveAll(true)} disabled={saving}>
                          {saving ? "保存中..." : "保存并跳到下一条"}
                        </button>
                        <button className="button secondary" onClick={() => updateStatusOnly("done")} disabled={saving}>
                          标记完成
                        </button>
                        <button className="button secondary" onClick={() => updateStatusOnly("in_progress")} disabled={saving}>
                          标记未完成
                        </button>
                        <input
                          className="input slim"
                          style={{ minWidth: 200 }}
                          placeholder="给 LLM 的补充指令（可选）"
                          value={suggestInstruction}
                          onChange={(e) => setSuggestInstruction(e.target.value)}
                        />
                        <button className="button secondary" onClick={runSuggest} disabled={suggestLoading}>
                          {suggestLoading ? "LLM 填充中..." : "LLM 填充建议"}
                        </button>
                        {saveMsg && <span style={{ color: "#0f5132" }}>{saveMsg}</span>}
                        {llmStatus && <span style={{ color: "#b45309" }}>{llmStatus}</span>}
                      </div>
                    </div>

                    <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 700 }}>括号含义</div>
                      {["t_stat", "std_err", "p_value", "unknown"].map((opt) => (
                        <label key={opt} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="radio"
                            name="bracket"
                            checked={skeletonDraft?.bracket_type_default === opt}
                            onChange={() =>
                              updateSkeleton((s) => {
                                s.bracket_type_default = opt;
                                return s;
                              })
                            }
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid-preview">
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>CSV 预览</div>
                      <div style={{ overflowX: "auto" }}>
                        <table className="table">
                          <thead>
                            <tr>
                              {detail.grid.header.map((col, idx) => (
                                <th key={idx}>{idx === 0 ? "row" : `c${idx}`}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {detail.grid.rows.slice(0, 8).map((row, ridx) => (
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
                    <div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>
                      Skeleton 状态: {detail.skeleton.status} · 默认括号: {detail.skeleton.bracket_type_default}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 2, minWidth: 400 }}>正在加载表格内容...</div>
          )}
        </div>
      )}

      {showImageModal && (
        <div className="modal-backdrop" onClick={() => setShowImageModal(false)}>
          <div className="modal-body" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>大图预览</div>
              <button className="button secondary" onClick={() => setShowImageModal(false)}>
                关闭
              </button>
            </div>
            <div className="modal-image-wrap">
              <img src={imageSrc} alt="full" />
            </div>
          </div>
        </div>
      )}

      {menu && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          {menu.type === "col" ? (
            <>
              <div onClick={() => { insertColumnAt(menu.index); setMenu(null); }}>在左侧插入列</div>
              <div onClick={() => { insertColumnAt(menu.index + 1); setMenu(null); }}>在右侧插入列</div>
            </>
          ) : (
            <>
              <div onClick={() => { insertRowAt(menu.index); setMenu(null); }}>在上方插入行</div>
              <div onClick={() => { insertRowAt(menu.index + 1); setMenu(null); }}>在下方插入行</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
