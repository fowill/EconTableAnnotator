import React, { useState } from "react";
import useDragScroll from "../hooks/useDragScroll";
import { SkeletonModel, TableDetail } from "../api";

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
  updateSkeleton
}: Props) => {
  const editScroll = useDragScroll();
  const previewScroll = useDragScroll();
  const [menu, setMenu] = useState<MenuState>(null);

  const headerCells = detail.grid.header.map((_, idx) => {
    const isRowCol = idx === 0;
    const isLabelCol = idx === 1;
    const isDataCol = idx > 1; // numeric columns start after label
    const colNum = idx - 1; // c1 corresponds to idx=2
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
        title={idx === 0 ? "行号" : "点击标注/取消 Y 列，右键插入列"}
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

  return (
    <>
      {editMode ? (
        <>
          <div className="grid-preview" style={{ maxHeight: 520 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>可编辑 CSV + 点选标注</div>
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
                                  title="标注为 N/观测行"
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
                <select className="input slim" value={r.role} onChange={(e) => updateXField(r.row, "role", e.target.value)}>
                  <option value="key">核心</option>
                  <option value="control">控制变量</option>
                  <option value="interaction">交互项</option>
                  <option value="other">其他</option>
                </select>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Y 列标注</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {detail.grid.header
                .map((_, idx) => idx)
              .filter((idx) => idx > 1)
              .map((idx) => {
                const colNum = idx - 1;
                const active = isYCol(colNum);
                  return (
                    <div className="row" key={idx} style={{ alignItems: "flex-start", gap: 8 }}>
                      <label style={{ minWidth: 60 }}>
                        <input type="checkbox" checked={active} onChange={() => toggleYCol(colNum)} style={{ marginRight: 6 }} />
                        列 c{colNum}
                      </label>
                      {active && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <input
                            className="input slim"
                            placeholder="depvar_label（表格列名）"
                            value={yCol(colNum)?.depvar_label || ""}
                            onChange={(e) => updateYField(colNum, "depvar_label", e.target.value)}
                          />
                          <input
                            className="input slim"
                            placeholder="data_var_name（数据字段）"
                            value={yCol(colNum)?.depvar_data_name || ""}
                            onChange={(e) => updateYField(colNum, "depvar_data_name", e.target.value)}
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
                <div style={{ fontWeight: 700 }}>LLM 草稿（未应用）</div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="button secondary" onClick={acceptSuggest}>
                    接受
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
        <div className="grid-preview">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>CSV 预览</div>
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
