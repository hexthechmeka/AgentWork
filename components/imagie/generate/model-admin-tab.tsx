"use client";

import { Trash2Icon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addFromUrl, addHfModel, deleteHfModel } from "@/lib/imagie/admin";
import { getModels } from "@/lib/imagie/imagie-client";

const selectClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-foreground/40";

type Row = {
  name: string;
  type?: string;
  source?: string;
  cached?: boolean;
  prediction?: string | null;
};

// "모델" tab inside the expert-settings panel — drives the Imagie backend's
// /api/admin catalog + file endpoints through our server proxy.
export function ModelAdminTab({ baseUrl }: { baseUrl: string | null }) {
  const { data, mutate, isLoading } = useSWR(
    baseUrl ? ["imagie-models", baseUrl] : null,
    ([, b]) => getModels(b)
  );
  const rows: Row[] = (data?.detail as Row[] | undefined) ?? [];

  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const removeHf = useCallback(
    async (name: string) => {
      setBusy(true);
      try {
        await deleteHfModel(name);
        await mutate();
        toast.success(`"${name}" 카탈로그에서 제거`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "삭제 실패");
      } finally {
        setBusy(false);
        setConfirm(null);
      }
    },
    [mutate]
  );

  if (!baseUrl) {
    return (
      <p className="mt-4 text-[12px] text-muted-foreground">
        Pod ID를 먼저 설정하세요 (서버 탭).
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <div className="font-medium text-[12px] text-muted-foreground">
          카탈로그 {isLoading ? "…" : `(${rows.length})`}
        </div>
        {rows.map((r) => (
          <div
            className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-[13px]"
            key={r.name}
          >
            <span className="flex-1 truncate">{r.name}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {r.source === "file" ? "file" : "hf"}
            </span>
            <span className="text-[11px] text-muted-foreground">{r.type}</span>
            {r.prediction === "v_prediction" ? (
              <span className="text-[10px] text-amber-600">v-pred</span>
            ) : null}
            {r.source === "file" ? (
              <span className="w-14 text-right text-[10px] text-muted-foreground/60">
                파일 삭제는 아래
              </span>
            ) : confirm === r.name ? (
              <Button
                className="h-6 px-2 text-[11px]"
                disabled={busy}
                onClick={() => removeHf(r.name)}
                size="sm"
                variant="destructive"
              >
                확인
              </Button>
            ) : (
              <Button
                className="size-6"
                onClick={() => setConfirm(r.name)}
                size="icon"
                variant="ghost"
              >
                <Trash2Icon className="size-3.5 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </section>

      <HfAddForm
        onAdded={() => {
          mutate();
        }}
      />
      <FromUrlForm />

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {/* TODO(imagie): signed direct multipart upload */}수 GB 파일 직접
        업로드는 아직 없음 — URL 추가를 쓰거나 팟에 직접 <code>curl</code>{" "}
        하세요. 체크포인트/캐시 완전 삭제는 “서버 탭 → 모델 목록”이 아닌 백엔드{" "}
        <code>/api/delete_model</code>.
      </p>
    </div>
  );
}

function HfAddForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState("");
  const [modelId, setModelId] = useState("");
  const [type, setType] = useState<"SD" | "SDXL" | "FLUX">("SDXL");
  const [vpred, setVpred] = useState(false);
  const [verify, setVerify] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    if (!(name.trim() && modelId.trim())) {
      toast.error("이름과 model_id는 필수");
      return;
    }
    setBusy(true);
    try {
      await addHfModel({
        model_id: modelId.trim(),
        name: name.trim(),
        prediction: vpred ? "v_prediction" : null,
        type,
        verify,
      });
      setName("");
      setModelId("");
      onAdded();
      toast.success("카탈로그에 추가됨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "추가 실패");
    } finally {
      setBusy(false);
    }
  }, [name, modelId, type, vpred, verify, onAdded]);

  return (
    <section className="flex flex-col gap-2 border-border/60 border-t pt-4">
      <div className="font-medium text-[12px] text-muted-foreground">
        HF 모델 추가
      </div>
      <Input
        onChange={(e) => setName(e.target.value)}
        placeholder="표시 이름 (예: Pony Diffusion V6 XL)"
        value={name}
      />
      <Input
        onChange={(e) => setModelId(e.target.value)}
        placeholder="model_id (org/repo)"
        value={modelId}
      />
      <div className="flex items-center gap-2">
        <select
          className={selectClass}
          onChange={(e) => setType(e.target.value as typeof type)}
          value={type}
        >
          <option value="SD">SD</option>
          <option value="SDXL">SDXL</option>
          <option value="FLUX">FLUX</option>
        </select>
        <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
          <input
            checked={vpred}
            onChange={(e) => setVpred(e.target.checked)}
            type="checkbox"
          />
          v-pred
        </label>
        <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
          <input
            checked={verify}
            onChange={(e) => setVerify(e.target.checked)}
            type="checkbox"
          />
          HF 확인
        </label>
      </div>
      <Button
        className="w-fit"
        disabled={busy}
        onClick={submit}
        size="sm"
        type="button"
      >
        {busy ? "추가 중…" : "추가"}
      </Button>
    </section>
  );
}

function FromUrlForm() {
  const [kind, setKind] = useState<"checkpoints" | "loras" | "embeddings">(
    "loras"
  );
  const [url, setUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    if (!(url.trim() && filename.trim())) {
      toast.error("URL과 파일명은 필수");
      return;
    }
    setBusy(true);
    toast.info("팟이 내려받는 중… 파일이 크면 몇 분 걸립니다");
    try {
      await addFromUrl({ filename: filename.trim(), kind, url: url.trim() });
      setUrl("");
      setFilename("");
      toast.success("추가됨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "다운로드 실패");
    } finally {
      setBusy(false);
    }
  }, [kind, url, filename]);

  return (
    <section className="flex flex-col gap-2 border-border/60 border-t pt-4">
      <div className="font-medium text-[12px] text-muted-foreground">
        URL로 파일 추가 (체크포인트 / LoRA / 임베딩)
      </div>
      <select
        className={selectClass}
        onChange={(e) => setKind(e.target.value as typeof kind)}
        value={kind}
      >
        <option value="checkpoints">checkpoint</option>
        <option value="loras">LoRA</option>
        <option value="embeddings">embedding</option>
      </select>
      <Input
        onChange={(e) => setUrl(e.target.value)}
        placeholder="다운로드 URL (직접 링크)"
        value={url}
      />
      <Input
        onChange={(e) => setFilename(e.target.value)}
        placeholder="저장 파일명 (예: myLora.safetensors)"
        value={filename}
      />
      <Button
        className="w-fit"
        disabled={busy}
        onClick={submit}
        size="sm"
        type="button"
      >
        {busy ? "받는 중…" : "추가"}
      </Button>
    </section>
  );
}
