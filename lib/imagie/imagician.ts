// i-magician (spec §7): an LLM prompt wizard. The user describes what they
// want in plain language; the model asks a follow-up or two, then emits a
// structured proposal in the SAME shape as the manual PromptFields form so
// nothing downstream has to special-case it.

import { z } from "zod";

// Style → model auto-switch (spec §7).
export const IMAGICIAN_MODEL_MAP = {
  anime: "WAI-NSFW-illustrious-SDXL v15.0",
  realistic: "SDXL 1.0",
} as const;

// i-magician path always uses this sampler (spec §7).
export const IMAGICIAN_SAMPLER = "DPM++ 2M Karras";

export const imagicianSchema = z.object({
  // True once `proposal` is filled and ready to drop into the form.
  done: z.boolean(),
  proposal: z
    .object({
      batch: z.number().int().min(1).max(8),
      fields: z.object({
        artist: z.string(),
        background: z.string(),
        characters: z
          .array(z.object({ appearance: z.string(), name: z.string() }))
          .min(1),
        composition: z.string(),
        pose: z.string(),
      }),
      negativePrompt: z.string(),
      style: z.enum(["realistic", "anime"]),
    })
    .nullable(),
  // Conversational message shown to the user this turn.
  reply: z.string(),
});

export type ImagicianResult = z.infer<typeof imagicianSchema>;

export const IMAGICIAN_SYSTEM = `너는 이미지 생성 프롬프트 마법사다. 사용자가 만들고 싶은 그림을 자연어로 말하면, 그걸 danbooru 태그 기반의 구조화된 프롬프트로 바꿔준다.

규칙:
- 사용자와 같은 언어로 대화한다(보통 한국어).
- 정보가 부족하면 딱 필요한 것만 한두 번 되묻는다. 불필요하게 질문을 늘리지 않는다.
- 사용자가 "아무거나", "알아서" 라고 하면 합리적으로 채우고 done=true 로 마무리한다.
- 충분히 파악되면 done=true, proposal 을 채운다. 그 전에는 done=false, proposal=null.
- proposal.fields 의 각 값은 **danbooru 태그를 쉼표로 나열한 문자열**이다. 문장으로 쓰지 않는다.
  - artist: 화풍/작가 태그 (없으면 "")
  - characters: 각 캐릭터의 { name: 이름/작품 태그, appearance: 외형·의상 태그 }. 최소 1명.
  - pose: 포즈·표정 태그
  - composition: 샷 타입·카메라 앵글 태그 (예: "upper body, from above")
  - background: 배경·조명·분위기 태그
- style: 실사면 "realistic", 애니/일러스트면 "anime". 사용자가 안 정했으면 물어보거나 내용에 맞게 정한다.
- negativePrompt: 해당 스타일에 맞는 표준 네거티브 태그 문자열.
- batch: 1~8. 사용자가 말 안 하면 1.
- reply 는 사용자에게 보여줄 짧은 대화체 메시지다(진행 상황/질문/요약).`;
