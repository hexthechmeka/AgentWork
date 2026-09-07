"use client";

import { PlusIcon, UploadIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import {
  type AdvancedSettings,
  fileToDataUrl,
  type LoraEntry,
} from "@/lib/imagie/advanced";
import { getEmbeddings, getLoras } from "@/lib/imagie/imagie-client";
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
  advanced,
  onAdvancedChange,
  baseUrl,
  /** true when the model is v-pred (backend owns sampling). */
  samplingLocked,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: ExpertSettings;
  onChange: (next: ExpertSettings) => void;
  advanced: AdvancedSettings;
  onAdvancedChange: (next: AdvancedSettings) => void;
  baseUrl: string | null;
  samplingLocked: boolean;
}) {
  const [tab, setTab] = useState<"gen" | "server">("gen");
  const patch = useCallback(
    (p: Partial<ExpertSettings>) => onChange({ ...value, ...p }),
    [value, onChange]
  );

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-[400px] overflow-y-auto sm:max-w-[400px]">
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

            <AdvancedControls
              baseUrl={baseUrl}
              onChange={onAdvancedChange}
              value={advanced}
            />
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

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 border-border/60 border-t pt-3 font-medium text-[12px] text-muted-foreground">
      {children}
    </div>
  );
}

// ─── Advanced controls: LoRA / embeddings / IP-Adapter / Hires Fix ────────
// img2img lives on the main form (spec §5); it edits the same AdvancedSettings.

function AdvancedControls({
  value,
  onChange,
  baseUrl,
}: {
  value: AdvancedSettings;
  onChange: (next: AdvancedSettings) => void;
  baseUrl: string | null;
}) {
  const [loraNames, setLoraNames] = useState<string[]>([]);
  const [embedNames, setEmbedNames] = useState<string[]>([]);

  useEffect(() => {
    if (!baseUrl) {
      return;
    }
    getLoras(baseUrl)
      .then((r) => setLoraNames(r.loras))
      .catch(() => undefined);
    getEmbeddings(baseUrl)
      .then((r) => setEmbedNames(r.embeddings))
      .catch(() => undefined);
  }, [baseUrl]);

  const patch = useCallback(
    (p: Partial<AdvancedSettings>) => onChange({ ...value, ...p }),
    [value, onChange]
  );

  const setLora = useCallback(
    (i: number, entry: Partial<LoraEntry>) => {
      patch({
        loras: value.loras.map((l, idx) =>
          idx === i ? { ...l, ...entry } : l
        ),
      });
    },
    [value.loras, patch]
  );

  const uploadRef = useCallback(
    async (file: File | undefined) => {
      if (!file) {
        return;
      }
      try {
        patch({ refImage: await fileToDataUrl(file) });
      } catch {
        toast.error("이미지 읽기 실패");
      }
    },
    [patch]
  );

  return (
    <>
      <SectionHead>LoRA</SectionHead>
      {value.loras.map((l, i) => (
        <div
          className="flex items-center gap-2"
          // biome-ignore lint/suspicious/noArrayIndexKey: lora rows have no stable id
          key={i}
        >
          <select
            className={selectClass}
            onChange={(e) => setLora(i, { name: e.target.value })}
            value={l.name}
          >
            <option value="">(선택)</option>
            {loraNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <Input
            className="w-20"
            max={2}
            min={0}
            onChange={(e) => setLora(i, { scale: Number(e.target.value) || 0 })}
            step="0.05"
            type="number"
            value={l.scale}
          />
          <Button
            className="size-8 shrink-0"
            onClick={() =>
              patch({ loras: value.loras.filter((_, idx) => idx !== i) })
            }
            size="icon"
            type="button"
            variant="ghost"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        className="w-fit"
        disabled={loraNames.length === 0}
        onClick={() =>
          patch({ loras: [...value.loras, { name: "", scale: 0.8 }] })
        }
        size="sm"
        type="button"
        variant="outline"
      >
        <PlusIcon className="size-3.5" />
        LoRA 추가
      </Button>
      {loraNames.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Pod을 켜면 사용 가능한 LoRA 목록이 로드됩니다.
        </p>
      ) : null}

      <SectionHead>임베딩 (textual inversion · SD1.x)</SectionHead>
      {embedNames.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          사용 가능한 임베딩이 없습니다.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {embedNames.map((n) => {
            const on = value.embeddings.includes(n);
            return (
              <button
                className={
                  on
                    ? "rounded-md bg-foreground px-2 py-1 text-[11px] text-background"
                    : "rounded-md border border-border px-2 py-1 text-[11px]"
                }
                key={n}
                onClick={() =>
                  patch({
                    embeddings: on
                      ? value.embeddings.filter((x) => x !== n)
                      : [...value.embeddings, n],
                  })
                }
                type="button"
              >
                {n}
              </button>
            );
          })}
        </div>
      )}

      <SectionHead>IP-Adapter (참조 이미지)</SectionHead>
      {value.refImage ? (
        <div className="flex items-center gap-2">
          {/* biome-ignore lint/performance/noImgElement: local data URL preview */}
          <img
            alt=""
            className="size-14 rounded-md object-cover"
            src={value.refImage}
          />
          <Button
            onClick={() => patch({ refImage: null })}
            size="sm"
            type="button"
            variant="ghost"
          >
            제거
          </Button>
        </div>
      ) : (
        <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12px]">
          <UploadIcon className="size-3.5" />
          참조 이미지 업로드
          <input
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => uploadRef(e.target.files?.[0])}
            type="file"
          />
        </label>
      )}
      {value.refImage ? (
        <Field label={`강도 ${value.refScale.toFixed(2)}`}>
          <input
            max={1.2}
            min={0.2}
            onChange={(e) => patch({ refScale: Number(e.target.value) })}
            step={0.05}
            type="range"
            value={value.refScale}
          />
        </Field>
      ) : null}

      <SectionHead>Hires Fix</SectionHead>
      <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
        <span className="text-[13px]">활성화</span>
        <Switch
          checked={value.hrEnabled}
          onCheckedChange={(v) => patch({ hrEnabled: v })}
        />
      </div>
      {value.hrEnabled ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={`업스케일 ${value.hrScale.toFixed(2)}×`}>
            <input
              max={2}
              min={1}
              onChange={(e) => patch({ hrScale: Number(e.target.value) })}
              step={0.1}
              type="range"
              value={value.hrScale}
            />
          </Field>
          <Field label={`denoising ${value.hrDenoising.toFixed(2)}`}>
            <input
              max={0.9}
              min={0.1}
              onChange={(e) => patch({ hrDenoising: Number(e.target.value) })}
              step={0.05}
              type="range"
              value={value.hrDenoising}
            />
          </Field>
        </div>
      ) : null}
    </>
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
