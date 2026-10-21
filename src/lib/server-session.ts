import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getServerSession(req?: Request) {
  try {
    const headerObj = req ? req.headers : await headers();
    const session = await auth.api.getSession({
      headers: headerObj,
    });
    if (session?.user) {
      (session.user as any).isTestWorkspace = Boolean(
        (session.user as any).isTestWorkspace || session.user.id === "usr_test_import_workspace"
      );
    }
    return session;
  } catch (error) {
    return null;
  }
}
