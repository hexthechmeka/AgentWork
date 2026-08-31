"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chatModels } from "@/lib/ai/models";
import { cn } from "@/lib/utils";

export type PersonaFormValues = {
  id?: string;
  name: string;
  tagline: string;
  avatarUrl: string;
  personality: string;
  openingMessage: string;
  scenario: string;
  defaultModel: string;
  tags: string; // comma-separated in the form
};

export const EMPTY_PERSONA: PersonaFormValues = {
  avatarUrl: "",
  defaultModel: "anthropic/claude-sonnet-5",
  name: "",
  openingMessage: "",
  personality: "",
  scenario: "",
  tagline: "",
  tags: "",
};

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
  const isEdit = Boolean(initial.id);
  const [values, setValues] = useState<PersonaFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const openFilePicker = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const goToGallery = useCallback(() => {
    router.push("/aichat");
  }, [router]);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }
      setUploading(true);
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
        setValues((prev) => ({ ...prev, avatarUrl: data.url as string }));
      } catch {
        toast.error("이미지 업로드에 실패했습니다");
      } finally {
        setUploading(false);
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
          name: values.name.trim(),
          openingMessage: values.openingMessage.trim() || null,
          personality: values.personality.trim(),
          scenario: values.scenario.trim() || null,
          tagline: values.tagline.trim() || null,
          tags: values.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
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
        router.push("/aichat");
        router.refresh();
      } catch {
        toast.error("저장에 실패했습니다");
      } finally {
        setSaving(false);
      }
    },
    [values, isEdit, initial.id, router]
  );

  let submitLabel = "생성";
  if (saving) {
    submitLabel = "저장 중…";
  } else if (isEdit) {
    submitLabel = "저장";
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex items-center gap-3">
        <button
          className={cn(
            "flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-[11px] text-muted-foreground",
            uploading && "opacity-50"
          )}
          onClick={openFilePicker}
          type="button"
        >
          {values.avatarUrl ? (
            // biome-ignore lint/performance/noImgElement: user-uploaded blob avatar
            <img
              alt=""
              className="size-full object-cover"
              src={values.avatarUrl}
            />
          ) : (
            "이미지"
          )}
        </button>
        <input
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handleUpload}
          ref={fileRef}
          type="file"
        />
        <span className="text-[12px] text-muted-foreground">
          아바타 (PNG/JPEG, 선택)
        </span>
      </div>

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

      <Field hint="첫 assistant 메시지로 미리 채워집니다" label="오프닝 메시지">
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

      <div className="flex gap-2 pt-2">
        <Button disabled={saving || uploading} type="submit">
          {submitLabel}
        </Button>
        <Button onClick={goToGallery} type="button" variant="outline">
          취소
        </Button>
      </div>
    </form>
  );
}
