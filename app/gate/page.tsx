import { Suspense } from "react";

function GateForm({
  redirectUrl,
  error,
}: {
  redirectUrl: string;
  error?: string;
}) {
  return (
    <form
      action="/api/gate"
      className="flex w-full max-w-xs flex-col gap-3"
      method="post"
    >
      <h1 className="font-semibold text-foreground text-lg">잠금됨</h1>
      <p className="text-[13px] text-muted-foreground">
        접속하려면 비밀번호를 입력하세요.
      </p>
      <input name="redirectUrl" type="hidden" value={redirectUrl} />
      <input
        autoComplete="current-password"
        autoFocus
        className="h-10 rounded-lg border border-border bg-card px-3 text-[14px] text-foreground outline-none focus:border-foreground/40"
        name="password"
        placeholder="비밀번호"
        type="password"
      />
      {error ? (
        <p className="text-[12px] text-red-500">
          비밀번호가 올바르지 않습니다.
        </p>
      ) : null}
      <button
        className="h-10 rounded-lg bg-foreground font-medium text-[14px] text-background transition-opacity hover:opacity-90"
        type="submit"
      >
        입장
      </button>
    </form>
  );
}

async function GateFormWithParams({
  searchParams,
}: {
  searchParams: Promise<{ redirectUrl?: string; error?: string }>;
}) {
  const { redirectUrl = "/", error } = await searchParams;
  return <GateForm error={error} redirectUrl={redirectUrl} />;
}

export default function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ redirectUrl?: string; error?: string }>;
}) {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-background px-4">
      <Suspense fallback={<GateForm redirectUrl="/" />}>
        <GateFormWithParams searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
