"use client";

import {
  DicesIcon,
  ImageIcon,
  LockIcon,
  SlidersHorizontalIcon,
  StarIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import {
  ExpertPanel,
  type ExpertSettings,
} from "@/components/imagie/generate/expert-panel";
import { FavoritePromptModal } from "@/components/imagie/generate/favorite-prompt-modal";
import { ImagicianChat } from "@/components/imagie/generate/imagician-chat";
import { PromptFieldsEditor } from "@/components/imagie/generate/prompt-fields";
import { RunpodBadge } from "@/components/imagie/generate/runpod-badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type AdvancedSettings,
  advancedMetadata,
  applyAdvancedToParams,
  EMPTY_ADVANCED,
  fileToDataUrl,
} from "@/lib/imagie/advanced";
import {
  IMAGICIAN_MODEL_MAP,
  type ImagicianResult,
} from "@/lib/imagie/imagician";
import {
  type GenerateParams,
  generateImage,
  getModels,
  getPreview,
  getProgress,
  loadModel,
} from "@/lib/imagie/imagie-client";
import {
  getDefaultModel,
  getExpertMode,
  getImagician,
  getSizePresets,
  setDefaultModel,
  setExpertMode,
  setImagician,
} from "@/lib/imagie/local-settings";
import { resolveRecommended } from "@/lib/imagie/model-catalog";
import {
  DEFAULT_NEGATIVE,
  EMPTY_PROMPT_FIELDS,
  isPromptEmpty,
  joinPromptFields,
  type PromptFields,
} from "@/lib/imagie/prompt";
import { ensureGenerateReady } from "@/lib/imagie/runpod-control";
import { fetcher, generateUUID } from "@/lib/utils";

type ConfigResp = {
  imagieBaseUrl: string | null;
  podId: string | null;
  hasRunpodKey: boolean;
};
type FoldersResp = {
  folders: Array<{ id: string; name: string; isSystem: boolean }>;
};
type ModelDetail = { name: string; type?: string; prediction?: string };

type ResultImage = {
  id: string;
  /** DB row id once auto-save has persisted it (for the "저장" move). */
  dbId: string | null;
  batchId: string;
  src: string;
  thumb: string;
  seed: number | null;
  saved: boolean;
};

const CFG_KEY = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/imagie/config`;
const FOLDERS_KEY = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/imagie/folders`;

