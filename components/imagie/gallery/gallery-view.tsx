"use client";

import { FolderPlusIcon, MoreVerticalIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/utils";

// Show the auto-managed "임시" folder as a card (spec §11 — TODO: make this a
// config flag if it gets noisy).
const SHOW_TEMP_FOLDER = true;

type FolderMeta = {
  id: string;
  name: string;
  isSystem: boolean;
  imageCount: number;
  coverThumbUrl: string | null;
};
type Resp = { folders: FolderMeta[] };

const KEY = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/imagie/folders`;

export function GalleryView() {
  const { data, mutate } = useSWR<Resp>(KEY, fetcher);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FolderMeta | null>(null);
  const [renameText, setRenameText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FolderMeta | null>(null);

  const createFolder = useCallback(async () => {
    if (!newName.trim()) {
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(KEY, {
        body: JSON.stringify({ name: newName.trim() }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("create failed");
      }
      setNewName("");
      await mutate();
    } catch {
      toast.error("폴더 생성 실패");
    } finally {
      setCreating(false);
    }
  }, [newName, mutate]);

  const doRename = useCallback(async () => {
    if (!(renameTarget && renameText.trim())) {
      return;
    }
    await fetch(`${KEY}/${renameTarget.id}`, {
      body: JSON.stringify({ name: renameText.trim() }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    setRenameTarget(null);
    await mutate();
  }, [renameTarget, renameText, mutate]);

  const doDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    await fetch(`${KEY}/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    await mutate();
    toast.success("폴더를 삭제했습니다 (이미지는 미분류로 이동)");
  }, [deleteTarget, mutate]);

  const folders = (data?.folders ?? []).filter(
    (f) => SHOW_TEMP_FOLDER || f.name !== "임시"
  );

  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-5 font-semibold text-foreground text-xl">갤러리</h1>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {folders.map((f) => (
            <div className="group relative" key={f.id}>
              <Link
                className="block overflow-hidden rounded-xl border border-border/60 transition-colors hover:border-foreground/30"
                href={`/imagie/gallery/${f.id}`}
              >
                <div className="aspect-square bg-muted/40">
                  {f.coverThumbUrl ? (
                    // biome-ignore lint/performance/noImgElement: blob thumb
                    <img
                      alt=""
                      className="size-full object-cover"
                      src={f.coverThumbUrl}
                    />
                  ) : null}
                </div>
                <div className="flex items-center justify-between px-2.5 py-2">
                  <span className="truncate font-medium text-[13px]">
                    {f.name}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {f.imageCount}
                  </span>
                </div>
              </Link>
              {f.name === "임시" ? (
                <span className="absolute top-2 left-2 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  임시 · 7일
                </span>
              ) : null}
              {f.isSystem ? null : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="absolute top-1.5 right-1.5 rounded-md bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                      type="button"
                    >
                      <MoreVerticalIcon className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setRenameTarget(f);
                        setRenameText(f.name);
                      }}
                    >
                      이름 변경
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteTarget(f)}
                    >
                      삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}

          {/* new folder card */}
          <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-border/60 border-dashed p-3">
            <FolderPlusIcon className="size-5 text-muted-foreground" />
            <Input
              className="h-8 text-[12px]"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  createFolder();
                }
              }}
              placeholder="새 폴더"
              value={newName}
            />
            <Button
              className="h-7 w-full text-[12px]"
              disabled={creating || !newName.trim()}
              onClick={createFolder}
              size="sm"
              variant="outline"
            >
              만들기
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog
        onOpenChange={(v) => !v && setRenameTarget(null)}
        open={renameTarget !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>폴더 이름 변경</AlertDialogTitle>
          </AlertDialogHeader>
          <Input
            onChange={(e) => setRenameText(e.target.value)}
            value={renameText}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={doRename}>변경</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        open={deleteTarget !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              "{deleteTarget?.name}" 폴더를 삭제할까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              폴더 안의 이미지 {deleteTarget?.imageCount ?? 0}장은 삭제되지 않고
              "미분류"로 이동합니다.
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
