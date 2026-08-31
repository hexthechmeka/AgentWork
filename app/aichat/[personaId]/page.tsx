import { PencilIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { ContinueChatButton } from "@/components/aichat/continue-chat-button";
import { chatModels } from "@/lib/ai/models";
import { getLatestPersonaChat, getPersonaById } from "@/lib/db/queries";
import { convertToUIMessages, getTextFromMessage } from "@/lib/utils";

export default async function PersonaDetailPage({
  params,
}: {
  params: Promise<{ personaId: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const { personaId } = await params;
  const persona = await getPersonaById({ id: personaId });
  if (!persona || persona.ownerId !== session.user.id) {
    notFound();
  }

  const latest = await getLatestPersonaChat({
    personaId,
    userId: session.user.id,
  });
  const logMessages = latest ? convertToUIMessages(latest.messages) : [];
  const modelName =
    chatModels.find((m) => m.id === persona.defaultModel)?.name ??
    persona.defaultModel;
  const image = persona.panelImageUrl ?? persona.avatarUrl;

  return (
    <div className="h-dvh w-full overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-56">
            {image ? (
              // biome-ignore lint/performance/noImgElement: user-uploaded blob image
              <img
                alt=""
                className="aspect-[3/4] w-full object-cover"
                src={image}
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center text-3xl text-muted-foreground/40">
                {persona.name.slice(0, 2)}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <h1 className="font-bold text-2xl text-foreground tracking-tight">
                {persona.name}
              </h1>
              <Link
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                href={`/aichat/${persona.id}/edit`}
              >
                <PencilIcon className="size-3" />
                수정
              </Link>
            </div>
            {persona.tagline ? (
              <p className="text-[13px] text-muted-foreground">
                {persona.tagline}
              </p>
            ) : null}
            {persona.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {persona.tags.map((tag) => (
                  <span
                    className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                    key={tag}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-auto pt-3">
              <ContinueChatButton
                defaultModel={persona.defaultModel}
                existingChatId={latest?.chat.id ?? null}
                personaId={persona.id}
              />
            </div>
          </div>
        </div>

        <section className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/30 p-4">
          <h2 className="font-semibold text-[13px] text-foreground">설정</h2>
          <dl className="flex flex-col gap-2 text-[13px]">
            <div>
              <dt className="text-[11px] text-muted-foreground">기본 모델</dt>
              <dd className="text-foreground">{modelName}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">
                성격 / 시스템 프롬프트
              </dt>
              <dd className="whitespace-pre-wrap text-foreground/90">
                {persona.personality}
              </dd>
            </div>
            {persona.scenario ? (
              <div>
                <dt className="text-[11px] text-muted-foreground">상황</dt>
                <dd className="whitespace-pre-wrap text-foreground/90">
                  {persona.scenario}
                </dd>
              </div>
            ) : null}
            {persona.openingMessage ? (
              <div>
                <dt className="text-[11px] text-muted-foreground">
                  오프닝 메시지
                </dt>
                <dd className="whitespace-pre-wrap text-foreground/90">
                  {persona.openingMessage}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/30 p-4">
          <h2 className="font-semibold text-[13px] text-foreground">
            마지막 대화 로그
          </h2>
          {logMessages.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">
              아직 대화 기록이 없습니다.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {logMessages.map((m) => {
                const text = getTextFromMessage(m);
                if (!text.trim()) {
                  return null;
                }
                const preview =
                  text.length > 200 ? `${text.slice(0, 200)}…` : text;
                const speaker = m.role === "user" ? "나" : persona.name;
                return (
                  <div className="text-[12px] leading-relaxed" key={m.id}>
                    <span className="text-muted-foreground">{speaker}: </span>
                    <span className="text-foreground/85">{preview}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
