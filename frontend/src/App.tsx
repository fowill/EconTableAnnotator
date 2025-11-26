import React, { useEffect, useMemo, useRef, useState } from "react";
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
  if (normalized === "done") return <span className="badge green">done</span>;
  if (normalized === "in_progress") return <span className="badge amber">in progress</span>;
  return <span className="badge gray">not started</span>;
};

const getRowId = (row: string[], idx: number) => {
  const maybe = parseInt(row[0], 10);
  return Number.isFinite(maybe) ? maybe : idx + 1;
};

const useDragScroll = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 });

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input,textarea,button,select")) return;
    if (!ref.current) return;
    drag.current = { active: true, startX: e.clientX, scrollLeft: ref.current.scrollLeft };
    ref.current.classList.add("dragging");
    e.preventDefault();
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drag.current.active || !ref.current) return;
    const dx = e.clientX - drag.current.startX;
    ref.current.scrollLeft = drag.current.scrollLeft - dx;
  };

  const stop = () => {
    drag.current.active = false;
    ref.current?.classList.remove("dragging");
  };

  return { ref, onMouseDown, onMouseMove, onMouseUp: stop, onMouseLeave: stop };
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

  const editScroll = useDragScroll();
  const previewScroll = useDragScroll();

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
      setError(err.message || "load failed");
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
      setError(err.message || "load failed");
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
      setDetailError(err.message || "load failed");
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
      setSaveMsg(andNext ? "saved, jumping..." : "saved all");
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
          setSaveMsg("saved, no more pending items");
        }
      }
    } catch (err: any) {
      setSaveMsg(err.message || "save failed");
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
      setSaveMsg(status === "done" ? "marked done" : "marked in-progress");
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
          setSaveMsg("marked done, no next item");
        }
      }
    } catch (err: any) {
      setSaveMsg(err.message || "save failed");
    } finally {
      setSavingSkeleton(false);
    }
  };

  const attemptJump = async (item: TableListItem) => {
    const dirty = gridDirty || skeletonDirty;
    if (selected && dirty) {
      const ok = window.confirm("Unsaved changes. Save and jump?");
      if (!ok) return;
      try {
        if (detail) {
          await saveAll(false);
        }
      } catch (e) {
        setSaveMsg("save failed, stay on page");
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
    setLlmStatus("LLM requesting...");
    try {
      const rows = await suggestGrid(detail.info.paper_id, detail.info.table_id, rootDir, suggestInstruction);
      setSuggestedRows(rows);
      setSaveMsg("LLM draft ready, confirm apply");
      setLlmStatus("draft ready, waiting confirm");
    } catch (err: any) {
      setSaveMsg(err.message || "LLM failed");
      setLlmStatus(`LLM failed: ${err.message || ""}`);
    } finally {
      setSuggestLoading(false);
    }
  };

  const acceptSuggest = () => {
    if (!suggestedRows) return;
    setGridDraft(suggestedRows);
    setGridDirty(true);
    setSuggestedRows(null);
    setSaveMsg("LLM applied, please save");
    setLlmStatus("draft applied, remember to save");
  };

  const rejectSuggest = () => {
    setSuggestedRows(null);
    setSaveMsg("LLM draft rejected");
    setLlmStatus("draft rejected");
  };

  const saveConfig = async () => {
    try {
      await updateConfig({ root_dir: rootDir, openai_base_url: baseUrl, openai_api_key: apiKey || undefined });
    
      setApiKeySet(Boolean(apiKey));
      setApiKey("");
      setSaveMsg("config saved");
    } catch (err: any) {
      setSaveMsg(err.message || "config save failed");
    }
  };

  const isYCol = (col: number) => Boolean(skeletonDraft?.y_columns.find((c) => c.col === col));
  const yCol = (col: number) => skeletonDraft?.y_columns.find((c) => c.col === col);
  const xRow = (row: number) => skeletonDraft?.x_rows.find((r) => r.row === row);
  const isFERow = (row: number) => Boolean(skeletonDraft?.fe_rows.find((r) => r.row === row));
  const isObsRow = (row: number) => Boolean(skeletonDraft?.obs_rows.find((r) => r.row === row));

  const saving = savingCsv || savingSkeleton;

  return (
    <div className="page" onClick={() => setMenu(null)}>
      <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h1 style={{ margin: 0 }}>Econ Table Annotator</h1>
        <div style={{ color: "#374151" }}>Local annotator: left image, right CSV/Skeleton.</div>
      </header>

      <div className="card">
        <div className="row" style={{ alignItems: "center" }}>
          <input
            className="input"
            placeholder="root_dir (csv / images / skeleton)"
            value={rootDir}
            onChange={(e) => setRootDir(e.target.value)}
          />
          <input
            className="input"
            placeholder="OpenAI Base URL (optional)"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
          {!apiKeySet && (
            <input
              className="input"
              placeholder="OpenAI API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          )}
          <button className="button secondary" onClick={saveConfig}>
            save config
          </button>
          {apiKeySet && (
            <button
              className="button secondary"
              onClick={() => {
                setApiKey("");
                setApiKeySet(false);
                updateConfig({ openai_api_key: "" });
              }}
            >
              forget API Key
            </button>
          )}
          <button className="button" onClick={loadProjects} disabled={loading}>
            {loading ? "loading..." : "load projects"}
          </button>
        </div>
        {error && <div style={{ color: "#b91c1c", marginTop: 6 }}>{error}</div>}
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Projects</div>
        <div className="grid-preview" style={{ maxHeight: 280 }}>
          <table className="table">
            <thead>
              <tr>
                <th>paper_id</th>
                <th>table_id</th>
                <th>csv</th>
                <th>status</th>
                <th>actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedProjects.map((item) => (
                <tr key={`${item.paper_id}-${item.table_id}`}>
                  <td>{item.paper_id}</td>
                  <td>{item.table_id}</td>
                  <td>{item.csv_path}</td>
                  <td>{statusBadge(item.status)}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <button
                        className="button secondary"
                        onClick={() => {
                          openDetail(item).then(() => setEditMode(true));
                        }}
                      >
                        edit
                      </button>
                      <button
                        className="button secondary"
                        onClick={() => {
                          openDetail(item).then(() => setEditMode(false));
                        }}
                      >
                        view
                      </button>
                      <button
                        className="button secondary"
                        onClick={() => {
                          if (detail && item.paper_id === detail.info.paper_id && item.table_id === detail.info.table_id) {
                            updateStatusOnly("done");
                          } else {
                            openDetail(item).then(() => updateStatusOnly("done"));
                          }
                        }}
                      >
                        mark done
                      </button>
                      <button
                        className="button secondary"
                        onClick={() => {
                          if (detail && item.paper_id === detail.info.paper_id && item.table_id === detail.info.table_id) {
                            updateStatusOnly("in_progress");
                          } else {
                            openDetail(item).then(() => updateStatusOnly("in_progress"));
                          }
                        }}
                      >
                        mark in-progress
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="card">
          <div className="row" style={{ alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {selected.paper_id} / {selected.table_id}
            </div>
            <div>{statusBadge(selected.status)}</div>
            <div style={{ flex: 1 }} />
            {detail && (
              <div className="row" style={{ gap: 8 }}>
                <button className="button secondary" onClick={() => setEditMode((v) => !v)}>
                  {editMode ? "switch to preview" : "edit"}
                </button>
                <button className="button secondary" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>
                  zoom out
                </button>
                <button className="button secondary" onClick={() => setZoom((z) => z + 0.1)}>
                  zoom in
                </button>
                <button className="button secondary" onClick={() => setShowImageModal(true)}>
                  open full image
                </button>
              </div>
            )}
          </div>

          {detailError && <div style={{ color: "#b91c1c" }}>{detailError}</div>}

          {detail ? (
            <div className="row edit-shell vertical" style={{ alignItems: "stretch" }}>
              <div className="status-rail">
                <div style={{ fontWeight: 700, marginBottom: 8 }}>All tables</div>
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

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="image-panel">
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Image</div>
                  {imageSrc ? (
                    <div className="image-container">
                      <img className="image-preview" style={{ transform: `scale(${zoom})` }} src={imageSrc} alt="table" />
                    </div>
                  ) : (
                    <div style={{ color: "#d97706" }}>No image found</div>
                  )}
                </div>

                <div className="edit-panel">
                  {editMode ? (
                    <>
                      <div className="grid-preview" style={{ maxHeight: 520 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Editable CSV + annotations</div>
                        <div
                          className="table-scroll"
                          ref={editScroll.ref}
                          onMouseDown={editScroll.onMouseDown}
                          onMouseMove={editScroll.onMouseMove}
                          onMouseUp={editScroll.onMouseUp}
                          onMouseLeave={editScroll.onMouseLeave}
                        >
                          <table className="table annotate-table">
                            <thead>
                              <tr>
                                {detail.grid.header.map((_, idx) => {
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
                                      title={idx === 0 ? "row" : "Toggle Y column; right-click insert"}
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
                                            <button className="gap-add danger" onClick={() => removeRow(ridx)} title="delete row">
                                              -
                                            </button>
                                            <button
                                              className={`mini-btn ${x ? "active" : ""}`}
                                              onClick={() => toggleXRow(rowId, row[1] || "")}
                                              title="mark as X row"
                                            >
                                              X
                                            </button>
                                            <button
                                              className={`mini-btn ${isCore ? "active core" : ""}`}
                                              onClick={() => setCoreRow(rowId, row[1] || "")}
                                              title="mark as core X"
                                            >
                                              core
                                            </button>
                                            <button
                                              className={`mini-btn ${fe ? "active" : ""}`}
                                              onClick={() => toggleFERow(rowId, row[1] || "FE")}
                                              title="mark as FE row"
                                            >
                                              FE
                                            </button>
                                            <button
                                              className={`mini-btn ${obs ? "active" : ""}`}
                                              onClick={() => toggleObsRow(rowId, row[1] || "N")}
                                              title="mark as N/Obs row"
                                            >
                                              N
                                            </button>
                                            <button className="gap-add" onClick={() => insertRowAt(ridx + 1)} title="insert below">
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
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>X rows detail</div>
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
                              <option value="key">key(core)</option>
                              <option value="control">control</option>
                              <option value="interaction">interaction</option>
                              <option value="other">other</option>
                            </select>
                          </div>
                        ))}
                      </div>

                      <div className="card" style={{ marginTop: 10 }}>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>Y columns</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {detail.grid.header
                            .map((_, idx) => idx)
                            .filter((idx) => idx > 0)
                            .map((idx) => {
                              const active = isYCol(idx);
                              return (
                                <div className="row" key={idx} style={{ alignItems: "flex-start", gap: 8 }}>
                                  <label style={{ minWidth: 60 }}>
                                    <input
                                      type="checkbox"
                                      checked={active}
                                      onChange={() => toggleYCol(idx)}
                                      style={{ marginRight: 6 }}
                                    />
                                    col c{idx}
                                  </label>
                                  {active && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                      <input
                                        className="input slim"
                                        placeholder="depvar_label"
                                        value={yCol(idx)?.depvar_label || ""}
                                        onChange={(e) => updateYField(idx, "depvar_label", e.target.value)}
                                      />
                                      <input
                                        className="input slim"
                                        placeholder="data_var_name"
                                        value={yCol(idx)?.depvar_data_name || ""}
                                        onChange={(e) => updateYField(idx, "depvar_data_name", e.target.value)}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>

                      {suggestedRows && (
                        <div className="card" style={{ marginTop: 10 }}>
                          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ fontWeight: 700 }}>LLM draft (not applied)</div>
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
                            {saving ? "saving..." : "save all"}
                          </button>
                          <button className="button big secondary" onClick={() => saveAll(true)} disabled={saving}>
                            {saving ? "saving..." : "save & next"}
                          </button>
                          <button className="button secondary" onClick={() => updateStatusOnly("done")} disabled={saving}>
                            mark done
                          </button>
                          <button className="button secondary" onClick={() => updateStatusOnly("in_progress")} disabled={saving}>
                            mark in-progress
                          </button>
                          <input
                            className="input slim"
                            style={{ minWidth: 200 }}
                            placeholder="extra instructions to LLM (optional)"
                            value={suggestInstruction}
                            onChange={(e) => setSuggestInstruction(e.target.value)}
                          />
                          <button className="button secondary" onClick={runSuggest} disabled={suggestLoading}>
                            {suggestLoading ? "LLM generating..." : "LLM autofill"}
                          </button>
                          {saveMsg && <span style={{ color: "#0f5132" }}>{saveMsg}</span>}
                          {llmStatus && <span style={{ color: "#b45309" }}>{llmStatus}</span>}
                        </div>
                      </div>

                      <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
                        <div style={{ fontWeight: 700 }}>Bracket type</div>
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
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>CSV preview</div>
                        <div
                          className="table-scroll"
                          ref={previewScroll.ref}
                          onMouseDown={previewScroll.onMouseDown}
                          onMouseMove={previewScroll.onMouseMove}
                          onMouseUp={previewScroll.onMouseUp}
                          onMouseLeave={previewScroll.onMouseLeave}
                        >
                          <table className="table">
                            <thead>
                              <tr>
                                {detail.grid.header.map((_, idx) => (
                                  <th key={idx}>{idx === 0 ? "row" : `c${idx}`}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {detail.grid.rows.slice(0, 8).map((row, ridx) => {
                                const rowId = getRowId(row, ridx);
                                const isX = detail.skeleton.x_rows.some((r) => r.row === rowId);
                                const isFE = detail.skeleton.fe_rows.some((r) => r.row === rowId);
                                const isObs = detail.skeleton.obs_rows.some((r) => r.row === rowId);
                                const rowClass = isX ? "preview-x" : isFE ? "preview-fe" : isObs ? "preview-obs" : "";
                                return (
                                  <tr key={ridx} className={rowClass}>
                                    {row.map((cell, cidx) => (
                                      <td key={cidx}>{cell}</td>
                                    ))}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>
                        Skeleton status: {detail.skeleton.status} | default bracket: {detail.skeleton.bracket_type_default}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 2, minWidth: 400 }}>loading detail...</div>
          )}
        </div>
      )}

      {showImageModal && (
        <div className="modal-backdrop" onClick={() => setShowImageModal(false)}>
          <div className="modal-body" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>Image preview</div>
              <button className="button secondary" onClick={() => setShowImageModal(false)}>
                close
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
              <div onClick={() => { insertColumnAt(menu.index); setMenu(null); }}>insert left</div>
              <div onClick={() => { insertColumnAt(menu.index + 1); setMenu(null); }}>insert right</div>
            </>
          ) : (
            <>
              <div onClick={() => { insertRowAt(menu.index); setMenu(null); }}>insert above</div>
              <div onClick={() => { insertRowAt(menu.index + 1); setMenu(null); }}>insert below</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
