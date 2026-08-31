"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import equal from "fast-deep-equal";
import {
  ArrowUpIcon,
  BrainIcon,
  EyeIcon,
  LockIcon,
  WrenchIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { useActiveChat } from "@/hooks/use-active-chat";
import {
  type ChatModel,
  chatModels,
  DEFAULT_CHAT_MODEL,
  DEFAULT_EFFORT_LEVEL,
  DEFAULT_GLM_EFFORT_LEVEL,
  EFFORT_LEVELS,
  type EffortLevel,
  GLM_EFFORT_LEVELS,
  type ModelCapabilities,
} from "@/lib/ai/models";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn, fetcher } from "@/lib/utils";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "../ai-elements/prompt-input";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { PaperclipIcon, StopIcon } from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import {
  type SlashCommand,
  SlashCommandMenu,
  slashCommands,
} from "./slash-commands";
import type { VisibilityType } from "./visibility-selector";

function setCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365;
  // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}`;
}

// Typing this in the project view's planning chat (e.g. "노트 작성해줘",
// "노트정리해줘") triggers the meeting notes generation directly instead of
// being sent to the model as a normal chat message.
const NOTE_TRIGGER_PATTERN = /^노트\s*(작성|정리)/;

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  setMessages,
  sendMessage,
  className,
  selectedModelId,
  onModelChange,
  selectedEffort,
  onEffortChange,
  editingMessage,
  onCancelEdit,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: UIMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage:
    | UseChatHelpers<ChatMessage>["sendMessage"]
    | (() => Promise<void>);
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  selectedEffort?: EffortLevel;
  onEffortChange?: (effort: EffortLevel) => void;
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
  isLoading?: boolean;
}) {
  const router = useRouter();
  const { isProjectView, projectId, onWriteNotes, isGeneratingNotes } =
    useActiveChat();

  const { data: usageData } = useSWR<{
    providers: { provider: string; hardLocked: boolean }[];
  }>("/api/usage", fetcher, { refreshInterval: 30_000 });
  let currentUsageProvider = "anthropic";
  if (selectedModelId.startsWith("glm/")) {
    currentUsageProvider = "glm";
  } else if (selectedModelId.startsWith("aichat/")) {
    currentUsageProvider = "aichat";
  }
  const providerHardLocked = Boolean(
    usageData?.providers?.find((p) => p.provider === currentUsageProvider)
      ?.hardLocked
  );
  const HARD_LOCK_MESSAGE =
    "한도에 도달하여 메시지를 전송할 수 없습니다. 한도 재설정이 필요합니다.";
  const { setTheme, resolvedTheme } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const hasAutoFocused = useRef(false);
  useEffect(() => {
    if (!hasAutoFocused.current && width) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
        hasAutoFocused.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [width]);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
    }
  }, [localStorageInput, setInput]);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);

  const handleInput = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const val = event.target.value;
      setInput(val);

      if (val.startsWith("/") && !val.includes(" ")) {
        setSlashOpen(true);
        setSlashQuery(val.slice(1));
        setSlashIndex(0);
      } else {
        setSlashOpen(false);
      }
    },
    [setInput]
  );

  const handleSlashSelect = useCallback(
    (cmd: SlashCommand) => {
      setSlashOpen(false);
      setInput("");
      switch (cmd.action) {
        case "new":
          router.push("/");
          break;
        case "clear":
          setMessages(() => []);
          break;
        case "rename":
          toast("이름 변경은 사이드바 대화 메뉴에서 할 수 있습니다.");
          break;
        case "model": {
          const modelBtn = document.querySelector<HTMLButtonElement>(
            "[data-testid='model-selector']"
          );
          modelBtn?.click();
          break;
        }
        case "theme":
          setTheme(resolvedTheme === "dark" ? "light" : "dark");
          break;
        case "delete":
          toast("이 대화를 삭제할까요?", {
            action: {
              label: "삭제",
              onClick: () => {
                fetch(
                  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat?id=${chatId}`,
                  { method: "DELETE" }
                );
                router.push("/");
                toast.success("대화가 삭제되었습니다");
              },
            },
          });
          break;
        case "purge":
          toast("전체 대화를 삭제할까요?", {
            action: {
              label: "전체 삭제",
              onClick: () => {
                fetch(
                  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history`,
                  {
                    method: "DELETE",
                  }
                );
                router.push("/");
                toast.success("모든 대화가 삭제되었습니다");
              },
            },
          });
          break;
        default:
          break;
      }
    },
    [chatId, resolvedTheme, router, setInput, setMessages, setTheme]
  );

  const submitForm = useCallback(() => {
    if (providerHardLocked) {
      toast.error(HARD_LOCK_MESSAGE);
      return;
    }
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const newUrl = isProjectView
      ? `${basePath}/project/${projectId}?chat=${chatId}`
      : `${basePath}/chat/${chatId}${window.location.search}`;
    window.history.pushState({}, "", newUrl);

    sendMessage({
      parts: [
        ...attachments.map((attachment) => ({
          mediaType: attachment.contentType,
          name: attachment.name,
          type: "file" as const,
          url: attachment.url,
        })),
        {
          text: input,
          type: "text",
        },
      ],
      role: "user",
    });

    setAttachments([]);
    setLocalStorageInput("");
    setInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    isProjectView,
    projectId,
    providerHardLocked,
  ]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/files/upload`,
        {
          body: formData,
          method: "POST",
        }
      );

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          contentType,
          name: pathname,
          url,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch {
      toast.error("파일 업로드에 실패했습니다. 다시 시도해주세요!");
    }
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch {
        toast.error("파일 업로드에 실패했습니다");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith("image/")
      );

      if (imageItems.length === 0) {
        return;
      }

      event.preventDefault();

      setUploadQueue((prev) => [...prev, "붙여넣은 이미지"]);

      try {
        const uploadPromises = imageItems
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null)
          .map((file) => uploadFile(file));

        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) =>
            attachment !== undefined &&
            attachment.url !== undefined &&
            attachment.contentType !== undefined
        );

        setAttachments((curr) => [
          ...curr,
          ...(successfullyUploadedAttachments as Attachment[]),
        ]);
      } catch {
        toast.error("붙여넣은 이미지 업로드에 실패했습니다");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.addEventListener("paste", handlePaste);
    return () => textarea.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleCancelEditMouseDown = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onCancelEdit?.();
    },
    [onCancelEdit]
  );

  const handleSlashClose = useCallback(() => {
    setSlashOpen(false);
  }, []);

  const handlePromptSubmit = useCallback(() => {
    if (input.startsWith("/")) {
      const query = input.slice(1).trim();
      const cmd = slashCommands.find((c) => c.name === query);
      if (cmd) {
        handleSlashSelect(cmd);
      }
      return;
    }
    if (!input.trim() && attachments.length === 0) {
      return;
    }
    if (
      onWriteNotes &&
      !isGeneratingNotes &&
      NOTE_TRIGGER_PATTERN.test(input.trim())
    ) {
      onWriteNotes();
      setLocalStorageInput("");
      setInput("");
      return;
    }
    if (status === "ready" || status === "error") {
      submitForm();
    } else {
      toast.error("모델의 응답이 끝날 때까지 기다려주세요!");
    }
  }, [
    attachments.length,
    handleSlashSelect,
    input,
    status,
    submitForm,
    onWriteNotes,
    isGeneratingNotes,
    setInput,
    setLocalStorageInput,
  ]);

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (slashOpen) {
        const filtered = slashCommands.filter((cmd) =>
          cmd.name.startsWith(slashQuery.toLowerCase())
        );
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashIndex((i) => Math.min(i + 1, filtered.length - 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          if (filtered[slashIndex]) {
            handleSlashSelect(filtered[slashIndex]);
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlashOpen(false);
          return;
        }
      }
      if (e.key === "Escape" && editingMessage && onCancelEdit) {
        e.preventDefault();
        onCancelEdit();
      }
    },
    [
      editingMessage,
      handleSlashSelect,
      onCancelEdit,
      slashIndex,
      slashOpen,
      slashQuery,
    ]
  );

  return (
    <div className={cn("relative flex w-full flex-col gap-4", className)}>
      {editingMessage && onCancelEdit ? (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span>Editing message</span>
          <button
            className="rounded px-1.5 py-0.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
            onMouseDown={handleCancelEditMouseDown}
            type="button"
          >
            Cancel
          </button>
        </div>
      ) : null}

      <input
        className="pointer-events-none fixed -top-4 -left-4 size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      <div className="relative">
        {slashOpen ? (
          <SlashCommandMenu
            onClose={handleSlashClose}
            onSelect={handleSlashSelect}
            query={slashQuery}
            selectedIndex={slashIndex}
          />
        ) : null}
      </div>

      <PromptInput
        className="[&>div]:rounded-2xl [&>div]:border [&>div]:border-border/30 [&>div]:bg-card/70 [&>div]:shadow-[var(--shadow-composer)] [&>div]:transition-shadow [&>div]:duration-300 [&>div]:focus-within:shadow-[var(--shadow-composer-focus)]"
        onSubmit={handlePromptSubmit}
      >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            className="flex w-full self-start flex-row gap-2 overflow-x-auto px-3 pt-3 no-scrollbar"
            data-testid="attachments-preview"
          >
            {attachments.map((attachment) => (
              <AttachmentPreviewItem
                attachment={attachment}
                fileInputRef={fileInputRef}
                key={attachment.url}
                setAttachments={setAttachments}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                attachment={{
                  contentType: "",
                  name: filename,
                  url: "",
                }}
                isUploading={true}
                key={filename}
              />
            ))}
          </div>
        )}
        {providerHardLocked ? (
          <div className="mx-3 mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[12px] text-red-600 dark:text-red-400">
            {HARD_LOCK_MESSAGE}
          </div>
        ) : null}
        <PromptInputTextarea
          className="min-h-24 text-[13px] leading-relaxed px-4 pt-3.5 pb-1.5 placeholder:text-muted-foreground/35"
          data-testid="multimodal-input"
          onChange={handleInput}
          onKeyDown={handleTextareaKeyDown}
          placeholder={
            providerHardLocked
              ? HARD_LOCK_MESSAGE
              : editingMessage
                ? "메시지를 수정하세요..."
                : "무엇이든 물어보세요..."
          }
          ref={textareaRef}
          value={input}
        />
        <PromptInputFooter className="px-3 pb-3">
          <PromptInputTools>
            <AttachmentsButton
              fileInputRef={fileInputRef}
              selectedModelId={selectedModelId}
              status={status}
            />
            <ModelSelectorCompact
              onModelChange={onModelChange}
              selectedModelId={selectedModelId}
            />
            {selectedModelId.startsWith("anthropic/") && (
              <EffortSelector
                defaultLevel={DEFAULT_EFFORT_LEVEL}
                levels={EFFORT_LEVELS}
                onEffortChange={onEffortChange}
                selectedEffort={selectedEffort}
              />
            )}
            {selectedModelId.startsWith("glm/") && (
              <EffortSelector
                defaultLevel={DEFAULT_GLM_EFFORT_LEVEL}
                levels={GLM_EFFORT_LEVELS}
                onEffortChange={onEffortChange}
                selectedEffort={selectedEffort}
              />
            )}
          </PromptInputTools>

          {status === "submitted" ? (
            <StopButton setMessages={setMessages} stop={stop} />
          ) : (
            <PromptInputSubmit
              className={cn(
                "h-7 w-7 rounded-xl transition-all duration-200",
                input.trim()
                  ? "bg-foreground text-background hover:opacity-85 active:scale-95"
                  : "bg-muted text-muted-foreground/25 cursor-not-allowed"
              )}
              data-testid="send-button"
              disabled={
                !input.trim() || uploadQueue.length > 0 || providerHardLocked
              }
              status={status}
              variant="secondary"
            >
              <ArrowUpIcon className="size-4" />
            </PromptInputSubmit>
          )}
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (!equal(prevProps.attachments, nextProps.attachments)) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.selectedModelId !== nextProps.selectedModelId) {
      return false;
    }
    if (prevProps.selectedEffort !== nextProps.selectedEffort) {
      return false;
    }
    if (prevProps.editingMessage !== nextProps.editingMessage) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.messages.length !== nextProps.messages.length) {
      return false;
    }

    return true;
  }
);

function PureAttachmentPreviewItem({
  attachment,
  fileInputRef,
  setAttachments,
}: {
  attachment: Attachment;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
}) {
  const handleRemove = useCallback(() => {
    setAttachments((currentAttachments) =>
      currentAttachments.filter((a) => a.url !== attachment.url)
    );
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [attachment.url, fileInputRef, setAttachments]);

  return <PreviewAttachment attachment={attachment} onRemove={handleRemove} />;
}

const AttachmentPreviewItem = memo(PureAttachmentPreviewItem);

function PureAttachmentsButton({
  fileInputRef,
  status,
  selectedModelId,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  selectedModelId: string;
}) {
  const { data: modelsResponse } = useSWR(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/models`,
    (url: string) => fetch(url).then((r) => r.json()),
    { dedupingInterval: 3_600_000, revalidateOnFocus: false }
  );

  const caps: Record<string, ModelCapabilities> | undefined =
    modelsResponse?.capabilities ?? modelsResponse;
  const hasVision = caps?.[selectedModelId]?.vision ?? false;
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      fileInputRef.current?.click();
    },
    [fileInputRef]
  );

  return (
    <Button
      className={cn(
        "h-7 w-7 rounded-lg border border-border/40 p-1 transition-colors",
        hasVision
          ? "text-foreground hover:border-border hover:text-foreground"
          : "text-muted-foreground/30 cursor-not-allowed"
      )}
      data-testid="attachments-button"
      disabled={status !== "ready" || !hasVision}
      onClick={handleClick}
      variant="ghost"
    >
      <PaperclipIcon size={14} style={{ height: 14, width: 14 }} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function ModelSelectorOption({
  capabilities,
  curated,
  model,
  onModelChange,
  selectedModelId,
  setOpen,
}: {
  capabilities: Record<string, ModelCapabilities> | undefined;
  curated: boolean;
  model: ChatModel;
  onModelChange?: (modelId: string) => void;
  selectedModelId: string;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const [logoProvider] = model.id.split("/");
  const maybeWithTooltip = (icon: ReactNode, label: string) => {
    if (!curated) {
      return icon;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{icon}</span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  };
  const handleSelect = useCallback(() => {
    if (!curated) {
      return;
    }
    onModelChange?.(model.id);
    setCookie("chat-model", model.id);
    setOpen(false);
    setTimeout(() => {
      document
        .querySelector<HTMLTextAreaElement>("[data-testid='multimodal-input']")
        ?.focus();
    }, 50);
  }, [curated, model.id, onModelChange, setOpen]);

  const option = (
    <ModelSelectorItem
      aria-disabled={!curated}
      className={cn(
        "flex w-full transition-colors",
        model.id === selectedModelId &&
          "border-b border-dashed border-foreground/50",
        curated
          ? "data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
          : "cursor-not-allowed opacity-40 data-[selected=true]:bg-transparent data-[selected=true]:opacity-60 data-[selected=true]:ring-1 data-[selected=true]:ring-muted-foreground/30 data-[selected=true]:ring-inset"
      )}
      onSelect={handleSelect}
      value={model.id}
    >
      <ModelSelectorLogo provider={logoProvider} />
      <ModelSelectorName>{model.name}</ModelSelectorName>
      <div className="ml-auto flex items-center gap-2 text-foreground/70">
        {capabilities?.[model.id]?.tools
          ? maybeWithTooltip(
              <WrenchIcon className="size-3.5" />,
              "Supports tool use"
            )
          : null}
        {capabilities?.[model.id]?.vision
          ? maybeWithTooltip(
              <EyeIcon className="size-3.5" />,
              "Supports vision"
            )
          : null}
        {capabilities?.[model.id]?.reasoning
          ? maybeWithTooltip(
              <BrainIcon className="size-3.5" />,
              "Supports reasoning"
            )
          : null}
        {!curated && <LockIcon className="size-3 text-muted-foreground/50" />}
      </div>
    </ModelSelectorItem>
  );

  if (curated) {
    return option;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="w-full cursor-not-allowed">{option}</div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        This model is not available in the demo.
      </TooltipContent>
    </Tooltip>
  );
}

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: modelsData } = useSWR(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/models`,
    (url: string) => fetch(url).then((r) => r.json()),
    { dedupingInterval: 3_600_000, revalidateOnFocus: false }
  );

  const capabilities: Record<string, ModelCapabilities> | undefined =
    modelsData?.capabilities ?? modelsData;
  const dynamicModels: ChatModel[] | undefined = modelsData?.models;
  const activeModels = dynamicModels ?? chatModels;

  const selectedModel =
    activeModels.find((m: ChatModel) => m.id === selectedModelId) ??
    activeModels.find((m: ChatModel) => m.id === DEFAULT_CHAT_MODEL) ??
    activeModels[0];
  const [provider] = selectedModel.id.split("/");

  return (
    <ModelSelector onOpenChange={setOpen} open={open}>
      <ModelSelectorTrigger asChild>
        <Button
          className="h-7 max-w-[200px] justify-between gap-1.5 rounded-lg px-2 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          data-testid="model-selector"
          variant="ghost"
        >
          {provider ? <ModelSelectorLogo provider={provider} /> : null}
          <ModelSelectorName>{selectedModel.name}</ModelSelectorName>
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent commandDefaultValue={selectedModel.id}>
        <ModelSelectorInput placeholder="모델 검색..." />
        <ModelSelectorList>
          {(() => {
            const curatedIds = new Set(chatModels.map((m) => m.id));
            const allModels = dynamicModels
              ? [
                  ...chatModels,
                  ...dynamicModels.filter((m) => !curatedIds.has(m.id)),
                ]
              : chatModels;

            const grouped: Record<
              string,
              { model: ChatModel; curated: boolean }[]
            > = {};
            for (const model of allModels) {
              const key = curatedIds.has(model.id)
                ? "_available"
                : model.provider;
              if (!grouped[key]) {
                grouped[key] = [];
              }
              grouped[key].push({ curated: curatedIds.has(model.id), model });
            }

            const sortedKeys = Object.keys(grouped).sort((a, b) => {
              if (a === "_available") {
                return -1;
              }
              if (b === "_available") {
                return 1;
              }
              return a.localeCompare(b);
            });

            const providerNames: Record<string, string> = {
              alibaba: "Alibaba",
              anthropic: "Anthropic",
              "arcee-ai": "Arcee AI",
              bytedance: "ByteDance",
              cohere: "Cohere",
              deepseek: "DeepSeek",
              google: "Google",
              inception: "Inception",
              kwaipilot: "Kwaipilot",
              meituan: "Meituan",
              meta: "Meta",
              minimax: "MiniMax",
              mistral: "Mistral",
              moonshotai: "Moonshot",
              morph: "Morph",
              nvidia: "Nvidia",
              openai: "OpenAI",
              perplexity: "Perplexity",
              "prime-intellect": "Prime Intellect",
              xai: "xAI",
              xiaomi: "Xiaomi",
              zai: "Zai",
            };

            return sortedKeys.map((key) => (
              <ModelSelectorGroup
                heading={
                  key === "_available"
                    ? "Available"
                    : (providerNames[key] ?? key)
                }
                key={key}
              >
                {grouped[key].map(({ model, curated }) => (
                  <ModelSelectorOption
                    capabilities={capabilities}
                    curated={curated}
                    key={model.id}
                    model={model}
                    onModelChange={onModelChange}
                    selectedModelId={selectedModel.id}
                    setOpen={setOpen}
                  />
                ))}
              </ModelSelectorGroup>
            ));
          })()}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}

const ModelSelectorCompact = memo(PureModelSelectorCompact);

const EFFORT_LABELS: Record<EffortLevel, string> = {
  high: "높음",
  low: "낮음",
  max: "최대",
  medium: "보통",
  xhigh: "매우 높음",
};

function PureEffortSelector({
  levels,
  defaultLevel,
  selectedEffort,
  onEffortChange,
}: {
  levels: readonly EffortLevel[];
  defaultLevel: EffortLevel;
  selectedEffort?: EffortLevel;
  onEffortChange?: (effort: EffortLevel) => void;
}) {
  const isValidForLevels = selectedEffort && levels.includes(selectedEffort);

  useEffect(() => {
    if (!isValidForLevels) {
      onEffortChange?.(defaultLevel);
    }
  }, [isValidForLevels, defaultLevel, onEffortChange]);

  const handleValueChange = useCallback(
    (value: string) => {
      onEffortChange?.(value as EffortLevel);
    },
    [onEffortChange]
  );

  return (
    <Select
      onValueChange={handleValueChange}
      value={isValidForLevels ? selectedEffort : defaultLevel}
    >
      <SelectTrigger
        className="h-7 max-w-[110px] gap-1 rounded-lg border-none px-2 text-[12px] text-muted-foreground shadow-none hover:text-foreground"
        data-testid="effort-selector"
        size="sm"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {levels.map((level) => (
          <SelectItem key={level} value={level}>
            {EFFORT_LABELS[level]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const EffortSelector = memo(PureEffortSelector);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      stop();
      setMessages((messages) => messages);
    },
    [setMessages, stop]
  );

  return (
    <Button
      className="h-7 w-7 rounded-xl bg-foreground p-1 text-background transition-all duration-200 hover:opacity-85 active:scale-95 disabled:bg-muted disabled:text-muted-foreground/25 disabled:cursor-not-allowed"
      data-testid="stop-button"
      onClick={handleClick}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);
