CREATE TABLE "Setting" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "rollingSummary" text;--> statement-breakpoint
ALTER TABLE "Persona" ADD COLUMN "exampleDialogue" text;