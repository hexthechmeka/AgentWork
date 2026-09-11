import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { IntegrationsSettings } from "@/components/settings/integrations-settings";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsGuard />
    </Suspense>
  );
}

async function SettingsGuard() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <IntegrationsSettings />;
}
