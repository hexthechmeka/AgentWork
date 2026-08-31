import { auth } from "@/app/(auth)/auth";
import { getUsageSummary } from "@/lib/db/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providers = await getUsageSummary({ userId: session.user.id });
  return Response.json({ providers });
}
