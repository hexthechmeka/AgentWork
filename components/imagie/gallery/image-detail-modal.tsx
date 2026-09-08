"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ImagieImage } from "@/lib/db/schema";

const MIN_SCALE = 1;
const MAX_SCALE = 6;

// Full-screen lightbox with wheel-zoom / drag-pan, ← → to move through the
// (already filtered) folder list, and reuse / delete actions.
export function ImageDetailModal({
  image,
  index,
  total,
  onClose,
  onPrev,
  onNext,
  onReuse,
  onDelete,
}: {
  image: ImagieImage | null;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReuse: (img: ImagieImage) => void;
  onDelete: (id: string) => void;
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showMeta, setShowMeta] = useState(true);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null
  );

  const reset = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // reset transform whenever the shown image changes
  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    if (!image) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        onPrev();
      } else if (e.key === "ArrowRight") {
        onNext();
      } else if (e.key === "+" || e.key === "=") {
        setScale((s) => Math.min(MAX_SCALE, s + 0.5));
      } else if (e.key === "-") {
        setScale((s) => Math.max(MIN_SCALE, s - 0.5));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [image, onClose, onPrev, onNext]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => {
      const next = e.deltaY < 0 ? s * 1.2 : s / 1.2;
      return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    });
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (scale <= 1) {
        return;
      }
      drag.current = { px: pan.x, py: pan.y, x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [scale, pan]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) {
      return;
    }
    setPan({
      x: drag.current.px + (e.clientX - drag.current.x),
      y: drag.current.py + (e.clientY - drag.current.y),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  if (!image) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-2 text-white">
        <span className="text-[13px] text-white/70">
          {index + 1} / {total}
        </span>
        <div className="flex items-center gap-2">
          <Button
            className="text-white hover:bg-white/10"
            onClick={() => setShowMeta((v) => !v)}
            size="sm"
            variant="ghost"
          >
            {showMeta ? "정보 숨기기" : "정보"}
          </Button>
          <Button
            className="text-white hover:bg-white/10"
            onClick={() => onReuse(image)}
            size="sm"
            variant="ghost"
          >
            <RefreshCwIcon className="size-3.5" />이 설정으로 다시 생성
          </Button>
          <Button
            className="text-white hover:bg-white/10"
            onClick={() => onDelete(image.id)}
            size="sm"
            variant="ghost"
          >
            <Trash2Icon className="size-3.5 text-red-400" />
            삭제
          </Button>
          <button
            aria-label="닫기"
            className="rounded-md p-1.5 text-white hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            <XIcon className="size-5" />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <button
          aria-label="이전"
          className="-translate-y-1/2 absolute top-1/2 left-3 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          onClick={onPrev}
          type="button"
        >
          <ChevronLeftIcon className="size-5" />
        </button>

        <button
          className="flex flex-1 items-center justify-center overflow-hidden"
          onDoubleClick={reset}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          style={{ cursor: scale > 1 ? "grab" : "default" }}
          type="button"
        >
          {/* biome-ignore lint/performance/noImgElement: full blob image */}
          <img
            alt=""
            className="max-h-full max-w-full select-none object-contain"
            draggable={false}
            src={image.blobUrl}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transition: drag.current ? "none" : "transform 120ms",
            }}
          />
        </button>

        <button
          aria-label="다음"
          className="-translate-y-1/2 absolute top-1/2 right-3 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          onClick={onNext}
          type="button"
        >
          <ChevronRightIcon className="size-5" />
        </button>

        {showMeta ? (
          <div className="absolute right-0 bottom-0 left-0 max-h-[38%] overflow-y-auto bg-gradient-to-t from-black/80 to-transparent px-6 pt-10 pb-4 text-[12px] text-white/90">
            <Meta k="프롬프트" v={image.prompt} />
            <Meta k="네거티브" v={image.negativePrompt} />
            <Meta k="모델" v={image.modelName} />
            <Meta
              k="설정"
              v={`${image.width}×${image.height} · ${image.steps} steps · CFG ${image.guidanceScale} · ${image.sampler}`}
            />
            <Meta k="시드" v={image.seed === null ? "—" : String(image.seed)} />
          </div>
        ) : null}
      </div>

      <div className="pb-2 text-center text-[11px] text-white/40">
        ← → 이동 · 휠 확대 · 더블클릭 원위치 · Esc 닫기
      </div>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="mb-1">
      <span className="font-medium text-white/50">{k} </span>
      <span className="whitespace-pre-wrap break-words">{v || "—"}</span>
    </div>
  );
}
