import React, { useState } from "react";
import useDragScroll from "../hooks/useDragScroll";
import { PaperContext, SkeletonModel, TableDetail } from "../api";

type XRow = SkeletonModel["x_rows"][number];
type YCol = SkeletonModel["y_columns"][number];
type MenuState = { type: "row" | "col"; index: number; x: number; y: number } | null;

type Props = {
  detail: TableDetail;
  gridDraft: string[][];
  editMode: boolean;
  onCellChange: (r: number, c: number, val: string) => void;
  getRowId: (row: string[], idx: number) => number;
  removeRow: (ridx: number) => void;
  insertRowAt: (idx: number) => void;
  removeColumn: (idx: number) => void;
  insertColumnAt: (idx: number) => void;
  updateXField: (row: number, key: keyof XRow, value: string) => void;
  isYCol: (col: number) => boolean;
  yCol: (col: number) => YCol | undefined;
  toggleYCol: (col: number) => void;
  updateYField: (col: number, key: keyof YCol, value: string) => void;
  xRow: (row: number) => XRow | undefined;
  isFERow: (row: number) => boolean;
  isObsRow: (row: number) => boolean;
  setCoreRow: (row: number, label: string) => void;
  toggleXRow: (row: number, label: string) => void;
  toggleFERow: (row: number, label: string) => void;
  toggleObsRow: (row: number, label: string) => void;
  suggestedRows: string[][] | null;
  acceptSuggest: () => void;
  rejectSuggest: () => void;
  skeletonDraft: SkeletonModel | null;
  updateSkeleton: (u: (s: SkeletonModel) => SkeletonModel) => void;
  paperContext: PaperContext | null;
  onRefreshColumns: () => void;
  docUrlBuilder: (relPath: string) => string;
};

