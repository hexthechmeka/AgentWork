"use client";

import { ArrowLeftIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetcher } from "@/lib/utils";

type PlayerPersona = {
  id: string;
  name: string;
  description: string;
};

export const PLAYER_PERSONAS_KEY = `${
  process.env.NEXT_PUBLIC_BASE_PATH ?? ""
}/api/player-personas`;

function PlayerPersonaRow({
  persona,
  onEdit,
  onDelete,
}: {
  persona: PlayerPersona;
  onEdit: (p: PlayerPersona) => void;
  onDelete: (p: PlayerPersona) => void;
}) {
  const handleEdit = useCallback(() => onEdit(persona), [onEdit, persona]);
  const handleDelete = useCallback(
    () => onDelete(persona),
    [onDelete, persona]
  );

  return (
    <li className="flex flex-col gap-1 rounded-xl border border-border/50 bg-card/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-[13px] text-foreground">
          {persona.name}
        </span>
        <div className="flex shrink-0 gap-1">
          <Button
            className="h-7 px-2 text-[12px]"
            onClick={handleEdit}
            size="sm"
            variant="ghost"
          >
            수정
          </Button>
          <Button
            className="h-7 px-2 text-[12px] text-destructive hover:text-destructive"
            onClick={handleDelete}
            size="sm"
            variant="ghost"
          >
            삭제
          </Button>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-[12px] text-muted-foreground leading-relaxed">
        {persona.description}
      </p>
    </li>
  );
}

export default function PlayerPersonaManager() {
  const { data, mutate } = useSWR<{ playerPersonas: PlayerPersona[] }>(
    PLAYER_PERSONAS_KEY,
    fetcher,
    { revalidateOnFocus: false }
  );
  const personas = data?.playerPersonas ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlayerPersona | null>(null);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName("");
    setDescription("");
  }, []);

  const handleEdit = useCallback((p: PlayerPersona) => {
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description);
  }, []);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value),
    []
  );
  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      setDescription(e.target.value),
    []
  );

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!(trimmedName && trimmedDescription)) {
      toast.error("이름과 설명을 모두 입력하세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        editingId ? `${PLAYER_PERSONAS_KEY}/${editingId}` : PLAYER_PERSONAS_KEY,
        {
          body: JSON.stringify({
            description: trimmedDescription,
            name: trimmedName,
          }),
          headers: { "Content-Type": "application/json" },
          method: editingId ? "PATCH" : "POST",
        }
      );
      if (!res.ok) {
        throw new Error("저장 실패");
      }
      await mutate();
      resetForm();
      toast.success(editingId ? "수정했어요." : "추가했어요.");
    } catch {
      toast.error("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [description, editingId, mutate, name, resetForm]);

  const confirmDelete = useCallback((p: PlayerPersona) => {
    setDeleteTarget(p);
  }, []);

  const handleDeleteConfirmed = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      const res = await fetch(`${PLAYER_PERSONAS_KEY}/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("삭제 실패");
      }
      if (editingId === deleteTarget.id) {
        resetForm();
      }
      await mutate();
      toast.success("삭제했어요.");
    } catch {
      toast.error("삭제에 실패했습니다.");
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, editingId, mutate, resetForm]);

  const handleDeleteDialogChange = useCallback((open: boolean) => {
    if (!open) {
      setDeleteTarget(null);
    }
  }, []);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col gap-6 overflow-y-auto px-4 py-8">
      <div className="flex flex-col gap-1">
        <Link
          className="flex w-fit items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
          href="/aichat"
        >
          <ArrowLeftIcon className="size-3.5" />
          AIchat으로
        </Link>
        <h1 className="font-semibold text-[18px] text-foreground">
          나의 페르소나
        </h1>
        <p className="text-[13px] text-muted-foreground">
          롤플레이에서 "나"가 누구인지 미리 정해두고, 채팅방마다 골라서 쓸 수
          있어요.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-border/50 bg-card/60 p-4">
        <span className="font-medium text-[13px] text-foreground">
          {editingId ? "페르소나 수정" : "새 페르소나"}
        </span>
        <Input
          onChange={handleNameChange}
          placeholder="이름 (예: 편의점 단골 손님)"
          value={name}
        />
        <Textarea
          className="min-h-24 text-[13px]"
          onChange={handleDescriptionChange}
          placeholder="예: 매일 밤 이 편의점에 오는 20대. 말수가 적고 늘 라면을 산다. 알바생과는 서로 얼굴만 아는 사이."
          value={description}
        />
        <div className="flex justify-end gap-2">
          {editingId ? (
            <Button onClick={resetForm} size="sm" type="button" variant="ghost">
              취소
            </Button>
          ) : null}
          <Button
            disabled={saving}
            onClick={handleSave}
            size="sm"
            type="button"
          >
            {editingId ? "수정" : "추가"}
          </Button>
        </div>
      </div>

      {personas.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          아직 만든 페르소나가 없어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {personas.map((p) => (
            <PlayerPersonaRow
              key={p.id}
              onDelete={confirmDelete}
              onEdit={handleEdit}
              persona={p}
            />
          ))}
        </ul>
      )}

      <AlertDialog
        onOpenChange={handleDeleteDialogChange}
        open={deleteTarget !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>페르소나를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}"을(를) 삭제합니다. 이 페르소나를 쓰던
              채팅방은 기본 설정으로 돌아갑니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirmed}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
