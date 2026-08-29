CREATE TABLE "ProviderLimit" (
	"hardLimitUsd" numeric(12, 2),
	"periodStart" timestamp DEFAULT now() NOT NULL,
	"provider" varchar PRIMARY KEY NOT NULL,
	"softLimitUsd" numeric(12, 2),
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UsageEvent" (
	"cachedInputTokens" integer DEFAULT 0 NOT NULL,
	"costUsd" numeric(14, 8) DEFAULT '0' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inputTokens" integer DEFAULT 0 NOT NULL,
	"modelId" text NOT NULL,
	"outputTokens" integer DEFAULT 0 NOT NULL,
	"provider" varchar NOT NULL,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;