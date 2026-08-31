import type { InferSelectModel } from "drizzle-orm";
import {
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
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  image: text("image"),
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
});

export type Persona = InferSelectModel<typeof persona>;

export const chat = pgTable("Chat", {
  createdAt: timestamp("createdAt").notNull(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  kind: varchar("kind", { enum: ["planning", "unified", "persona"] })
    .notNull()
    .default("planning"),
  personaId: uuid("personaId").references(() => persona.id, {
    onDelete: "set null",
  }),
  projectId: uuid("projectId").references(() => project.id),
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
