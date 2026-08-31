"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import { getAichatKey } from "./aichat-sidebar";

export function AichatProviders({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig();
  const onChatFinished = useCallback(() => {
    mutate(getAichatKey());
  }, [mutate]);

  return (
    <ActiveChatProvider onChatFinished={onChatFinished}>
      {children}
    </ActiveChatProvider>
  );
}
