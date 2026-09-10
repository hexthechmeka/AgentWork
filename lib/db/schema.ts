import type { InferSelectModel } from "drizzle-orm";
import {
  bigint,
  boolean,
  foreignKey,
  integer,
  json,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  email: varchar("email", { length: 64 }).notNull(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  // Firebase Auth UID. Nullable — existing NextAuth-era rows have none until
  // their owner signs in via Firebase and gets matched/attached by email
  // (see upsertFirebaseUser in lib/db/queries.ts).
  firebaseUid: text("firebaseUid").unique(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  image: text("image"),
  isAdmin: boolean("isAdmin").notNull().default(false),
  isAnonymous: boolean("isAnonymous").notNull().default(false),
  name: text("name"),
  password: varchar("password", { length: 64 }),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;

export const project = pgTable("Project", {
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  // Target repo the dev-agent (Vultr) clones + commits into for this project.
  // Null → "개발 시작" is disabled. AgentWork's own repo is never the target.
  repoUrl: text("repoUrl"),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
});

export type Project = InferSelectModel<typeof project>;

// AIchat: a persona (character) the user chats with. Single-user app — no
// view counts / ranking fields. `personality` is used verbatim as the system
// prompt; `openingMessage` is seeded as the first assistant turn.
export const persona = pgTable("Persona", {
  avatarUrl: text("avatarUrl"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  defaultModel: text("defaultModel").notNull(),
  // Few-shot: 1-2 sample exchanges in the character's voice. Injected into
  // the roleplay prompt so weak models pick up tone and depth.
  exampleDialogue: text("exampleDialogue"),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  openingMessage: text("openingMessage"),
  ownerId: uuid("ownerId")
    .notNull()
    .references(() => user.id),
  // Larger cover art shown on the gallery panel / detail screen (avatarUrl
  // stays the small round chat/sidebar image).
  panelImageUrl: text("panelImageUrl"),
  personality: text("personality").notNull(),
  scenario: text("scenario"),
  tagline: text("tagline"),
  tags: text("tags").array().notNull().default([]),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  // Who the user plays in the roleplay ("나"). Injected into the system
  // prompt so the character knows who it's talking to.
  userPersona: text("userPersona"),
});

export type Persona = InferSelectModel<typeof persona>;

// AIchat: a reusable preset for who the *user* plays ("나"). Chosen per chat
// from the settings panel and injected into the persona system prompt so the
// character knows who it's talking to.
export const playerPersona = pgTable("PlayerPersona", {
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  description: text("description").notNull(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: varchar("name", { length: 80 }).notNull(),
  ownerId: uuid("ownerId")
    .notNull()
    .references(() => user.id),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type PlayerPersona = InferSelectModel<typeof playerPersona>;

export const chat = pgTable("Chat", {
  createdAt: timestamp("createdAt").notNull(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  kind: varchar("kind", { enum: ["planning", "unified", "persona"] })
    .notNull()
    .default("planning"),
  personaId: uuid("personaId").references(() => persona.id, {
    onDelete: "set null",
  }),
  playerPersonaId: uuid("playerPersonaId").references(() => playerPersona.id, {
    onDelete: "set null",
  }),
  projectId: uuid("projectId").references(() => project.id),
  // AIchat: a periodically-regenerated digest of the roleplay so far
  // (relationship, mood, open threads) injected back into context for
  // continuity across a long chat.
  rollingSummary: text("rollingSummary"),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message_v2", {
  attachments: json("attachments").notNull(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  createdAt: timestamp("createdAt").notNull(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  modelId: text("modelId"),
  parts: json("parts").notNull(),
  role: varchar("role").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    isUpvoted: boolean("isUpvoted").notNull(),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    content: text("content"),
    createdAt: timestamp("createdAt").notNull(),
    id: uuid("id").notNull().defaultRandom(),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    title: text("title").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    createdAt: timestamp("createdAt").notNull(),
    description: text("description"),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    documentId: uuid("documentId").notNull(),
    id: uuid("id").notNull().defaultRandom(),
    isResolved: boolean("isResolved").notNull().default(false),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
    pk: primaryKey({ columns: [table.id] }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
    id: uuid("id").notNull().defaultRandom(),
  },
  (table) => ({
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
    pk: primaryKey({ columns: [table.id] }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

// One row per LLM call. `costUsd` is computed and frozen at write time from
// the pricing table, so historical cost stays accurate across price changes.
export const usageEvent = pgTable("UsageEvent", {
  cachedInputTokens: integer("cachedInputTokens").notNull().default(0),
  costUsd: numeric("costUsd", { precision: 14, scale: 8 })
    .notNull()
    .default("0"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  inputTokens: integer("inputTokens").notNull().default(0),
  modelId: text("modelId").notNull(),
  outputTokens: integer("outputTokens").notNull().default(0),
  provider: varchar("provider", {
    enum: ["anthropic", "glm", "aichat"],
  }).notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
});

export type UsageEvent = InferSelectModel<typeof usageEvent>;

// One row per provider. Usage/cost for limit checks is counted from
// `periodStart`; the "한도 리셋" button moves it to now. No auto-reset.
export const providerLimit = pgTable("ProviderLimit", {
  hardLimitUsd: numeric("hardLimitUsd", { precision: 12, scale: 2 }),
  periodStart: timestamp("periodStart").notNull().defaultNow(),
  provider: varchar("provider", { enum: ["anthropic", "glm", "aichat"] })
    .primaryKey()
    .notNull(),
  softLimitUsd: numeric("softLimitUsd", { precision: 12, scale: 2 }),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type ProviderLimit = InferSelectModel<typeof providerLimit>;

// Small key/value store for single-user app config (e.g. the editable
// roleplay system-prompt template).
export const setting = pgTable("Setting", {
  key: varchar("key", { length: 64 }).primaryKey().notNull(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  value: text("value").notNull(),
});

export type Setting = InferSelectModel<typeof setting>;

// ─── Imagie (image generation) ────────────────────────────────────────────
// Per-account: every table is scoped by `userId` (same as Chat/Message), so
// the gallery / folders / favorites / RunPod config are isolated per login.
// The Imagie backend (RunPod FastAPI) is never touched; we only store the
// generated images (blob) + their metadata here.

// A gallery folder. `isSystem` folders ("미분류" = unfiled, "임시" = temp)
// exist once per account and can't be renamed or deleted.
export const folder = pgTable("Folder", {
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  isSystem: boolean("isSystem").notNull().default(false),
  name: text("name").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export type Folder = InferSelectModel<typeof folder>;

// One generated image. Auto-saved to the "임시" folder on generate with
// `expiresAt = now() + 7d`; moving it to any other folder clears `expiresAt`
// (NULL = kept forever). `metadata` holds the rest of the backend's
// GenerateResponse.metadata (loras, embeddings, hr_*, ref_*, …).
export const imagieImage = pgTable("ImagieImage", {
  blobUrl: text("blobUrl").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  expiresAt: timestamp("expiresAt"),
  folderId: uuid("folderId")
    .notNull()
    .references(() => folder.id, { onDelete: "cascade" }),
  guidanceScale: numeric("guidanceScale").notNull(),
  height: integer("height").notNull(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  metadata: json("metadata").notNull().default({}),
  modelName: text("modelName").notNull(),
  negativePrompt: text("negativePrompt").notNull().default(""),
  prompt: text("prompt").notNull(),
  sampler: text("sampler").notNull(),
  seed: bigint("seed", { mode: "number" }),
  steps: integer("steps").notNull(),
  thumbUrl: text("thumbUrl").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  width: integer("width").notNull(),
});

export type ImagieImage = InferSelectModel<typeof imagieImage>;

// A saved prompt + negative-prompt pair, optionally labelled.
export const favoritePrompt = pgTable("FavoritePrompt", {
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  label: text("label"),
  negativePrompt: text("negativePrompt").notNull().default(""),
  prompt: text("prompt").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export type FavoritePrompt = InferSelectModel<typeof favoritePrompt>;

// One row per account holding RunPod pod control config. `apiKey` is stored
// server-side only and never returned to the browser.
export const runpodSetting = pgTable("RunpodSetting", {
  apiKey: text("apiKey"),
  podId: text("podId"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  userId: uuid("userId")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export type RunpodSetting = InferSelectModel<typeof runpodSetting>;
