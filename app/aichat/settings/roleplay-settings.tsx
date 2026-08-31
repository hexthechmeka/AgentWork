"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetcher } from "@/lib/utils";

const KEY = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/aichat/settings`;

const TOKENS = [
  ["{{name}}", "캐릭터 이름"],
  ["{{personality}}", "캐릭터 설정"],
  ["{{scenario}}", "배경/상황"],
  ["{{userPersona}}", '"나"(사용자) 설정'],
  ["{{summary}}", "지금까지의 대화 요약"],
  ["{{exampleDialogue}}", "예시 대화(few-shot)"],
] as const;

export default function RoleplaySettings() {
  const { data } = useSWR<{
    template: string;
    default: string;
    isDefault: boolean;
  }>(KEY, fetcher, { revalidateOnFocus: false });

  const [value, setValue] = useState("");
  const [dirtyFrom, setDirtyFrom] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && dirtyFrom === null) {
      setValue(data.template);
      setDirtyFrom(data.template);
    }
  }, [data, dirtyFrom]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value),
    []
  );

  const resetToDefault = useCallback(() => {
    if (data) {
      setValue(data.default);
    }
  }, [data]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(KEY, {
        body: JSON.stringify({ template: value }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!res.ok) {
        throw new Error("save failed");
      }
      setDirtyFrom(value);
      toast.success("저장했어요. 다음 메시지부터 적용됩니다.");
    } catch {
      toast.error("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [value]);

  const dirty = dirtyFrom !== null && value !== dirtyFrom;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col gap-4 overflow-y-auto px-4 py-8">
      <div className="flex flex-col gap-1">
        <Link
          className="flex w-fit items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
          href="/aichat"
        >
          <ArrowLeftIcon className="size-3.5" />
          AIchat으로
        </Link>
        <h1 className="font-semibold text-[18px] text-foreground">
          롤플레이 시스템 프롬프트
        </h1>
        <p className="text-[13px] text-muted-foreground">
          모든 캐릭터 대화에 적용되는 기본 프레임입니다. 아래 토큰이 캐릭터별
          값으로 치환됩니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TOKENS.map(([token, label]) => (
          <span
            className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground"
            key={token}
          >
            <code className="text-foreground">{token}</code> — {label}
          </span>
        ))}
      </div>

      <Textarea
        className="min-h-[420px] font-mono text-[12px] leading-relaxed"
        onChange={handleChange}
        spellCheck={false}
        value={value}
      />

      <div className="flex items-center justify-between gap-2">
        <Button
          className="text-[12px]"
          onClick={resetToDefault}
          size="sm"
          type="button"
          variant="ghost"
        >
          기본값으로 되돌리기
        </Button>
        <Button
          disabled={saving || !dirty}
          onClick={save}
          size="sm"
          type="button"
        >
          저장
        </Button>
      </div>
    </div>
  );
}
