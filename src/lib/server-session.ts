import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getServerSession(req?: Request) {
  try {
    const headerObj = req ? req.headers : await headers();
    const session = await auth.api.getSession({
      headers: headerObj,
    });
    return session;
  } catch (error) {
    return null;
  }
}
