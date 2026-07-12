import { useEffect, useRef, useState } from "react";

export function ResizeHandle({
  direction,
  onResize,
  className = "",
}: {
  direction: "horizontal" | "vertical";
  onResize: (delta: number) => void;
  className?: string;
}) {
  const [active, setActive] = useState(false);
  const startRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!active) return;

    const onMove = (event: MouseEvent) => {
      const delta =
        direction === "horizontal"
          ? startRef.current.x - event.clientX
          : startRef.current.y - event.clientY;
      onResize(delta);
      startRef.current = { x: event.clientX, y: event.clientY };
    };

    const onUp = () => setActive(false);

    document.body.style.cursor =
      direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [active, direction, onResize]);

  return (
    <div
      role="separator"
      aria-orientation={direction === "horizontal" ? "vertical" : "horizontal"}
      onMouseDown={(event) => {
        startRef.current = { x: event.clientX, y: event.clientY };
        setActive(true);
      }}
      className={`group flex-shrink-0 touch-none flex items-center justify-center ${
        direction === "horizontal"
          ? "w-2 self-stretch min-h-0 cursor-col-resize hover:bg-[#4ca3ff]/20"
          : "h-2 w-full cursor-row-resize hover:bg-[#4ca3ff]/20"
      } ${active ? "bg-[#4ca3ff]/30" : "bg-transparent"} transition-colors ${className}`}
    >
      <div
        className={`rounded-full bg-[#2a2a3c] transition-all group-hover:bg-[#4ca3ff]/50 ${
          direction === "horizontal" ? "w-px h-full min-h-[48px]" : "h-px w-10"
        } ${active ? "bg-[#4ca3ff]/70" : ""}`}
      />
    </div>
  );
}