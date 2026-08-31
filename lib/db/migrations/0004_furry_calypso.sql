CREATE TABLE "Persona" (
	"avatarUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"defaultModel" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"openingMessage" text,
	"ownerId" uuid NOT NULL,
	"personality" text NOT NULL,
	"scenario" text,
	"tagline" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "personaId" uuid;--> statement-breakpoint
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_personaId_Persona_id_fk" FOREIGN KEY ("personaId") REFERENCES "public"."Persona"("id") ON DELETE set null ON UPDATE no action;