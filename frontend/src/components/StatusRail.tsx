import React from "react";
import { TableListItem } from "../api";

type Props = {
  projects: TableListItem[];
  selected: TableListItem | null;
  onJump: (item: TableListItem) => void;
};

// 简化：仅展示标题，不列出所有表
const StatusRail = (_props: Props) => (
  <div className="status-rail">
    <div style={{ fontWeight: 700, marginBottom: 8 }}>所有表</div>
  </div>
);

export default StatusRail;
