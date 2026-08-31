"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetcher } from "@/lib/utils";

const KEY = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/aichat/settings`;

type GenParams = {
  temperature: number;
  topP: number;
  penalty: number;
  maxOutputTokens: number;
};

type SettingsResponse = {
  template: string;
  default: string;
  isDefault: boolean;
  genParams: GenParams;
  defaultGenParams: GenParams;
};

const TOKENS = [
  ["{{name}}", "캐릭터 이름"],
  ["{{personality}}", "캐릭터 설정"],
  ["{{scenario}}", "배경/상황"],
  ["{{userPersona}}", '"나"(사용자) 설정'],
  ["{{summary}}", "지금까지의 대화 요약"],
  ["{{exampleDialogue}}", "예시 대화(few-shot)"],
] as const;

const GEN_FIELDS = [
  {
    hint: "낮을수록 안정적·일관됨, 높을수록 다양·예측불가. 한국어 안정성 우선이면 0.7~0.85.",
    key: "temperature",
    label: "Temperature",
    max: 2,
    min: 0,
    step: 0.05,
  },
  {
    hint: "상위 확률 토큰만 사용. 보통 0.9 전후.",
    key: "topP",
    label: "Top-p",
    max: 1,
    min: 0.05,
    step: 0.05,
  },
  {
    hint: "반복 억제(presence+frequency penalty). 너무 높으면 한국어 조사·어미가 어색해짐. 0~0.3 권장.",
    key: "penalty",
    label: "반복 억제",
    max: 2,
    min: 0,
    step: 0.05,
  },
  {
    hint: "한 답변의 최대 길이(토큰). 짧게 끊기면 올리기.",
    key: "maxOutputTokens",
    label: "최대 응답 길이",
    max: 4000,
    min: 128,
    step: 32,
  },
] as const;

function GenField({
  field,
  value,
  onChange,
}: {
  field: (typeof GEN_FIELDS)[number];
  value: number;
  onChange: (key: keyof GenParams, value: number) => void;
}) {
  const handle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = Number(e.target.value);
      if (Number.isFinite(n)) {
        onChange(field.key as keyof GenParams, n);
      }
    },
    [field.key, onChange]
  );
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-[13px] text-foreground">
          {field.label}
        </span>
        <Input
          className="h-8 w-24 text-right text-[13px]"
          max={field.max}
          min={field.min}
          onChange={handle}
          step={field.step}
          type="number"
          value={value}
        />
      </div>
      <span className="text-[11px] text-muted-foreground">{field.hint}</span>
    </div>
  );
}

export default function RoleplaySettings() {
  const { data } = useSWR<SettingsResponse>(KEY, fetcher, {
    revalidateOnFocus: false,
  });

  const [value, setValue] = useState("");
  const [gen, setGen] = useState<GenParams | null>(null);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && baseline === null) {
      setValue(data.template);
      setGen(data.genParams);
      setBaseline(JSON.stringify({ g: data.genParams, t: data.template }));
    }
  }, [data, baseline]);

  const handleTemplate = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value),
    []
  );

  const handleGen = useCallback((key: keyof GenParams, v: number) => {
    setGen((prev) => (prev ? { ...prev, [key]: v } : prev));
  }, []);

  const resetToDefault = useCallback(() => {
    if (data) {
      setValue(data.default);
      setGen(data.defaultGenParams);
    }
  }, [data]);

  const save = useCallback(async () => {
    if (!gen) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(KEY, {
        body: JSON.stringify({ genParams: gen, template: value }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!res.ok) {
        throw new Error("save failed");
      }
      setBaseline(JSON.stringify({ g: gen, t: value }));
      toast.success("저장했어요. 다음 메시지부터 적용됩니다.");
    } catch {
      toast.error("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [gen, value]);

  const dirty =
    baseline !== null &&
    gen !== null &&
    JSON.stringify({ g: gen, t: value }) !== baseline;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col gap-5 overflow-y-auto px-4 py-8">
      <div className="flex flex-col gap-1">
        <Link
          className="flex w-fit items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
          href="/aichat"
        >
          <ArrowLeftIcon className="size-3.5" />
          AIchat으로
        </Link>
        <h1 className="font-semibold text-[18px] text-foreground">
          롤플레이 설정
        </h1>
        <p className="text-[13px] text-muted-foreground">
          모든 캐릭터 대화에 적용됩니다.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium text-[14px] text-foreground">
          시스템 프롬프트
        </h2>
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
          className="min-h-[380px] font-mono text-[12px] leading-relaxed"
          onChange={handleTemplate}
          spellCheck={false}
          value={value}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-[14px] text-foreground">
          생성 파라미터
        </h2>
        {gen
          ? GEN_FIELDS.map((field) => (
              <GenField
                field={field}
                key={field.key}
                onChange={handleGen}
                value={gen[field.key as keyof GenParams]}
              />
            ))
          : null}
      </section>

      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-border/40 border-t bg-background py-3">
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