// canvas downscale — max 640px long edge, JPEG q0.8 (spec §2).
function makeThumb(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 640 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function GenerateView() {
  const { data: config } = useSWR<ConfigResp>(CFG_KEY, fetcher);
  const { data: foldersResp, mutate: mutateFolders } = useSWR<FoldersResp>(
    FOLDERS_KEY,
    fetcher
  );
  const baseUrl = config?.imagieBaseUrl ?? null;

  const [models, setModels] = useState<string[]>([]);
  const [modelDetail, setModelDetail] = useState<ModelDetail[]>([]);
  const [modelName, setModelNameState] = useState("");

  const [fields, setFields] = useState<PromptFields>(EMPTY_PROMPT_FIELDS);
  const [negative, setNegative] = useState(DEFAULT_NEGATIVE);
  const [sizePresetId, setSizePresetId] = useState("");
  const [batchCount, setBatchCount] = useState(1);
  const [seedMode, setSeedMode] = useState<"random" | "fixed">("random");
  const [seedText, setSeedText] = useState("0");

  const [expert, setExpert] = useState(false);
  const [expertOpen, setExpertOpen] = useState(false);
  const [expertSettings, setExpertSettings] = useState<ExpertSettings>({
    cfg: 7,
    height: 1024,
    safetyCheck: false,
    sampler: "DPM++ 2M Karras",
    steps: 28,
    width: 1024,
  });

  const [advanced, setAdvanced] = useState<AdvancedSettings>(EMPTY_ADVANCED);
  const [imagician, setImagicianOn] = useState(false);

  const [favOpen, setFavOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [results, setResults] = useState<ResultImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveFolderId, setSaveFolderId] = useState("");
  const badgeBump = useRef(0);

  const presets = useMemo(() => getSizePresets(), []);

  useEffect(() => {
    setExpert(getExpertMode());
    setImagicianOn(getImagician());
  }, []);

  // "이 설정으로 다시 생성" from the gallery drops values here via sessionStorage.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("imagie.prefill");
      if (!raw) {
        return;
      }
      sessionStorage.removeItem("imagie.prefill");
      const p = JSON.parse(raw) as {
        prompt?: string;
        negativePrompt?: string;
        modelName?: string;
      };
      if (p.prompt) {
        setFields((f) => ({ ...f, background: p.prompt ?? "" }));
      }
      if (p.negativePrompt) {
        setNegative(p.negativePrompt);
      }
      if (p.modelName) {
        setModelNameState(p.modelName);
      }
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    if (!sizePresetId && presets[0]) {
      setSizePresetId(presets[0].id);
    }
  }, [presets, sizePresetId]);

  // Load the model list once the pod URL is known.
  useEffect(() => {
    if (!baseUrl) {
      return;
    }
    let cancelled = false;
    getModels(baseUrl)
      .then((r) => {
        if (cancelled) {
          return;
        }
        setModels(r.models);
        setModelDetail(r.detail ?? []);
        const saved = getDefaultModel();
        const pick =
          (saved && r.models.includes(saved) && saved) ||
          r.loaded_model ||
          r.models[0] ||
          "";
        setModelNameState(pick);
      })
      .catch(() => {
        // pod probably off — the badge covers messaging
      });
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  const setModelName = useCallback((name: string) => {
    setModelNameState(name);
    setDefaultModel(name);
  }, []);

  const toggleExpert = useCallback((on: boolean) => {
    setExpert(on);
    setExpertMode(on);
  }, []);

  const toggleImagician = useCallback((on: boolean) => {
    setImagicianOn(on);
    setImagician(on);
  }, []);

  const applyImagician = useCallback(
    (p: NonNullable<ImagicianResult["proposal"]>) => {
      setFields({
        artist: p.fields.artist,
        background: p.fields.background,
        characters:
          p.fields.characters.length > 0
            ? p.fields.characters
            : EMPTY_PROMPT_FIELDS.characters,
        composition: p.fields.composition,
        pose: p.fields.pose,
      });
      if (p.negativePrompt) {
        setNegative(p.negativePrompt);
      }
      setModelName(IMAGICIAN_MODEL_MAP[p.style]);
      setBatchCount(p.batch);
      toggleImagician(false);
    },
    [setModelName, toggleImagician]
  );

  const modelInfo = useMemo(
    () => modelDetail.find((m) => m.name === modelName),
    [modelDetail, modelName]
  );
  const recommended = useMemo(
    () => resolveRecommended(modelName, modelInfo),
    [modelName, modelInfo]
  );
  const samplingLocked = recommended.vPred;

  const applyFavorite = useCallback((prompt: string, neg: string) => {
    // A saved favorite is a flat string — drop it into the background field
    // so nothing structured is lost, and set the negative.
    setFields((f) => ({ ...f, background: prompt }));
    setNegative(neg || DEFAULT_NEGATIVE);
  }, []);

  const runGenerate = useCallback(async () => {
    if (isPromptEmpty(fields)) {
      toast.error("프롬프트를 입력하세요");
      return;
    }
    if (!(baseUrl && modelName)) {
      toast.error("Pod과 모델을 먼저 준비하세요 (설정 탭)");
      return;
    }

    const preset = presets.find((p) => p.id === sizePresetId) ?? presets[0];
    const width = expert ? expertSettings.width : preset.width;
    const height = expert ? expertSettings.height : preset.height;

    const params: GenerateParams = {
      batch_size: batchCount,
      height,
      model_name: modelName,
      negative_prompt: negative,
      prompt: joinPromptFields(fields),
      width,
    };
    if (seedMode === "fixed") {
      params.seed = Number(seedText) || 0;
    }
    if (recommended.vPred) {
      // backend forces sampling for v-pred; still needs a nominal cfg field
      params.guidance_scale = 5;
    } else {
      params.guidance_scale = expert ? expertSettings.cfg : recommended.cfg;
      params.steps = expert ? expertSettings.steps : recommended.steps;
      params.sampler = expert ? expertSettings.sampler : recommended.sampler;
    }
    if (expert && expertSettings.safetyCheck) {
      params.safety_check = true;
    }
    const finalParams = applyAdvancedToParams(params, advanced);

    setGenerating(true);
    setPreviewSrc(null);
    setStatusLine("Pod 준비 중…");
    let poll: ReturnType<typeof setInterval> | null = null;
    try {
      badgeBump.current += 1;
      await ensureGenerateReady((phase) => {
        const map: Record<string, string> = {
          booting: "Pod 부팅 중…",
          ready: "생성 준비 완료",
          starting: "Pod 시작 요청 중…",
          "waiting-backend": "백엔드 응답 대기 중…",
        };
        setStatusLine(map[phase] ?? null);
      });
      badgeBump.current += 1;

      // best-effort: make sure the chosen model is the resident one
      await loadModel(baseUrl, modelName).catch(() => undefined);

      setStatusLine("생성 중…");
      poll = setInterval(async () => {
        try {
          const [pr, pv] = await Promise.all([
            getProgress(baseUrl),
            getPreview(baseUrl),
          ]);
          if (pr.active) {
            setStatusLine(
              `생성 중… ${pr.batch_index + 1}/${pr.batch_total} · ${pr.percent}%`
            );
          }
          if (pv.image) {
            setPreviewSrc(`data:image/jpeg;base64,${pv.image}`);
          }
        } catch {
          // ignore transient poll errors
        }
      }, 1200);

      const res = await generateImage(baseUrl, finalParams);
      if (poll) {
        clearInterval(poll);
        poll = null;
      }

      const batchId = generateUUID();
      const made: ResultImage[] = await Promise.all(
        res.images.map(async (b64, i) => {
          const src = `data:image/png;base64,${b64}`;
          const thumb = await makeThumb(src);
          return {
            batchId,
            dbId: null,
            id: generateUUID(),
            saved: false,
            seed: res.seeds[i] ?? null,
            src,
            thumb,
          };
        })
      );
      setResults((prev) => [...made, ...prev]);
      setSelectedId(made[0]?.id ?? null);
      setPreviewSrc(made[0]?.src ?? null);

      // auto-save to "임시"
      setStatusLine("저장 중…");
      const persistRes = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/imagie/images`,
        {
          body: JSON.stringify({
            images: made.map((m) => ({
              metadata: advancedMetadata(advanced),
              png: m.src,
              seed: m.seed,
              thumb: m.thumb,
            })),
            params: {
              guidanceScale: finalParams.guidance_scale ?? 0,
              height,
              modelName,
              negativePrompt: negative,
              prompt: finalParams.prompt,
              sampler: finalParams.sampler ?? "",
              steps: finalParams.steps ?? 0,
              width,
            },
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      );
      if (persistRes.ok) {
        const persisted = (await persistRes.json()) as {
          images: Array<{ id: string }>;
        };
        setResults((prev) =>
          prev.map((r) => {
            const idx = made.findIndex((m) => m.id === r.id);
            return idx >= 0 && persisted.images[idx]
              ? { ...r, dbId: persisted.images[idx].id }
              : r;
          })
        );
        await mutateFolders();
        toast.success(`${made.length}장 생성 · 임시 폴더에 저장됨`);
      } else {
        toast.warning("생성은 됐지만 저장에 실패했습니다");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "생성 실패");
    } finally {
      if (poll) {
        clearInterval(poll);
      }
      setGenerating(false);
      setStatusLine(null);
    }
  }, [
    fields,
    baseUrl,
    modelName,
    presets,
    sizePresetId,
    expert,
    expertSettings,
    batchCount,
    negative,
    seedMode,
    seedText,
    recommended,
    advanced,
    mutateFolders,
  ]);

  const selected = results.find((r) => r.id === selectedId) ?? null;

  const saveSelected = useCallback(async () => {
    if (!(selected?.dbId && saveFolderId)) {
      return;
    }
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/imagie/images/${selected.dbId}`,
        {
          body: JSON.stringify({ folderId: saveFolderId }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        }
      );
      if (!res.ok) {
        throw new Error("move failed");
      }
      setResults((prev) =>
        prev.map((r) => (r.id === selected.id ? { ...r, saved: true } : r))
      );
      await mutateFolders();
      toast.success("폴더에 저장했습니다");
    } catch {
      toast.error("저장 실패");
    }
  }, [selected, saveFolderId, mutateFolders]);

  const folders = foldersResp?.folders ?? [];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex items-center justify-between gap-3 border-border/50 border-b px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-[15px]">이미지 생성</h1>
          <RunpodBadge bump={badgeBump} />
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            i-magician
            <Switch checked={imagician} onCheckedChange={toggleImagician} />
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            전문가 모드
            <Switch checked={expert} onCheckedChange={toggleExpert} />
          </span>
          {expert ? (
            <Button
              onClick={() => setExpertOpen(true)}
              size="sm"
              variant="outline"
            >
              <SlidersHorizontalIcon className="size-4" />
              설정
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* form */}
        <div className="w-[440px] shrink-0 overflow-y-auto border-border/50 border-r p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[13px]">프롬프트</span>
              <Button
                onClick={() => setFavOpen(true)}
                size="sm"
                variant="ghost"
              >
                <StarIcon className="size-3.5" />
                즐겨찾기
              </Button>
            </div>
            {imagician ? <ImagicianChat onApply={applyImagician} /> : null}
            <PromptFieldsEditor onChange={setFields} value={fields} />

            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-[12px] text-muted-foreground">
                네거티브
              </span>
              <Textarea
                className="min-h-16 text-[12px]"
                onChange={(e) => setNegative(e.target.value)}
                value={negative}
              />
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="font-medium text-[12px] text-muted-foreground">
                모델
              </span>
              <select
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                onChange={(e) => setModelName(e.target.value)}
                value={modelName}
              >
                {models.length === 0 ? (
                  <option value="">(Pod 켜면 목록 로드)</option>
                ) : null}
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                {samplingLocked ? (
                  <>
                    <LockIcon className="size-3" />
                    모델 고정 (Euler / v-pred)
                  </>
                ) : expert ? (
                  `전문가 값: ${expertSettings.sampler} · ${expertSettings.steps} steps · CFG ${expertSettings.cfg}`
                ) : (
                  `자동: ${recommended.sampler} · ${recommended.steps} steps · CFG ${recommended.cfg}`
                )}
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="font-medium text-[12px] text-muted-foreground">
                  크기
                </span>
                <select
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-foreground/40 disabled:opacity-50"
                  disabled={expert}
                  onChange={(e) => setSizePresetId(e.target.value)}
                  value={sizePresetId}
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-medium text-[12px] text-muted-foreground">
                  배치 ({batchCount})
                </span>
                <input
                  max={20}
                  min={1}
                  onChange={(e) => setBatchCount(Number(e.target.value))}
                  type="range"
                  value={batchCount}
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <input
                  checked={seedMode === "fixed"}
                  onChange={(e) =>
                    setSeedMode(e.target.checked ? "fixed" : "random")
                  }
                  type="checkbox"
                />
                시드 고정
              </label>
              {seedMode === "fixed" ? (
                <input
                  className="w-32 rounded-lg border border-border bg-card px-2 py-1 text-[13px]"
                  onChange={(e) => setSeedText(e.target.value)}
                  type="number"
                  value={seedText}
                />
              ) : (
                <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                  <DicesIcon className="size-3.5" />
                  매번 랜덤
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-border/60 px-3 py-2">
              <span className="flex items-center justify-between text-[12px] text-muted-foreground">
                img2img
                <Switch
                  checked={advanced.img2imgEnabled}
                  onCheckedChange={(v) =>
                    setAdvanced((a) => ({ ...a, img2imgEnabled: v }))
                  }
                />
              </span>
              {advanced.img2imgEnabled ? (
                <>
                  {advanced.initImage ? (
                    <div className="flex items-center gap-2">
                      {/* biome-ignore lint/performance/noImgElement: local data URL preview */}
                      <img
                        alt=""
                        className="size-14 rounded-md object-cover"
                        src={advanced.initImage}
                      />
                      <Button
                        onClick={() =>
                          setAdvanced((a) => ({ ...a, initImage: null }))
                        }
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        제거
                      </Button>
                    </div>
                  ) : (
                    <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px]">
                      초안 이미지 업로드
                      <input
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) {
                            return;
                          }
                          try {
                            const url = await fileToDataUrl(file);
                            setAdvanced((a) => ({ ...a, initImage: url }));
                          } catch {
                            toast.error("이미지 읽기 실패");
                          }
                        }}
                        type="file"
                      />
                    </label>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    변형 강도 {advanced.denoiseStrength.toFixed(2)} (1 = 새로
                    생성에 가까움)
                  </span>
                  <input
                    max={0.95}
                    min={0.1}
                    onChange={(e) =>
                      setAdvanced((a) => ({
                        ...a,
                        denoiseStrength: Number(e.target.value),
                      }))
                    }
                    step={0.05}
                    type="range"
                    value={advanced.denoiseStrength}
                  />
                </>
              ) : null}
            </div>

            <Button
              className="h-11 text-[14px]"
              disabled={generating}
              onClick={runGenerate}
            >
              {generating ? (
                <>
                  <Spinner />
                  {statusLine ?? "생성 중…"}
                </>
              ) : (
                <>
                  <ImageIcon className="size-4" />
                  생성
                </>
              )}
            </Button>
          </div>
        </div>

        {/* preview + session strip */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center overflow-hidden bg-muted/30 p-4">
            {previewSrc ? (
              // biome-ignore lint/performance/noImgElement: data URL preview
              <img
                alt=""
                className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
                src={previewSrc}
              />
            ) : (
              <div className="text-center text-[13px] text-muted-foreground">
                {generating
                  ? (statusLine ?? "생성 중…")
                  : "생성 결과가 여기 표시됩니다"}
              </div>
            )}
          </div>

          <div className="border-border/50 border-t p-3">
            <div className="mb-2 flex items-center gap-2">
              <select
                className="rounded-lg border border-border bg-card px-2 py-1.5 text-[12px]"
                onChange={(e) => setSaveFolderId(e.target.value)}
                value={saveFolderId}
              >
                <option value="">폴더 선택…</option>
                {folders
                  .filter((f) => f.name !== "임시")
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
              <Button
                disabled={!(selected?.dbId && saveFolderId)}
                onClick={saveSelected}
                size="sm"
                variant="outline"
              >
                {selected?.saved ? "저장됨" : "저장"}
              </Button>
              <a
                className="text-[12px] text-muted-foreground underline"
                href="/imagie/gallery"
              >
                갤러리 열기
              </a>
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {results.map((r) => (
                <button
                  className={
                    r.id === selectedId
                      ? "size-16 shrink-0 overflow-hidden rounded-md ring-2 ring-primary"
                      : "size-16 shrink-0 overflow-hidden rounded-md ring-1 ring-border"
                  }
                  key={r.id}
                  onClick={() => {
                    setSelectedId(r.id);
                    setPreviewSrc(r.src);
                  }}
                  type="button"
                >
                  {/* biome-ignore lint/performance/noImgElement: data URL thumb */}
                  <img
                    alt=""
                    className="size-full object-cover"
                    src={r.thumb}
                  />
                </button>
              ))}
              {results.length === 0 ? (
                <span className="py-4 text-[12px] text-muted-foreground">
                  이번 세션 생성물
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <FavoritePromptModal
        currentNegative={negative}
        currentPrompt={joinPromptFields(fields)}
        onApply={applyFavorite}
        onOpenChange={setFavOpen}
        open={favOpen}
      />
      <ExpertPanel
        advanced={advanced}
        baseUrl={baseUrl}
        onAdvancedChange={setAdvanced}
        onChange={setExpertSettings}
        onOpenChange={setExpertOpen}
        open={expertOpen}
        samplingLocked={samplingLocked}
        value={expertSettings}
      />
    </div>
  );
}
