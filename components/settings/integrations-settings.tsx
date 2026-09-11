"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetcher } from "@/lib/utils";

const KEY = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/settings/credentials`;

type Status = {
  hasAnthropic: boolean;
  hasGlm: boolean;
  hasGithubPat: boolean;
  hasRunpodKey: boolean;
};

type FieldKey = "anthropicApiKey" | "glmApiKey" | "githubPat" | "runpodApiKey";

type FieldDef = {
  bodyKey: FieldKey;
  statusKey: keyof Status;
  label: string;
  placeholder: string;
  href: string;
  linkLabel: string;
};

const FIELDS: FieldDef[] = [
  {
    bodyKey: "anthropicApiKey",
    href: "https://console.anthropic.com/settings/keys",
    label: "Anthropic API Key",
    linkLabel: "Anthropic 콘솔에서 발급",
    placeholder: "sk-ant-...",
    statusKey: "hasAnthropic",
  },
  {
    bodyKey: "glmApiKey",
    href: "https://open.bigmodel.cn/usercenter/apikeys",
    label: "GLM API Key",
    linkLabel: "z.ai(BigModel) 콘솔에서 발급",
    placeholder: "GLM API 키",
    statusKey: "hasGlm",
  },
  {
    bodyKey: "githubPat",
    href: "https://github.com/settings/personal-access-tokens/new",
    label: "GitHub PAT",
    linkLabel: "GitHub에서 fine-grained PAT 발급 (contents: read/write)",
    placeholder: "github_pat_...",
    statusKey: "hasGithubPat",
  },
  {
    bodyKey: "runpodApiKey",
    href: "https://www.runpod.io/console/user/settings",
    label: "RunPod API Key",
    linkLabel: "RunPod 콘솔에서 발급",
    placeholder: "rest.runpod.io 계정 키 (전원 제어용)",
    statusKey: "hasRunpodKey",
  },
];

export function IntegrationsSettings() {
  const { data, mutate } = useSWR<Status>(KEY, fetcher);

  const saveField = useCallback(
    async (bodyKey: FieldKey, value: string) => {
      const res = await fetch(KEY, {
        body: JSON.stringify({ [bodyKey]: value }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!res.ok) {
        throw new Error("저장 실패");
      }
      await mutate();
    },
    [mutate]
  );

  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-2">
          <Link
            className="flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            href="/"
          >
            <ArrowLeftIcon className="size-3.5" />
            돌아가기
          </Link>
          <h1 className="font-semibold text-foreground text-xl">연동 설정</h1>
          <p className="text-[13px] text-muted-foreground">
            각 기능을 쓰려면 본인 API 키/토큰을 등록하세요. 필수 아님 — 등록 안
            한 키가 필요한 기능은 그때 안내가 뜹니다. 키는 서버에만 암호화되어
            저장되며 브라우저로 다시 내려오지 않습니다.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          {FIELDS.map((field) => (
            <FieldRow
              field={field}
              hasValue={Boolean(data?.[field.statusKey])}
              key={field.bodyKey}
              onSave={saveField}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  field,
  hasValue,
  onSave,
}: {
  field: FieldDef;
  hasValue: boolean;
  onSave: (bodyKey: FieldKey, value: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value),
    []
  );

  const handleSave = useCallback(async () => {
    if (!value.trim()) {
      return;
    }
    setSaving(true);
    try {
      await onSave(field.bodyKey, value.trim());
      setValue("");
      toast.success("저장되었습니다");
    } catch {
      toast.error("저장 실패");
    } finally {
      setSaving(false);
    }
  }, [value, field.bodyKey, onSave]);

  return (
    <section className="flex flex-col gap-1.5">
      <Label htmlFor={field.bodyKey}>{field.label}</Label>
      <div className="flex gap-2">
        <Input
          id={field.bodyKey}
          onChange={handleChange}
          placeholder={
            hasValue ? "설정됨 — 바꾸려면 새 값 입력" : field.placeholder
          }
          type="password"
          value={value}
        />
        <Button disabled={saving || !value.trim()} onClick={handleSave}>
          {saving ? "저장 중…" : "저장"}
        </Button>
      </div>
      <a
        className="w-fit text-[12px] text-muted-foreground underline-offset-4 hover:underline"
        href={field.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {field.linkLabel}
      </a>
    </section>
  );
}
