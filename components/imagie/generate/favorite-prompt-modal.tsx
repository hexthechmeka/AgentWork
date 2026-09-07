"use client";

import { StarIcon, Trash2Icon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import type { FavoritePrompt } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";

const KEY = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/imagie/favorite-prompts`;

export function FavoritePromptModal({
  open,
  onOpenChange,
  currentPrompt,
  currentNegative,
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentPrompt: string;
  currentNegative: string;
  onApply: (prompt: string, negative: string) => void;
}) {
  const { data, mutate } = useSWR<{ favorites: FavoritePrompt[] }>(
    open ? KEY : null,
    fetcher
  );
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (!currentPrompt.trim()) {
      toast.error("프롬프트가 비어 있습니다");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(KEY, {
        body: JSON.stringify({
          label: label.trim() || null,
          negativePrompt: currentNegative,
          prompt: currentPrompt,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("save failed");
      }
      setLabel("");
      await mutate();
      toast.success("즐겨찾기에 저장했습니다");
    } catch {
      toast.error("저장 실패");
    } finally {
      setSaving(false);
    }
  }, [currentPrompt, currentNegative, label, mutate]);

  const remove = useCallback(
    async (id: string) => {
      await fetch(`${KEY}/${id}`, { method: "DELETE" });
      await mutate();
    },
    [mutate]
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>즐겨찾기 프롬프트</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            onChange={(e) => setLabel(e.target.value)}
            placeholder="별명 (선택)"
            value={label}
          />
          <Button disabled={saving} onClick={save} type="button">
            <StarIcon className="size-4" />
            현재 저장
          </Button>
        </div>

        <div className="mt-2 flex max-h-80 flex-col gap-1.5 overflow-y-auto">
          {(data?.favorites ?? []).map((f) => (
            <div
              className="flex items-start gap-2 rounded-lg border border-border/60 p-2"
              key={f.id}
            >
              <button
                className="flex-1 text-left"
                onClick={() => {
                  onApply(f.prompt, f.negativePrompt);
                  onOpenChange(false);
                }}
                type="button"
              >
                <div className="font-medium text-[13px]">
                  {f.label || f.prompt.slice(0, 40)}
                </div>
                <div className="line-clamp-2 text-[12px] text-muted-foreground">
                  {f.prompt}
                </div>
              </button>
              <Button
                className="size-7 shrink-0"
                onClick={() => remove(f.id)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2Icon className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          {data && data.favorites.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              저장된 프롬프트가 없습니다
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
