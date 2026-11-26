import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase";

// Resolves the authenticated host user (supports test header in non-production Playwright E2E mode)
export async function getAuthenticatedHost(req: NextRequest) {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_E2E_TEST_AUTH === "true"
  ) {
    const testHostId = req.headers.get("x-test-host-id");
    if (testHostId) {
      const testHostEmail = `${testHostId}@livesite.test`;
      const user = await prisma.user.upsert({
        where: { id: testHostId },
        update: {},
        create: { id: testHostId, email: testHostEmail, name: "Test Host" }
      });
      return user;
    }
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;

  return prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email },
    create: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || null
    }
  });
}
