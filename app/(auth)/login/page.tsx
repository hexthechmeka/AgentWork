"use client";

import {
  type AuthError,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { toast } from "@/components/chat/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFirebaseAuth, getGoogleProvider } from "@/lib/firebase/client";

function safeRedirect(raw: string | null) {
  if (raw?.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/";
}

async function exchangeIdTokenForSession(idToken: string) {
  const response = await fetch("/api/auth/session", {
    body: JSON.stringify({ idToken }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to establish session");
  }
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(
    searchParams.get("redirect") ?? searchParams.get("redirectUrl")
  );

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailFormOpen, setIsEmailFormOpen] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value),
    []
  );
  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value),
    []
  );
  const openEmailForm = useCallback(() => setIsEmailFormOpen(true), []);

  const finishLogin = useCallback(() => {
    router.push(redirectTo);
    router.refresh();
  }, [router, redirectTo]);

  const handleGoogleSignIn = useCallback(async () => {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithPopup(
        getFirebaseAuth(),
        getGoogleProvider()
      );
      const idToken = await result.user.getIdToken();
      await exchangeIdTokenForSession(idToken);
      finishLogin();
    } catch (error) {
      console.error("Google sign-in failed:", error);
      toast({ description: "로그인에 실패했습니다.", type: "error" });
    } finally {
      setIsGoogleLoading(false);
    }
  }, [finishLogin]);

  const handleEmailSignIn = useCallback(
    async (formEvent: React.FormEvent) => {
      formEvent.preventDefault();
      setIsEmailLoading(true);
      try {
        const result = await signInWithEmailAndPassword(
          getFirebaseAuth(),
          email,
          password
        );
        const idToken = await result.user.getIdToken();
        await exchangeIdTokenForSession(idToken);
        finishLogin();
      } catch (error) {
        const message =
          (error as AuthError).code === "auth/invalid-credential"
            ? "이메일 또는 비밀번호가 올바르지 않습니다."
            : "로그인에 실패했습니다.";
        toast({ description: message, type: "error" });
      } finally {
        setIsEmailLoading(false);
      }
    },
    [email, password, finishLogin]
  );

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">다시 오셨네요</h1>
      <p className="text-sm text-muted-foreground">
        계속하려면 Google 계정으로 로그인하세요
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <Button
          className="w-full"
          disabled={isGoogleLoading}
          onClick={handleGoogleSignIn}
          type="button"
        >
          {isGoogleLoading ? "로그인 중..." : "Google로 계속하기"}
        </Button>

        {isEmailFormOpen ? (
          <form className="flex flex-col gap-3" onSubmit={handleEmailSignIn}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">이메일</Label>
              <Input
                autoComplete="email"
                id="email"
                onChange={handleEmailChange}
                required
                type="email"
                value={email}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                autoComplete="current-password"
                id="password"
                onChange={handlePasswordChange}
                required
                type="password"
                value={password}
              />
            </div>
            <Button disabled={isEmailLoading} type="submit" variant="outline">
              {isEmailLoading ? "로그인 중..." : "이메일로 로그인"}
            </Button>
          </form>
        ) : (
          <button
            className="text-center text-[13px] text-muted-foreground underline-offset-4 hover:underline"
            onClick={openEmailForm}
            type="button"
          >
            관리자용 이메일 로그인
          </button>
        )}
      </div>
    </>
  );
}
