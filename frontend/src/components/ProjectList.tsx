import React, { useMemo, useState } from "react";
import StatusBadge from "./StatusBadge";
import { TableListItem } from "../api";

type Props = {
  projects: TableListItem[];
  onEdit: (item: TableListItem) => void;
  onView: (item: TableListItem) => void;
  onMarkDone: (item: TableListItem) => void;
  onMarkInProgress: (item: TableListItem) => void;
};

const PAGE_SIZE = 20;

const ProjectList = ({ projects, onEdit, onView, onMarkDone, onMarkInProgress }: Props) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return projects.slice(start, start + PAGE_SIZE);
  }, [page, projects]);

  const showWp = (id?: string) => id?.toLowerCase().includes("_wp");

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 8 }}>项目列表</div>
      <div className="grid-preview" style={{ maxHeight: 360 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: "24%" }}>paper_id</th>
              <th style={{ width: "24%" }}>table_id / panel</th>
              <th style={{ width: "16%" }}>状态</th>
              <th style={{ width: "36%" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item) => (
              <tr key={`${item.paper_id}-${item.table_id}`}>
                <td>{item.paper_id}</td>
                <td>
                  {item.table_id}
                  {showWp(item.table_id) ? (
                    <span className="pill info" style={{ marginLeft: 6 }}>
                      wp
                    </span>
                  ) : null}
                </td>
                <td>
                  <StatusBadge status={item.status} />
                </td>
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                    <button className="button secondary" onClick={() => onEdit(item)}>
                      进入编辑
                    </button>
                    <button className="button secondary" onClick={() => onView(item)}>
                      仅预览
                    </button>
                    <button className="button secondary" onClick={() => onMarkDone(item)}>
                      标记完成
                    </button>
                    <button className="button secondary" onClick={() => onMarkInProgress(item)}>
                      标记未完成
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: 12 }}>
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
        <div>
          共 {projects.length} 条 · 第 {page}/{totalPages} 页
        </div>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <button className="button secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            上一页
          </button>
          <button
            className="button secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectList;
