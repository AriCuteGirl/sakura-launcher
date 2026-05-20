import { getCurrentWindow, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";

type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const EDGE_SIZE = 6;
const CORNER_SIZE = 12;

export default function ResizeHandles() {
  const initialMousePos = useRef({ x: 0, y: 0 });
  const initialWinSize = useRef({ w: 0, h: 0 });
  const initialWinPos = useRef({ x: 0, y: 0 });
  const edge = useRef<Edge | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const onMouseMove = async (e: MouseEvent) => {
      if (!dragging.current || !edge.current) return;
      const win = getCurrentWindow();
      const dx = e.screenX - initialMousePos.current.x;
      const dy = e.screenY - initialMousePos.current.y;
      const ed = edge.current;

      let newW = initialWinSize.current.w;
      let newH = initialWinSize.current.h;
      let newX = initialWinPos.current.x;
      let newY = initialWinPos.current.y;

      if (ed.includes("e")) newW = Math.max(900, initialWinSize.current.w + dx);
      if (ed.includes("s")) newH = Math.max(650, initialWinSize.current.h + dy);
      if (ed.includes("w")) {
        const w = Math.max(900, initialWinSize.current.w - dx);
        newW = w;
        newX = initialWinPos.current.x + (initialWinSize.current.w - w);
      }
      if (ed.includes("n")) {
        const h = Math.max(650, initialWinSize.current.h - dy);
        newH = h;
        newY = initialWinPos.current.y + (initialWinSize.current.h - h);
      }

      await win.setSize(new PhysicalSize(newW, newH));
      if (ed.includes("n") || ed.includes("w")) {
        await win.setPosition(new PhysicalPosition(newX, newY));
      }
    };

    const onMouseUp = () => { dragging.current = false; };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const startResize = (ed: Edge) => async (e: React.MouseEvent) => {
    e.preventDefault();
    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    const size = await win.outerSize();
    initialMousePos.current = { x: e.screenX, y: e.screenY };
    initialWinSize.current = { w: size.width, h: size.height };
    initialWinPos.current = { x: pos.x, y: pos.y };
    edge.current = ed;
    dragging.current = true;
  };

  const common = "fixed z-50";

  return (
    <>
      {/* Top */}
      <div
        className={`${common} top-0 left-[12px] right-[12px] h-[${EDGE_SIZE}px] cursor-n-resize`}
        onMouseDown={startResize("n")}
      />
      {/* Bottom */}
      <div
        className={`${common} bottom-0 left-[12px] right-[12px] h-[${EDGE_SIZE}px] cursor-s-resize`}
        onMouseDown={startResize("s")}
      />
      {/* Left */}
      <div
        className={`${common} top-[12px] bottom-[12px] left-0 w-[${EDGE_SIZE}px] cursor-w-resize`}
        onMouseDown={startResize("w")}
      />
      {/* Right */}
      <div
        className={`${common} top-[12px] bottom-[12px] right-0 w-[${EDGE_SIZE}px] cursor-e-resize`}
        onMouseDown={startResize("e")}
      />
      {/* Corners */}
      <div className={`${common} top-0 left-0 w-[${CORNER_SIZE}px] h-[${CORNER_SIZE}px] cursor-nw-resize`} onMouseDown={startResize("nw")} />
      <div className={`${common} top-0 right-0 w-[${CORNER_SIZE}px] h-[${CORNER_SIZE}px] cursor-ne-resize`} onMouseDown={startResize("ne")} />
      <div className={`${common} bottom-0 left-0 w-[${CORNER_SIZE}px] h-[${CORNER_SIZE}px] cursor-sw-resize`} onMouseDown={startResize("sw")} />
      <div className={`${common} bottom-0 right-0 w-[${CORNER_SIZE}px] h-[${CORNER_SIZE}px] cursor-se-resize`} onMouseDown={startResize("se")} />
    </>
  );
}