const EditTable = ({
  detail,
  gridDraft,
  editMode,
  onCellChange,
  getRowId,
  removeRow,
  insertRowAt,
  removeColumn,
  insertColumnAt,
  updateXField,
  isYCol,
  yCol,
  toggleYCol,
  updateYField,
  xRow,
  isFERow,
  isObsRow,
  setCoreRow,
  toggleXRow,
  toggleFERow,
  toggleObsRow,
  suggestedRows,
  acceptSuggest,
  rejectSuggest,
  skeletonDraft,
  updateSkeleton,
  paperContext,
  onRefreshColumns,
  docUrlBuilder
}: Props) => {
  const editScroll = useDragScroll();
  const previewScroll = useDragScroll();
  const [menu, setMenu] = useState<MenuState>(null);

  const headerCells = detail.grid.header.map((_, idx) => {
    const isRowCol = idx === 0;
    const isLabelCol = idx === 1;
    const isDataCol = idx > 1;
    const colNum = idx - 1; // c1 starts at header index 2
    const displayName = isRowCol ? "row" : isLabelCol ? "label" : `c${colNum}`;
    const active = isDataCol && isYCol(colNum);
    return (
      <th
        key={idx}
        className={active ? "highlight" : ""}
        onClick={() => {
          if (isDataCol) toggleYCol(colNum);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!isDataCol) return;
          setMenu({ type: "col", index: idx, x: e.clientX, y: e.clientY });
        }}
        title={isDataCol ? "点击切换 Y 列 / 右键插入/删除" : undefined}
      >
        <div className="col-header">
          {isDataCol && (
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
          {isDataCol && (
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
  });

  const bracketOptions = ["t_stat", "std_err", "p_value", "unknown"] as const;

  return (
    <>
      {editMode ? (
        <>
          <div className="grid-preview" style={{ maxHeight: 520 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>可编辑 CSV + 点选标注</div>
            <div
              className="table-scroll"
              style={{ overflowX: "auto", overflowY: "auto", cursor: editScroll.isDragging ? "grabbing" : "default" }}
              ref={editScroll.ref}
              onMouseDown={editScroll.onMouseDown}
              onMouseMove={editScroll.onMouseMove}
              onMouseUp={editScroll.onMouseUp}
              onMouseLeave={editScroll.onMouseLeave}
            >
              <table className="table annotate-table" style={{ width: "max-content", minWidth: "100%" }}>
                <thead>
                  <tr>{headerCells}</tr>
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
                                <button className="gap-add danger" onClick={() => removeRow(ridx)} title="删除行">
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
                                  title="标注为 N 行"
                                >
                                  N
                                </button>
                                <button className="gap-add" onClick={() => insertRowAt(ridx + 1)} title="在下方插入行">
                                  +
                                </button>
                              </div>
                            ) : (
                              <input
                                className="cell-input"
                                style={{ width: cidx === 1 ? 220 : 90, minWidth: cidx === 1 ? 200 : 80 }}
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

          {suggestedRows && (
            <div className="card" style={{ marginTop: 10 }}>
              <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700 }}>LLM 建议（未应用）</div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="button secondary" onClick={acceptSuggest}>
                    应用
                  </button>
                  <button className="button secondary" onClick={rejectSuggest}>
                    拒绝
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

          <div className="card" style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>括号含义</div>
            {bracketOptions.map((opt) => (
              <label key={opt} style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 8 }}>
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

          {paperContext && (
            <div className="card" style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>参考信息</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div
                  style={{
                    flex: "1 1 260px",
                    maxHeight: 180,
                    overflow: "auto",
                    border: "1px solid #e5e7eb",
                    padding: 8,
                    borderRadius: 6
                  }}
                >
                  {paperContext.columns.length === 0 ? (
                    <div style={{ color: "#6b7280" }}>无列名</div>
                  ) : (
                    paperContext.columns.map((c, i) => (
                      <div key={i} style={{ fontFamily: "monospace", fontSize: 12, marginBottom: 2 }}>
                        {c}
                      </div>
                    ))
                  )}
                </div>
                <div
                  style={{
                    flex: 1,
                    background: "#f9fafb",
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    minHeight: 120
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>数据列名</span>
                    <button className="button secondary" onClick={onRefreshColumns} style={{ padding: "2px 8px" }}>
                      {paperContext.columns.length === 0 ? "获取列名" : "重新获取"}
                    </button>
                  </div>
                  {paperContext.columns.length === 0 ? (
                    <div style={{ color: "#6b7280" }}>无列名</div>
                  ) : (
                    paperContext.columns.map((c, i) => (
                      <div key={i} style={{ fontFamily: "monospace", fontSize: 12, marginBottom: 2 }}>
                        {c}
                      </div>
                    ))
                  )}
                </div>
                <div style={{ flex: "0 0 200px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontWeight: 600 }}>论文 PDF</div>
                  {paperContext.pdfs.map((p, idx) => (
                    <a key={idx} className="button secondary" href={docUrlBuilder(p)} target="_blank" rel="noreferrer">
                      打开 {p}
                    </a>
                  ))}
                  {paperContext.pdfs.length === 0 && <div style={{ color: "#6b7280" }}>未找到</div>}
                  <div style={{ fontWeight: 600, marginTop: 8 }}>代码文档</div>
                  {paperContext.code_docs.map((p, idx) => (
                    <a key={idx} className="button secondary" href={docUrlBuilder(p)} target="_blank" rel="noreferrer">
                      打开 {p}
                    </a>
                  ))}
                  {paperContext.code_docs.length === 0 && <div style={{ color: "#6b7280" }}>未找到</div>}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="grid-preview">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>CSV 预览</div>
          <div
            className="table-scroll"
            style={{ overflowX: "auto", overflowY: "auto", cursor: previewScroll.isDragging ? "grabbing" : "default" }}
            ref={previewScroll.ref}
            onMouseDown={previewScroll.onMouseDown}
            onMouseMove={previewScroll.onMouseMove}
            onMouseUp={previewScroll.onMouseUp}
            onMouseLeave={previewScroll.onMouseLeave}
          >
            <table className="table" style={{ width: "max-content", minWidth: "100%" }}>
              <thead>
                <tr>
                  {detail.grid.header.map((_, idx) => (
                    <th key={idx}>{idx === 0 ? "row" : idx === 1 ? "label" : `c${idx - 1}`}</th>
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
      )}

      {menu && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          {menu.type === "col" ? (
            <>
              <div
                onClick={() => {
                  insertColumnAt(menu.index);
                  setMenu(null);
                }}
              >
                在当前列左侧插入
              </div>
              <div
                onClick={() => {
                  insertColumnAt(menu.index + 1);
                  setMenu(null);
                }}
              >
                在当前列右侧插入
              </div>
            </>
          ) : (
            <>
              <div
                onClick={() => {
                  insertRowAt(menu.index);
                  setMenu(null);
                }}
              >
                在当前行上方插入
              </div>
              <div
                onClick={() => {
                  insertRowAt(menu.index + 1);
                  setMenu(null);
                }}
              >
                在当前行下方插入
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default EditTable;
