import StatusBadge from "./StatusBadge";
import { TableListItem } from "../api";

type Props = {
  projects: TableListItem[];
  onEdit: (item: TableListItem) => void;
  onView: (item: TableListItem) => void;
  onMarkDone: (item: TableListItem) => void;
  onMarkInProgress: (item: TableListItem) => void;
};

const ProjectList = ({ projects, onEdit, onView, onMarkDone, onMarkInProgress }: Props) => (
  <div className="card">
    <div style={{ fontWeight: 700, marginBottom: 8 }}>项目列表</div>
    <div className="grid-preview" style={{ maxHeight: 280 }}>
      <table className="table">
        <thead>
          <tr>
            <th>paper_id</th>
            <th>table_id</th>
            <th>csv</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((item) => (
            <tr key={`${item.paper_id}-${item.table_id}`}>
              <td>{item.paper_id}</td>
              <td>{item.table_id}</td>
              <td>{item.csv_path}</td>
              <td>
                <StatusBadge status={item.status} />
              </td>
              <td>
                <div className="row" style={{ gap: 6 }}>
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
        </tbody>
      </table>
    </div>
  </div>
);

export default ProjectList;
