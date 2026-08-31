"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { getAichatKey } from "@/components/aichat/aichat-sidebar";
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
import { chatModels } from "@/lib/ai/models";
import { cn } from "@/lib/utils";

export type PersonaFormValues = {
  id?: string;
  name: string;
  tagline: string;
  avatarUrl: string;
  panelImageUrl: string;
  personality: string;
  openingMessage: string;
  scenario: string;
  userPersona: string;
  exampleDialogue: string;
  defaultModel: string;
  tags: string; // comma-separated in the form
};

export const EMPTY_PERSONA: PersonaFormValues = {
  avatarUrl: "",
  defaultModel: "anthropic/claude-sonnet-5",
  exampleDialogue: "",
  name: "",
  openingMessage: "",
  panelImageUrl: "",
  personality: "",
  scenario: "",
  tagline: "",
  tags: "",
  userPersona: "",
};

type ImageField = "avatarUrl" | "panelImageUrl";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-medium text-[13px] text-foreground">{label}</span>
      {children}
      {hint ? (
        <span className="text-[12px] text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}

const textareaClass =
  "min-h-24 w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground outline-none focus:border-foreground/40";
const selectClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground outline-none focus:border-foreground/40";

export function PersonaForm({ initial }: { initial: PersonaFormValues }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const isEdit = Boolean(initial.id);
  const [values, setValues] = useState<PersonaFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<ImageField | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingField = useRef<ImageField>("avatarUrl");

  const handleChange = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      const { name, value } = e.target;
      setValues((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const pickAvatar = useCallback(() => {
    pendingField.current = "avatarUrl";
    fileRef.current?.click();
  }, []);
  const pickPanel = useCallback(() => {
    pendingField.current = "panelImageUrl";
    fileRef.current?.click();
  }, []);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const field = pendingField.current;
      e.target.value = "";
      if (!file) {
        return;
      }
      setUploading(field);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/files/upload", {
          body: fd,
          method: "POST",
        });
        if (!res.ok) {
          throw new Error("upload failed");
        }
        const data = await res.json();
        setValues((prev) => ({ ...prev, [field]: data.url as string }));
      } catch {
        toast.error("이미지 업로드에 실패했습니다");
      } finally {
        setUploading(null);
      }
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!(values.name.trim() && values.personality.trim())) {
        toast.error("이름과 성격(시스템 프롬프트)은 필수입니다");
        return;
      }
      setSaving(true);
      try {
        const payload = {
          avatarUrl: values.avatarUrl || null,
          defaultModel: values.defaultModel,
          exampleDialogue: values.exampleDialogue.trim() || null,
          name: values.name.trim(),
          openingMessage: values.openingMessage.trim() || null,
          panelImageUrl: values.panelImageUrl || null,
          personality: values.personality.trim(),
          scenario: values.scenario.trim() || null,
          tagline: values.tagline.trim() || null,
          tags: values.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          userPersona: values.userPersona.trim() || null,
        };
        const res = await fetch(
          isEdit ? `/api/personas/${initial.id}` : "/api/personas",
          {
            body: JSON.stringify(payload),
            headers: { "Content-Type": "application/json" },
            method: isEdit ? "PATCH" : "POST",
          }
        );
        if (!res.ok) {
          throw new Error("save failed");
        }
        toast.success(isEdit ? "저장되었습니다" : "캐릭터가 생성되었습니다");
        await mutate(getAichatKey());
        router.push("/aichat");
      } catch {
        toast.error("저장에 실패했습니다");
      } finally {
        setSaving(false);
      }
    },
    [values, isEdit, initial.id, router, mutate]
  );

  const goToGallery = useCallback(() => {
    router.push("/aichat");
  }, [router]);
  const openConfirmDelete = useCallback(() => {
    setConfirmDelete(true);
  }, []);
  const handleDelete = useCallback(async () => {
    setConfirmDelete(false);
    try {
      const res = await fetch(`/api/personas/${initial.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("delete failed");
      }
      toast.success("캐릭터가 삭제되었습니다");
      await mutate(getAichatKey());
      router.push("/aichat");
    } catch {
      toast.error("삭제에 실패했습니다");
    }
  }, [initial.id, mutate, router]);

  let submitLabel = "생성";
  if (saving) {
    submitLabel = "저장 중…";
  } else if (isEdit) {
    submitLabel = "저장";
  }

  return (
    <>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-1.5">
            <button
              className={cn(
                "flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-[11px] text-muted-foreground",
                uploading === "avatarUrl" && "opacity-50"
              )}
              onClick={pickAvatar}
              type="button"
            >
              {values.avatarUrl ? (
                // biome-ignore lint/performance/noImgElement: user-uploaded blob image
                <img
                  alt=""
                  className="size-full object-cover"
                  src={values.avatarUrl}
                />
              ) : (
                "아바타"
              )}
            </button>
            <span className="text-[11px] text-muted-foreground">아바타</span>
          </div>

          <div className="flex flex-1 flex-col items-center gap-1.5">
            <button
              className={cn(
                "flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-card text-[11px] text-muted-foreground",
                uploading === "panelImageUrl" && "opacity-50"
              )}
              onClick={pickPanel}
              type="button"
            >
              {values.panelImageUrl ? (
                // biome-ignore lint/performance/noImgElement: user-uploaded blob image
                <img
                  alt=""
                  className="size-full object-cover"
                  src={values.panelImageUrl}
                />
              ) : (
                "패널 이미지 (갤러리·상세용)"
              )}
            </button>
            <span className="text-[11px] text-muted-foreground">
              패널 이미지
            </span>
          </div>
        </div>
        <input
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handleUpload}
          ref={fileRef}
          type="file"
        />

        <Field label="이름">
          <Input
            name="name"
            onChange={handleChange}
            placeholder="캐릭터 이름"
            value={values.name}
          />
        </Field>

        <Field label="한 줄 소개 (tagline)">
          <Input
            name="tagline"
            onChange={handleChange}
            placeholder="갤러리 카드에 표시됨"
            value={values.tagline}
          />
        </Field>

        <Field
          hint="시스템 프롬프트로 그대로 사용됩니다"
          label="성격 / 설정 (personality)"
        >
          <textarea
            className={textareaClass}
            name="personality"
            onChange={handleChange}
            placeholder="말투, 성격, 배경, 규칙 등"
            value={values.personality}
          />
        </Field>

        <Field
          hint="첫 assistant 메시지로 미리 채워집니다"
          label="오프닝 메시지"
        >
          <textarea
            className={textareaClass}
            name="openingMessage"
            onChange={handleChange}
            placeholder="대화를 여는 첫 대사 (선택)"
            value={values.openingMessage}
          />
        </Field>

        <Field label="상황 (scenario, 선택)">
          <textarea
            className={textareaClass}
            name="scenario"
            onChange={handleChange}
            placeholder="현재 상황 / 장면 설명"
            value={values.scenario}
          />
        </Field>

        <Field
          hint='캐릭터가 "나"를 누구로 인식할지 (선택)'
          label='상대역 — "나" 설정'
        >
          <textarea
            className={textareaClass}
            name="userPersona"
            onChange={handleChange}
            placeholder="예: 이 편의점 야간 알바생. 며칠 전 새로 들어옴."
            value={values.userPersona}
          />
        </Field>

        <Field
          hint="캐릭터 말투·호흡을 잡아주는 짧은 예시. 약한 모델일수록 효과 큼 (선택)"
          label="예시 대화 (few-shot)"
        >
          <textarea
            className={textareaClass}
            name="exampleDialogue"
            onChange={handleChange}
            placeholder={
              "나: 요즘 잘 지내?\n한여름: *샌들 끈을 손가락에 감으며 딴청을 부린다* 뭐, 그냥저냥. 너는? ...오랜만에 보니까 좀 어색하네."
            }
            value={values.exampleDialogue}
          />
        </Field>

        <Field label="기본 모델">
          <select
            className={selectClass}
            name="defaultModel"
            onChange={handleChange}
            value={values.defaultModel}
          >
            {chatModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>

        <Field hint="쉼표로 구분" label="태그">
          <Input
            name="tags"
            onChange={handleChange}
            placeholder="판타지, 학원, ..."
            value={values.tags}
          />
        </Field>

        <div className="flex items-center gap-2 pt-2">
          <Button disabled={saving || Boolean(uploading)} type="submit">
            {submitLabel}
          </Button>
          <Button onClick={goToGallery} type="button" variant="outline">
            취소
          </Button>
          {isEdit ? (
            <Button
              className="ml-auto"
              onClick={openConfirmDelete}
              type="button"
              variant="ghost"
            >
              <Trash2Icon className="size-4 text-destructive" />
              <span className="text-destructive">삭제</span>
            </Button>
          ) : null}
        </div>
      </form>

      <AlertDialog onOpenChange={setConfirmDelete} open={confirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 캐릭터를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              캐릭터 설정이 영구 삭제됩니다. 이 캐릭터와의 기존 대화는 남지만
              캐릭터 연결이 해제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
