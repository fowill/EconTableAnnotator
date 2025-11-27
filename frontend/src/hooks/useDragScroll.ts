import { useRef } from "react";

const useDragScroll = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 });

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input,textarea,button,select,option,button")) return;
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

export default useDragScroll;
