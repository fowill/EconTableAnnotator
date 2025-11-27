import StatusBadge from "./StatusBadge";
import { TableListItem } from "../api";

type Props = {
  projects: TableListItem[];
  selected: TableListItem | null;
  onJump: (item: TableListItem) => void;
};

const StatusRail = ({ projects, selected, onJump }: Props) => (
  <div className="status-rail">
    <div style={{ fontWeight: 700, marginBottom: 8 }}>所有表</div>
    <div className="status-list">
      {projects.map((p) => (
        <div
          key={`${p.paper_id}-${p.table_id}`}
          className={`status-item ${selected?.paper_id === p.paper_id && selected?.table_id === p.table_id ? "active" : ""}`}
          onClick={() => onJump(p)}
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
);

export default StatusRail;
