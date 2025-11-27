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
      <div className="image-container">
        <img className="image-preview" style={{ transform: `scale(${zoom})` }} src={imageSrc} alt="table" />
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
