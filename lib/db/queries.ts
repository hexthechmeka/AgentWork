import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  type SQL,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { OWNER_EMAIL } from "../constants";
import { ChatbotError } from "../errors";
import { generateUUID } from "../utils";
import {
  type Chat,
  chat,
  type DBMessage,
  document,
  message,
  type Persona,
  persona,
  project,
  providerLimit,
  type Suggestion,
  stream,
  suggestion,
  type User,
  usageEvent,
  user,
  vote,
} from "./schema";
import { generateHashedPassword } from "./utils";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

// Single-user private deployment: instead of minting a throwaway
// `guest-<timestamp>` user on every cookieless visit (which orphaned all
// chat history whenever the JWT cookie was absent — new browser, new PC,
// cleared cookies, 30-day expiry), resolve every anonymous session to one
// stable account keyed by OWNER_EMAIL. Same userId everywhere → history
// follows the user across devices with no login screen.
export async function getOrCreateOwnerUser() {
  try {
    const existing = await db
      .select({ email: user.email, id: user.id })
      .from(user)
      .where(eq(user.email, OWNER_EMAIL))
      .limit(1);

    if (existing.length > 0) {
      return existing;
    }

    const password = generateHashedPassword(generateUUID());
    const inserted = await db
      .insert(user)
      .values({ email: OWNER_EMAIL, password })
      .returning({ email: user.email, id: user.id });

    return inserted;
  } catch (error) {
    // Lost an insert race with a concurrent first request — the row now
    // exists, so just read it back.
    try {
      const existing = await db
        .select({ email: user.email, id: user.id })
        .from(user)
        .where(eq(user.email, OWNER_EMAIL))
        .limit(1);
      if (existing.length > 0) {
        return existing;
      }
    } catch {
      // fall through to the original error
    }
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function saveChat({
  id,
  userId,
  projectId,
  title,
  visibility,
  kind = "planning",
}: {
  id: string;
  userId: string;
  projectId: string | null;
  title: string;
  visibility: VisibilityType;
  kind?: "planning" | "unified";
}) {
  try {
    return await db.insert(chat).values({
      createdAt: new Date(),
      id,
      kind,
      projectId,
      title,
      userId,
      visibility,
    });
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function updateChatProjectById({
  chatId,
  projectId,
}: {
  chatId: string;
  projectId: string;
}) {
  try {
    return await db.update(chat).set({ projectId }).where(eq(chat.id, chatId));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getUnclassifiedChatsByUserId({
  userId,
}: {
  userId: string;
}) {
  try {
    return await db
      .select()
      .from(chat)
      .where(
        and(
          eq(chat.userId, userId),
          isNull(chat.projectId),
          isNull(chat.personaId)
        )
      )
      .orderBy(desc(chat.createdAt));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function createProject({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  try {
    const [createdProject] = await db
      .insert(project)
      .values({ name, userId })
      .returning();
    return createdProject;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getProjectById({ id }: { id: string }) {
  try {
    const [selectedProject] = await db
      .select()
      .from(project)
      .where(eq(project.id, id));
    return selectedProject ?? null;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getProjectWithChatsById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  try {
    const [[selectedProject], projectChats] = await Promise.all([
      db
        .select()
        .from(project)
        .where(and(eq(project.id, id), eq(project.userId, userId))),
      db
        .select()
        .from(chat)
        .where(eq(chat.projectId, id))
        .orderBy(desc(chat.createdAt)),
    ]);

    if (!selectedProject) {
      return null;
    }

    return { ...selectedProject, chats: projectChats };
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getProjectsWithChatsByUserId({
  userId,
}: {
  userId: string;
}) {
  try {
    const [userProjects, userChats] = await Promise.all([
      db
        .select()
        .from(project)
        .where(eq(project.userId, userId))
        .orderBy(desc(project.createdAt)),
      db
        .select()
        .from(chat)
        .where(eq(chat.userId, userId))
        .orderBy(desc(chat.createdAt)),
    ]);

    return userProjects.map((proj) => {
      const chatsInProject = userChats.filter((c) => c.projectId === proj.id);
      return {
        ...proj,
        chatCount: chatsInProject.length,
        chats: chatsInProject,
      };
    });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c) => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<unknown>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    return await db.update(message).set({ parts }).where(eq(message.id, id));
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        content,
        createdAt: new Date(),
        id,
        kind,
        title,
        userId,
      })
      .returning();
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function updateDocumentContent({
  id,
  content,
}: {
  id: string;
  content: string;
}) {
  try {
    const docs = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt))
      .limit(1);

    const [latest] = docs;
    if (!latest) {
      throw new ChatbotError("not_found:database", "Document not found");
    }

    return await db
      .update(document)
      .set({ content })
      .where(and(eq(document.id, id), eq(document.createdAt, latest.createdAt)))
      .returning();
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch {
    // Best effort title update.
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const cutoffTime = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, cutoffTime),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ chatId, createdAt: new Date(), id: streamId });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

// ─── Usage tracking & provider limits ──────────────────────────────────────

const USAGE_PROVIDERS = ["anthropic", "glm", "aichat"] as const;
export type UsageProvider = (typeof USAGE_PROVIDERS)[number];

export async function recordUsageEvent({
  userId,
  provider,
  modelId,
  inputTokens,
  outputTokens,
  cachedInputTokens,
  costUsd,
}: {
  userId: string;
  provider: UsageProvider;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
}) {
  try {
    await db.insert(usageEvent).values({
      cachedInputTokens: Math.round(cachedInputTokens),
      costUsd: costUsd.toFixed(8),
      inputTokens: Math.round(inputTokens),
      modelId,
      outputTokens: Math.round(outputTokens),
      provider,
      userId,
    });
  } catch (error) {
    // Usage logging must never break a chat turn.
    console.error("recordUsageEvent failed:", error);
  }
}

async function ensureProviderLimits(): Promise<void> {
  await db
    .insert(providerLimit)
    .values(USAGE_PROVIDERS.map((provider) => ({ provider })))
    .onConflictDoNothing();
}

export async function getProviderLimits() {
  await ensureProviderLimits();
  return db.select().from(providerLimit);
}

export async function setProviderLimit({
  provider,
  softLimitUsd,
  hardLimitUsd,
}: {
  provider: UsageProvider;
  softLimitUsd: number | null;
  hardLimitUsd: number | null;
}) {
  await ensureProviderLimits();
  await db
    .update(providerLimit)
    .set({
      hardLimitUsd: hardLimitUsd === null ? null : hardLimitUsd.toFixed(2),
      softLimitUsd: softLimitUsd === null ? null : softLimitUsd.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(providerLimit.provider, provider));
}

export async function resetProviderPeriod({
  provider,
}: {
  provider: UsageProvider;
}) {
  await ensureProviderLimits();
  await db
    .update(providerLimit)
    .set({ periodStart: new Date(), updatedAt: new Date() })
    .where(eq(providerLimit.provider, provider));
}

/** Total USD cost for one provider since its current period start. */
export async function getProviderPeriodCost({
  userId,
  provider,
  periodStart,
}: {
  userId: string;
  provider: UsageProvider;
  periodStart: Date;
}): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${usageEvent.costUsd}), 0)` })
    .from(usageEvent)
    .where(
      and(
        eq(usageEvent.userId, userId),
        eq(usageEvent.provider, provider),
        gte(usageEvent.createdAt, periodStart)
      )
    );
  return Number(row?.total ?? 0);
}

/**
 * Per-provider usage since period start: token totals, cost, the derived
 * hard-lock flag, and a daily cost series for the sparkline.
 */
export async function getUsageSummary({ userId }: { userId: string }) {
  const limits = await getProviderLimits();

  const perProvider = await Promise.all(
    limits.map(async (limit) => {
      const { periodStart } = limit;
      const provider = limit.provider as UsageProvider;

      const [totals] = await db
        .select({
          cachedInputTokens: sql<string>`coalesce(sum(${usageEvent.cachedInputTokens}), 0)`,
          costUsd: sql<string>`coalesce(sum(${usageEvent.costUsd}), 0)`,
          inputTokens: sql<string>`coalesce(sum(${usageEvent.inputTokens}), 0)`,
          outputTokens: sql<string>`coalesce(sum(${usageEvent.outputTokens}), 0)`,
        })
        .from(usageEvent)
        .where(
          and(
            eq(usageEvent.userId, userId),
            eq(usageEvent.provider, provider),
            gte(usageEvent.createdAt, periodStart)
          )
        );

      const costUsd = Number(totals?.costUsd ?? 0);
      const hardLimitUsd =
        limit.hardLimitUsd === null ? null : Number(limit.hardLimitUsd);
      const softLimitUsd =
        limit.softLimitUsd === null ? null : Number(limit.softLimitUsd);

      return {
        cachedInputTokens: Number(totals?.cachedInputTokens ?? 0),
        costUsd,
        hardLimitUsd,
        hardLocked:
          hardLimitUsd !== null && hardLimitUsd > 0 && costUsd >= hardLimitUsd,
        inputTokens: Number(totals?.inputTokens ?? 0),
        outputTokens: Number(totals?.outputTokens ?? 0),
        periodStart: periodStart.toISOString(),
        provider,
        softExceeded:
          softLimitUsd !== null && softLimitUsd > 0 && costUsd >= softLimitUsd,
        softLimitUsd,
      };
    })
  );

  return perProvider;
}

/** Backstop check used by the chat route before calling a provider. */
export async function isProviderHardLocked({
  userId,
  provider,
}: {
  userId: string;
  provider: UsageProvider;
}): Promise<boolean> {
  try {
    await ensureProviderLimits();
    const [limit] = await db
      .select()
      .from(providerLimit)
      .where(eq(providerLimit.provider, provider));

    if (!limit || limit.hardLimitUsd === null) {
      return false;
    }
    const hardLimitUsd = Number(limit.hardLimitUsd);
    if (hardLimitUsd <= 0) {
      return false;
    }

    const cost = await getProviderPeriodCost({
      periodStart: limit.periodStart,
      provider,
      userId,
    });
    return cost >= hardLimitUsd;
  } catch (error) {
    // Fail open — a metering hiccup shouldn't block all chat.
    console.error("isProviderHardLocked failed:", error);
    return false;
  }
}

// ─── AIchat: personas ─────────────────────────────────────────────────────

type PersonaInput = {
  name: string;
  personality: string;
  defaultModel: string;
  avatarUrl?: string | null;
  tagline?: string | null;
  openingMessage?: string | null;
  scenario?: string | null;
  tags?: string[];
};

export async function createPersona({
  ownerId,
  ...input
}: PersonaInput & { ownerId: string }) {
  try {
    const [created] = await db
      .insert(persona)
      .values({
        avatarUrl: input.avatarUrl ?? null,
        defaultModel: input.defaultModel,
        name: input.name,
        openingMessage: input.openingMessage ?? null,
        ownerId,
        personality: input.personality,
        scenario: input.scenario ?? null,
        tagline: input.tagline ?? null,
        tags: input.tags ?? [],
      })
      .returning();
    return created;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getPersonasByOwnerId({
  ownerId,
}: {
  ownerId: string;
}): Promise<Persona[]> {
  try {
    return await db
      .select()
      .from(persona)
      .where(eq(persona.ownerId, ownerId))
      .orderBy(desc(persona.updatedAt));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getPersonaById({
  id,
}: {
  id: string;
}): Promise<Persona | null> {
  try {
    const [row] = await db.select().from(persona).where(eq(persona.id, id));
    return row ?? null;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function updatePersona({
  id,
  ownerId,
  ...input
}: Partial<PersonaInput> & { id: string; ownerId: string }) {
  try {
    const [updated] = await db
      .update(persona)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.personality !== undefined && {
          personality: input.personality,
        }),
        ...(input.defaultModel !== undefined && {
          defaultModel: input.defaultModel,
        }),
        ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        ...(input.tagline !== undefined && { tagline: input.tagline }),
        ...(input.openingMessage !== undefined && {
          openingMessage: input.openingMessage,
        }),
        ...(input.scenario !== undefined && { scenario: input.scenario }),
        ...(input.tags !== undefined && { tags: input.tags }),
        updatedAt: new Date(),
      })
      .where(and(eq(persona.id, id), eq(persona.ownerId, ownerId)))
      .returning();
    return updated ?? null;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deletePersona({
  id,
  ownerId,
}: {
  id: string;
  ownerId: string;
}) {
  try {
    // Chat.personaId is ON DELETE SET NULL, so past chats survive detached.
    await db
      .delete(persona)
      .where(and(eq(persona.id, id), eq(persona.ownerId, ownerId)));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

/** Persona chats for the sidebar, newest first, with their persona name. */
export async function getPersonaChatsByOwnerId({ userId }: { userId: string }) {
  try {
    return await db
      .select({
        createdAt: chat.createdAt,
        id: chat.id,
        personaId: chat.personaId,
        title: chat.title,
        visibility: chat.visibility,
      })
      .from(chat)
      .where(and(eq(chat.userId, userId), eq(chat.kind, "persona")))
      .orderBy(desc(chat.createdAt));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

/**
 * Start a fresh chat with a persona: creates the Chat row and, when the
 * persona has an openingMessage, seeds it as the first assistant turn (no
 * model call). Returns the new chat id.
 */
export async function startPersonaChat({
  personaRow,
  userId,
}: {
  personaRow: Persona;
  userId: string;
}): Promise<string> {
  try {
    const chatId = generateUUID();
    await db.insert(chat).values({
      createdAt: new Date(),
      id: chatId,
      kind: "persona",
      personaId: personaRow.id,
      projectId: null,
      title: personaRow.name,
      userId,
      visibility: "private",
    });

    if (personaRow.openingMessage?.trim()) {
      await db.insert(message).values({
        attachments: [],
        chatId,
        createdAt: new Date(),
        id: generateUUID(),
        modelId: personaRow.defaultModel,
        parts: [{ text: personaRow.openingMessage, type: "text" }],
        role: "assistant",
      });
    }

    return chatId;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}
