type Props = { status: string };

const StatusBadge = ({ status }: Props) => {
  const normalized = status?.toLowerCase();
  if (normalized === "done") return <span className="badge green">完成</span>;
  if (normalized === "in_progress") return <span className="badge amber">进行中</span>;
  return <span className="badge gray">未开始</span>;
};

export default StatusBadge;
