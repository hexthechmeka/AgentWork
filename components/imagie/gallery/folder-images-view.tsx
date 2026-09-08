"use client";

import {
  ArrowLeftIcon,
  EyeIcon,
  EyeOffIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { ImageDetailModal } from "@/components/imagie/gallery/image-detail-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ImagieImage } from "@/lib/db/schema";
import {
  type GallerySort,
  getGallerySort,
  getIncognito,
  setIncognito as persistIncognito,
  setGallerySort as persistSort,
} from "@/lib/imagie/gallery-prefs";
import { fetcher } from "@/lib/utils";

const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/imagie`;
const DRAG_THRESHOLD = 6;

type Resp = { images: ImagieImage[] };
type FolderRow = { id: string; name: string };

export function FolderImagesView({ folderId }: { folderId: string }) {
  const router = useRouter();
  const { data, mutate } = useSWR<Resp>(
    `${BASE}/images?folderId=${folderId}`,
    fetcher
  );
  const { data: foldersResp } = useSWR<{ folders: FolderRow[] }>(
    `${BASE}/folders`,
    fetcher
  );

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<GallerySort>("new");
  const [incognito, setIncognito] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<false | "bulk" | string>(
    false
  );

  useEffect(() => {
    setSort(getGallerySort());
    setIncognito(getIncognito());
  }, []);

  const folders = foldersResp?.folders ?? [];
  const folderName = folders.find((f) => f.id === folderId)?.name ?? "폴더";
  const images = useMemo(() => data?.images ?? [], [data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? images.filter(
          (i) =>
            i.prompt.toLowerCase().includes(q) ||
            i.modelName.toLowerCase().includes(q)
        )
      : images.slice();
    if (sort === "old") {
      list = list.slice().reverse();
    } else if (sort === "model") {
      list = list
        .slice()
        .sort((a, b) => a.modelName.localeCompare(b.modelName));
    }
    return list;
  }, [images, search, sort]);

  // ── selection ──────────────────────────────────────────────────────────
  const clearSel = useCallback(() => {
    setSelected(new Set());
    setAnchor(null);
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setAnchor(id);
  }, []);

  const rangeTo = useCallback(
    (id: string) => {
      setSelected((prev) => {
        if (!anchor) {
          return new Set([id]);
        }
        const ai = visible.findIndex((v) => v.id === anchor);
        const bi = visible.findIndex((v) => v.id === id);
        if (ai < 0 || bi < 0) {
          return new Set([id]);
        }
        const [lo, hi] = ai < bi ? [ai, bi] : [bi, ai];
        const next = new Set(prev);
        for (let i = lo; i <= hi; i += 1) {
          next.add(visible[i].id);
        }
        return next;
      });
    },
    [anchor, visible]
  );

  const onThumbClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (e.shiftKey) {
        rangeTo(id);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        toggle(id);
        return;
      }
      if (selected.size > 0) {
        setSelected(new Set([id]));
        setAnchor(id);
        return;
      }
      setDetailId(id);
    },
    [rangeTo, toggle, selected.size]
  );

  // ── rubber-band select ────────────────────────────────────────────────
  const gridRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef(new Map<string, HTMLElement>());
  const band = useRef<{
    x: number;
    y: number;
    add: Set<string>;
    active: boolean;
  } | null>(null);
  const [bandRect, setBandRect] = useState<null | {
    l: number;
    t: number;
    w: number;
    h: number;
  }>(null);

  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    const down = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (
        e.button !== 0 ||
        !gridRef.current?.contains(target) ||
        target.closest("[data-thumb]")
      ) {
        return;
      }
      band.current = {
        active: false,
        add:
          e.ctrlKey || e.metaKey
            ? new Set(selectedRef.current)
            : new Set<string>(),
        x: e.clientX,
        y: e.clientY,
      };
    };
    const move = (e: PointerEvent) => {
      const b = band.current;
      if (!b) {
        return;
      }
      const dx = e.clientX - b.x;
      const dy = e.clientY - b.y;
      if (!b.active && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
        return;
      }
      b.active = true;
      const l = Math.min(b.x, e.clientX);
      const t = Math.min(b.y, e.clientY);
      const w = Math.abs(dx);
      const h = Math.abs(dy);
      setBandRect({ h, l, t, w });
      const hit = new Set(b.add);
      for (const [id, el] of cellRefs.current) {
        const r = el.getBoundingClientRect();
        if (r.right > l && r.left < l + w && r.bottom > t && r.top < t + h) {
          hit.add(id);
        }
      }
      setSelected(hit);
    };
    const up = () => {
      if (band.current?.active) {
        setAnchor(null);
      }
      band.current = null;
      setBandRect(null);
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  // ── bulk actions ──────────────────────────────────────────────────────
  const bulkMove = useCallback(
    async (targetId: string) => {
      const ids = [...selected];
      if (ids.length === 0 || targetId === folderId) {
        return;
      }
      const res = await fetch(`${BASE}/images/bulk`, {
        body: JSON.stringify({ folderId: targetId, ids, op: "move" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (res.ok) {
        clearSel();
        await mutate();
        toast.success(`${ids.length}장 이동`);
      } else {
        toast.error("이동 실패");
      }
    },
    [selected, folderId, clearSel, mutate]
  );

  const doDelete = useCallback(async () => {
    const ids =
      confirmDelete === "bulk"
        ? [...selected]
        : confirmDelete
          ? [confirmDelete]
          : [];
    setConfirmDelete(false);
    if (ids.length === 0) {
      return;
    }
    const res = await fetch(`${BASE}/images/bulk`, {
      body: JSON.stringify({ ids, op: "delete" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (res.ok) {
      clearSel();
      setDetailId(null);
      await mutate();
      toast.success(`${ids.length}장 삭제`);
    } else {
      toast.error("삭제 실패");
    }
  }, [confirmDelete, selected, clearSel, mutate]);

  const reuse = useCallback(
    (img: ImagieImage) => {
      try {
        sessionStorage.setItem(
          "imagie.prefill",
          JSON.stringify({
            modelName: img.modelName,
            negativePrompt: img.negativePrompt,
            prompt: img.prompt,
          })
        );
      } catch {
        // best-effort
      }
      toast.success("생성 화면에 프리필했습니다");
      router.push("/imagie");
    },
    [router]
  );

  // ── detail navigation ─────────────────────────────────────────────────
  const detailIdx = visible.findIndex((v) => v.id === detailId);
  const detailImg = detailIdx >= 0 ? visible[detailIdx] : null;
  const stepDetail = useCallback(
    (dir: -1 | 1) => {
      if (visible.length === 0) {
        return;
      }
      const cur = Math.max(0, detailIdx);
      const next = (cur + dir + visible.length) % visible.length;
      setDetailId(visible[next].id);
    },
    [visible, detailIdx]
  );

  const onDragStart = useCallback(
    (e: React.DragEvent, id: string) => {
      if (!selected.has(id)) {
        setSelected(new Set([id]));
      }
      e.dataTransfer.setData("text/plain", "imagie-images");
      e.dataTransfer.effectAllowed = "move";
    },
    [selected]
  );

  const setSortP = useCallback((v: GallerySort) => {
    setSort(v);
    persistSort(v);
  }, []);
  const toggleIncognito = useCallback(() => {
    setIncognito((v) => {
      persistIncognito(!v);
      return !v;
    });
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* header */}
      <div className="flex items-center gap-2 border-border/50 border-b px-6 py-3">
        <Link className="rounded-md p-1 hover:bg-muted" href="/imagie/gallery">
          <ArrowLeftIcon className="size-4" />
        </Link>
        <h1 className="font-semibold text-foreground text-lg">{folderName}</h1>
        <span className="text-[13px] text-muted-foreground">
          {visible.length}
          {search ? ` / ${images.length}` : ""}장
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Input
            className="h-8 w-52"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="프롬프트 / 모델 검색"
            value={search}
          />
          <select
            className="h-8 rounded-lg border border-border bg-card px-2 text-[12px]"
            onChange={(e) => setSortP(e.target.value as GallerySort)}
            value={sort}
          >
            <option value="new">최신순</option>
            <option value="old">오래된순</option>
            <option value="model">모델순</option>
          </select>
          <Button
            onClick={toggleIncognito}
            size="icon"
            title="썸네일 가리기"
            variant={incognito ? "default" : "outline"}
          >
            {incognito ? (
              <EyeOffIcon className="size-4" />
            ) : (
              <EyeIcon className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* folder chips — click to navigate, drop selection to move */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-border/50 border-b px-6 py-2">
        {folders.map((f) => {
          const isCurrent = f.id === folderId;
          return (
            <button
              className={
                isCurrent
                  ? "shrink-0 rounded-full bg-foreground px-3 py-1 text-[12px] text-background"
                  : "shrink-0 rounded-full border border-border px-3 py-1 text-[12px] hover:bg-accent"
              }
              key={f.id}
              onClick={() => {
                if (!isCurrent) {
                  router.push(`/imagie/gallery/${f.id}`);
                }
              }}
              onDragOver={(e) => {
                if (!isCurrent) {
                  e.preventDefault();
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                bulkMove(f.id);
              }}
              type="button"
            >
              {f.name}
            </button>
          );
        })}
      </div>

      {/* bulk toolbar */}
      {selected.size > 0 ? (
        <div className="flex items-center gap-2 border-border/50 border-b bg-accent/40 px-6 py-2 text-[13px]">
          <span className="font-medium">{selected.size}장 선택</span>
          <select
            className="h-8 rounded-lg border border-border bg-card px-2 text-[12px]"
            onChange={(e) => {
              if (e.target.value) {
                bulkMove(e.target.value);
              }
            }}
            value=""
          >
            <option value="">폴더로 이동…</option>
            {folders
              .filter((f) => f.id !== folderId)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  → {f.name}
                </option>
              ))}
          </select>
          <Button
            onClick={() => setConfirmDelete("bulk")}
            size="sm"
            variant="ghost"
          >
            <Trash2Icon className="size-3.5 text-destructive" />
            삭제
          </Button>
          <Button onClick={clearSel} size="sm" variant="ghost">
            <XIcon className="size-3.5" />
            해제
          </Button>
        </div>
      ) : null}

      {/* grid */}
      <div className="relative flex-1 overflow-y-auto px-6 py-5" ref={gridRef}>
        {visible.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-muted-foreground">
            {images.length === 0 ? "이미지가 없습니다" : "검색 결과 없음"}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {visible.map((img) => {
              const sel = selected.has(img.id);
              return (
                <div
                  className={
                    sel
                      ? "relative aspect-square overflow-hidden rounded-lg ring-2 ring-primary"
                      : "relative aspect-square overflow-hidden rounded-lg ring-1 ring-border/60 hover:ring-foreground/30"
                  }
                  data-thumb
                  key={img.id}
                  ref={(el) => {
                    if (el) {
                      cellRefs.current.set(img.id, el);
                    } else {
                      cellRefs.current.delete(img.id);
                    }
                  }}
                >
                  <button
                    className="size-full"
                    draggable
                    onClick={(e) => onThumbClick(e, img.id)}
                    onDragStart={(e) => onDragStart(e, img.id)}
                    type="button"
                  >
                    {/* biome-ignore lint/performance/noImgElement: blob thumb */}
                    <img
                      alt=""
                      className={
                        incognito
                          ? "size-full object-cover blur-xl"
                          : "size-full object-cover"
                      }
                      draggable={false}
                      src={img.thumbUrl}
                    />
                  </button>
                  <input
                    aria-label="선택"
                    checked={sel}
                    className="absolute top-1.5 left-1.5 size-4 accent-primary"
                    onChange={() => toggle(img.id)}
                    type="checkbox"
                  />
                </div>
              );
            })}
          </div>
        )}

        {bandRect ? (
          <div
            className="pointer-events-none fixed z-40 rounded-sm border border-primary bg-primary/10"
            style={{
              height: bandRect.h,
              left: bandRect.l,
              top: bandRect.t,
              width: bandRect.w,
            }}
          />
        ) : null}
      </div>

      <ImageDetailModal
        image={detailImg}
        index={Math.max(0, detailIdx)}
        onClose={() => setDetailId(null)}
        onDelete={(id) => setConfirmDelete(id)}
        onNext={() => stepDetail(1)}
        onPrev={() => stepDetail(-1)}
        onReuse={reuse}
        total={visible.length}
      />

      <AlertDialog
        onOpenChange={(v) => !v && setConfirmDelete(false)}
        open={confirmDelete !== false}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDelete === "bulk"
                ? `${selected.size}장을 삭제할까요?`
                : "이 이미지를 삭제할까요?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              원본과 썸네일이 영구 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
