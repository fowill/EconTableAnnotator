type Props = {
  imageSrc: string;
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onOpenModal: () => void;
};

const ImagePanel = ({ imageSrc, zoom, onZoomOut, onZoomIn, onOpenModal }: Props) => (
  <div className="image-panel">
    <div style={{ fontWeight: 700, marginBottom: 6 }}>图片预览</div>
    {imageSrc ? (
      <div
        className="image-container"
        style={{
          overflow: "auto",
          maxWidth: "100%",
          maxHeight: 480,
          border: "1px solid #e5e7eb",
          borderRadius: 6,
        }}
      >
        <img
          className="image-preview"
          style={{
            width: "100%",
            height: "auto",
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            display: "block",
          }}
          src={imageSrc}
          alt="table"
        />
      </div>
    ) : (
      <div style={{ color: "#d97706" }}>未找到图片</div>
    )}
    <div className="row" style={{ gap: 8 }}>
      <button className="button secondary" onClick={onZoomOut}>
        缩小
      </button>
      <button className="button secondary" onClick={onZoomIn}>
        放大
      </button>
      <button className="button secondary" onClick={onOpenModal}>
        打开大图
      </button>
    </div>
  </div>
);

export default ImagePanel;
