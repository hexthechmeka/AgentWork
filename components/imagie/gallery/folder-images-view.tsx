"use client";

import { ArrowLeftIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImagieImage } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";

const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/imagie`;

type Resp = { images: ImagieImage[] };

export function FolderImagesView({ folderId }: { folderId: string }) {
  const router = useRouter();
  const { data, mutate } = useSWR<Resp>(
    `${BASE}/images?folderId=${folderId}`,
    fetcher
  );
  const { data: folders } = useSWR<{
    folders: Array<{ id: string; name: string }>;
  }>(`${BASE}/folders`, fetcher);
  const [detail, setDetail] = useState<ImagieImage | null>(null);

  const folderName =
    folders?.folders.find((f) => f.id === folderId)?.name ?? "폴더";

  const remove = useCallback(
    async (id: string) => {
      await fetch(`${BASE}/images/${id}`, { method: "DELETE" });
      setDetail(null);
      await mutate();
    },
    [mutate]
  );

  const reuse = useCallback(
    (img: ImagieImage) => {
      try {
        sessionStorage.setItem(
          "imagie.prefill",
          JSON.stringify({
            height: img.height,
            modelName: img.modelName,
            negativePrompt: img.negativePrompt,
            prompt: img.prompt,
            width: img.width,
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

  const images = data?.images ?? [];

  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-5 flex items-center gap-2">
          <Link
            className="rounded-md p-1 hover:bg-muted"
            href="/imagie/gallery"
          >
            <ArrowLeftIcon className="size-4" />
          </Link>
          <h1 className="font-semibold text-foreground text-xl">
            {folderName}
          </h1>
          <span className="text-[13px] text-muted-foreground">
            {images.length}장
          </span>
        </div>

        {images.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-muted-foreground">
            이미지가 없습니다
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {images.map((img) => (
              <button
                className="aspect-square overflow-hidden rounded-lg border border-border/60 transition-colors hover:border-foreground/30"
                key={img.id}
                onClick={() => setDetail(img)}
                type="button"
              >
                {/* biome-ignore lint/performance/noImgElement: blob thumb */}
                <img
                  alt=""
                  className="size-full object-cover"
                  src={img.thumbUrl}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog
        onOpenChange={(v) => !v && setDetail(null)}
        open={detail !== null}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-[14px]">이미지 상세</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="flex flex-col gap-3 md:flex-row">
              {/* biome-ignore lint/performance/noImgElement: full blob image */}
              <img
                alt=""
                className="max-h-[60vh] rounded-lg object-contain md:w-1/2"
                src={detail.blobUrl}
              />
              <div className="flex flex-1 flex-col gap-2 text-[12px]">
                <Meta k="프롬프트" v={detail.prompt} />
                <Meta k="네거티브" v={detail.negativePrompt} />
                <Meta k="모델" v={detail.modelName} />
                <Meta
                  k="설정"
                  v={`${detail.width}×${detail.height} · ${detail.steps} steps · CFG ${detail.guidanceScale} · ${detail.sampler}`}
                />
                <Meta
                  k="시드"
                  v={detail.seed === null ? "—" : String(detail.seed)}
                />
                <div className="mt-2 flex gap-2">
                  <Button onClick={() => reuse(detail)} size="sm">
                    <RefreshCwIcon className="size-3.5" />이 설정으로 다시 생성
                  </Button>
                  <Button
                    onClick={() => remove(detail.id)}
                    size="sm"
                    variant="ghost"
                  >
                    <Trash2Icon className="size-3.5 text-destructive" />
                    삭제
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="font-medium text-muted-foreground">{k}</div>
      <div className="whitespace-pre-wrap break-words">{v || "—"}</div>
    </div>
  );
}
