"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CharacterField, PromptFields } from "@/lib/imagie/prompt";

// Spec §6 — fixed field order: ① artist ② characters (repeatable)
// ③ pose/expression ④ composition ⑤ background/detail.
export function PromptFieldsEditor({
  value,
  onChange,
}: {
  value: PromptFields;
  onChange: (next: PromptFields) => void;
}) {
  const patch = useCallback(
    (p: Partial<PromptFields>) => onChange({ ...value, ...p }),
    [value, onChange]
  );

  const patchChar = useCallback(
    (i: number, p: Partial<CharacterField>) => {
      const characters = value.characters.map((c, idx) =>
        idx === i ? { ...c, ...p } : c
      );
      onChange({ ...value, characters });
    },
    [value, onChange]
  );

  const addChar = useCallback(() => {
    onChange({
      ...value,
      characters: [...value.characters, { appearance: "", name: "" }],
    });
  }, [value, onChange]);

  const removeChar = useCallback(
    (i: number) => {
      onChange({
        ...value,
        characters: value.characters.filter((_, idx) => idx !== i),
      });
    },
    [value, onChange]
  );

  return (
    <div className="flex flex-col gap-3">
      <Row label="① 아티스트 / 화풍">
        <Input
          onChange={(e) => patch({ artist: e.target.value })}
          placeholder="artist:xxx, official art, ..."
          value={value.artist ?? ""}
        />
      </Row>

      <div className="flex flex-col gap-2">
        <span className="font-medium text-[12px] text-muted-foreground">
          ② 캐릭터
        </span>
        {value.characters.map((c, i) => (
          <div
            className="flex flex-col gap-1.5 rounded-lg border border-border/60 p-2"
            // biome-ignore lint/suspicious/noArrayIndexKey: character rows have no stable id
            key={i}
          >
            <div className="flex items-center gap-2">
              <Input
                className="h-8"
                onChange={(e) => patchChar(i, { name: e.target.value })}
                placeholder="이름 / 작품 (예: ahri \(league of legends\))"
                value={c.name ?? ""}
              />
              {value.characters.length > 1 ? (
                <Button
                  className="size-8 shrink-0"
                  onClick={() => removeChar(i)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <XIcon className="size-4" />
                </Button>
              ) : null}
            </div>
            <Textarea
              className="min-h-16 text-[13px]"
              onChange={(e) => patchChar(i, { appearance: e.target.value })}
              placeholder="외형 / 의상 태그: 1girl, long hair, red dress, ..."
              value={c.appearance ?? ""}
            />
          </div>
        ))}
        <Button
          className="w-fit"
          onClick={addChar}
          size="sm"
          type="button"
          variant="outline"
        >
          <PlusIcon className="size-3.5" />
          캐릭터 추가
        </Button>
      </div>

      <Row label="③ 포즈 / 표정">
        <Input
          onChange={(e) => patch({ pose: e.target.value })}
          placeholder="standing, looking at viewer, smile, ..."
          value={value.pose ?? ""}
        />
      </Row>
      <Row label="④ 구도 (샷 타입 / 카메라 앵글)">
        <Input
          onChange={(e) => patch({ composition: e.target.value })}
          placeholder="upper body, from above, wide shot, ..."
          value={value.composition ?? ""}
        />
      </Row>
      <Row label="⑤ 배경 / 디테일">
        <Textarea
          className="min-h-16 text-[13px]"
          onChange={(e) => patch({ background: e.target.value })}
          placeholder="detailed background, sunset, cinematic lighting, ..."
          value={value.background ?? ""}
        />
      </Row>
    </div>
  );
}

function Row({
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
