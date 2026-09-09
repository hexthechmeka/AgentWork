"use client";

import { Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  getSizePresets,
  setSizePresets as persistPresets,
} from "@/lib/imagie/local-settings";
import { type SizePreset, validateSize } from "@/lib/imagie/size-presets";
import { fetcher } from "@/lib/utils";

const SETTINGS_KEY = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/imagie/settings`;

export function SettingsView() {
  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-8">
        <h1 className="flex items-center gap-2 font-semibold text-foreground text-xl">
          <SidebarTrigger className="-ml-1" />
          Imagie 설정
        </h1>
        <ServerSection />
        <PresetsSection />
      </div>
    </div>
  );
}

function ServerSection() {
  const { data, mutate } = useSWR<{
    podId: string | null;
    hasRunpodKey: boolean;
  }>(SETTINGS_KEY, fetcher);
  const [podId, setPodId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

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
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-[14px]">서버 (RunPod)</h2>
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] text-muted-foreground">Pod ID</span>
        <Input
          onChange={(e) => setPodId(e.target.value)}
          placeholder="xxxx 또는 xxxx-8000.proxy.runpod.net"
          value={podId ?? data?.podId ?? ""}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] text-muted-foreground">RunPod API 키</span>
        <Input
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={
            data?.hasRunpodKey
              ? "설정됨 — 바꾸려면 새 키 입력"
              : "rest.runpod.io 계정 키 (전원 제어용)"
          }
          type="password"
          value={apiKey}
        />
      </div>
      <p className="text-[12px] text-muted-foreground">
        키는 서버에만 저장되며 브라우저로 다시 내려오지 않습니다. Pod ID는 전체
        URL을 붙여넣어도 자동으로 ID만 추출됩니다.
      </p>
      <Button className="w-fit" disabled={saving} onClick={save}>
        {saving ? "저장 중…" : "저장"}
      </Button>
    </section>
  );
}

function PresetsSection() {
  const [presets, setPresets] = useState<SizePreset[]>([]);
  const [label, setLabel] = useState("");
  const [w, setW] = useState("1024");
  const [h, setH] = useState("1024");

  useEffect(() => {
    setPresets(getSizePresets());
  }, []);

  const commit = useCallback((next: SizePreset[]) => {
    setPresets(next);
    persistPresets(next);
  }, []);

  const add = useCallback(() => {
    const width = Number(w);
    const height = Number(h);
    const err = validateSize(width, height);
    if (err) {
      toast.error(err);
      return;
    }
    commit([
      ...presets,
      {
        height,
        id: `p${Date.now()}`,
        label: label.trim() || `${width}×${height}`,
        width,
      },
    ]);
    setLabel("");
  }, [w, h, label, presets, commit]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-[14px]">크기 프리셋</h2>
      <div className="flex flex-col gap-1.5">
        {presets.map((p) => (
          <div
            className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-1.5 text-[13px]"
            key={p.id}
          >
            <span>
              {p.label}{" "}
              <span className="text-muted-foreground">
                ({p.width}×{p.height})
              </span>
            </span>
            <Button
              className="size-7"
              onClick={() => commit(presets.filter((x) => x.id !== p.id))}
              size="icon"
              variant="ghost"
            >
              <Trash2Icon className="size-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">별명</span>
          <Input
            className="h-8"
            onChange={(e) => setLabel(e.target.value)}
            value={label}
          />
        </div>
        <div className="flex w-20 flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">너비</span>
          <Input
            className="h-8"
            onChange={(e) => setW(e.target.value)}
            type="number"
            value={w}
          />
        </div>
        <div className="flex w-20 flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">높이</span>
          <Input
            className="h-8"
            onChange={(e) => setH(e.target.value)}
            type="number"
            value={h}
          />
        </div>
        <Button className="h-8" onClick={add} size="sm" variant="outline">
          추가
        </Button>
      </div>
    </section>
  );
}
