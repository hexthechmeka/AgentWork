"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { FeatureBadge } from "@/components/imagie/feature-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { SAMPLERS } from "@/lib/imagie/size-presets";
import { fetcher } from "@/lib/utils";

export type ExpertSettings = {
  sampler: string;
  steps: number;
  cfg: number;
  width: number;
  height: number;
  safetyCheck: boolean;
};

const SETTINGS_KEY = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/imagie/settings`;
const selectClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-foreground/40";

export function ExpertPanel({
  open,
  onOpenChange,
  value,
  onChange,
  /** null when the model is v-pred (backend owns sampling). */
  samplingLocked,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: ExpertSettings;
  onChange: (next: ExpertSettings) => void;
  samplingLocked: boolean;
}) {
  const [tab, setTab] = useState<"gen" | "server">("gen");
  const patch = useCallback(
    (p: Partial<ExpertSettings>) => onChange({ ...value, ...p }),
    [value, onChange]
  );

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-[380px] overflow-y-auto sm:max-w-[380px]">
        <SheetHeader>
          <SheetTitle>전문가 설정</SheetTitle>
        </SheetHeader>

        <div className="mt-3 flex gap-1 border-border border-b">
          {(
            [
              ["gen", "생성 설정"],
              ["server", "서버"],
            ] as const
          ).map(([id, label]) => (
            <button
              className={
                tab === id
                  ? "border-foreground border-b-2 px-3 py-2 font-medium text-[13px]"
                  : "px-3 py-2 text-[13px] text-muted-foreground"
              }
              key={id}
              onClick={() => setTab(id)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "gen" ? (
          <div className="mt-4 flex flex-col gap-4">
            {samplingLocked ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-[12px] text-muted-foreground">
                v-prediction 모델입니다. 샘플러 / 스텝 / CFG는 백엔드가
                고정합니다 (Euler + v_prediction + zero-SNR).
              </p>
            ) : (
              <>
                <Field label="샘플러">
                  <select
                    className={selectClass}
                    onChange={(e) => patch({ sampler: e.target.value })}
                    value={value.sampler}
                  >
                    {SAMPLERS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="스텝">
                    <Input
                      onChange={(e) =>
                        patch({ steps: Number(e.target.value) || 0 })
                      }
                      type="number"
                      value={value.steps}
                    />
                  </Field>
                  <Field label="CFG">
                    <Input
                      onChange={(e) =>
                        patch({ cfg: Number(e.target.value) || 0 })
                      }
                      step="0.5"
                      type="number"
                      value={value.cfg}
                    />
                  </Field>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="너비">
                <Input
                  onChange={(e) =>
                    patch({ width: Number(e.target.value) || 0 })
                  }
                  step="8"
                  type="number"
                  value={value.width}
                />
              </Field>
              <Field label="높이">
                <Input
                  onChange={(e) =>
                    patch({ height: Number(e.target.value) || 0 })
                  }
                  step="8"
                  type="number"
                  value={value.height}
                />
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
              <span className="flex items-center gap-2 text-[13px]">
                safety_check
                <FeatureBadge type="experimental" />
              </span>
              <Switch
                checked={value.safetyCheck}
                onCheckedChange={(v) => patch({ safetyCheck: v })}
              />
            </div>

            <div className="rounded-lg border border-border/60 border-dashed p-3 text-[12px] text-muted-foreground">
              LoRA · 임베딩 · IP-Adapter · Hires Fix · img2img
              <br />
              {/* TODO(imagie): Pass 2 — wire these to GenerateParams. */}
              다음 업데이트에서 추가됩니다.
            </div>
          </div>
        ) : (
          <ServerTab />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-medium text-[12px] text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function ServerTab() {
  const { data, mutate } = useSWR<{
    podId: string | null;
    hasRunpodKey: boolean;
  }>(SETTINGS_KEY, fetcher);
  const [podId, setPodId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const currentPod = podId ?? data?.podId ?? "";

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (podId !== null) {
        body.podId = podId;
      }
      if (apiKey.trim()) {
        body.apiKey = apiKey.trim();
      }
      const res = await fetch(SETTINGS_KEY, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error);
      }
      setApiKey("");
      setPodId(null);
      await mutate();
      toast.success("저장되었습니다");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }, [podId, apiKey, mutate]);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <Field label="Pod ID">
        <Input
          onChange={(e) => setPodId(e.target.value)}
          placeholder="xxxx 또는 xxxx-8000.proxy.runpod.net"
          value={currentPod}
        />
      </Field>
      <Field label="RunPod API 키">
        <Input
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={
            data?.hasRunpodKey
              ? "설정됨 — 바꾸려면 새 키 입력"
              : "rest.runpod.io 계정 키"
          }
          type="password"
          value={apiKey}
        />
      </Field>
      <p className="text-[12px] text-muted-foreground">
        키는 서버에만 저장되며 브라우저로 다시 내려오지 않습니다.
      </p>
      <Button disabled={saving} onClick={save} type="button">
        {saving ? "저장 중…" : "저장"}
      </Button>
    </div>
  );
}
