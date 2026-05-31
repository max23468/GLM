import { useEffect, useRef, useState, type PointerEvent } from "react";

type DragPreview = {
  title: string;
  detail?: string;
  x: number;
  y: number;
  width: number;
};

type DragItem = {
  id: string;
  title: string;
  detail?: string;
};

export const useSortableDrag = (onReorder: (sourceId: string, targetId: string) => void) => {
  const [draggedId, setDraggedId] = useState<string>();
  const [dropTargetId, setDropTargetId] = useState<string>();
  const [preview, setPreview] = useState<DragPreview>();
  const dragRef = useRef<{ sourceId?: string; targetId?: string }>({});

  useEffect(() => {
    if (!draggedId) return undefined;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const targetRow = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-sortable-row]");
      const targetId = targetRow?.dataset.sortableId;
      if (targetId && targetId !== dragRef.current.sourceId && targetId !== dragRef.current.targetId) {
        dragRef.current.targetId = targetId;
        setDropTargetId(targetId);
      }
      setPreview((current) => current ? { ...current, x: event.clientX, y: event.clientY } : current);
    };

    const handlePointerUp = () => {
      const { sourceId, targetId } = dragRef.current;
      if (sourceId && targetId && sourceId !== targetId) onReorder(sourceId, targetId);
      dragRef.current = {};
      setDraggedId(undefined);
      setDropTargetId(undefined);
      setPreview(undefined);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggedId, onReorder]);

  const startDrag = (event: PointerEvent<HTMLElement>, item: DragItem) => {
    const row = event.currentTarget.closest<HTMLElement>("[data-sortable-row]");
    const rect = row?.getBoundingClientRect();
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { sourceId: item.id };
    setDraggedId(item.id);
    setDropTargetId(undefined);
    setPreview({
      title: item.title,
      detail: item.detail,
      x: event.clientX,
      y: event.clientY,
      width: Math.min(rect?.width ?? 240, 320),
    });
  };

  const markDropTarget = (itemId: string) => {
    if (!dragRef.current.sourceId || dragRef.current.sourceId === itemId) return;
    dragRef.current.targetId = itemId;
    setDropTargetId(itemId);
  };

  return {
    draggedId,
    dropTargetId,
    preview,
    startDrag,
    markDropTarget,
  };
};
