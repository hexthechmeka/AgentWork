ALTER TABLE "Chat" ADD COLUMN "kind" varchar DEFAULT 'planning' NOT NULL;--> statement-breakpoint
ALTER TABLE "Message_v2" ADD COLUMN "modelId" text;