import { Resend } from "resend";

type Message = { to: string; subject: string; html: string; text?: string };
type Transport = {
  emails: {
    send(
      message: Message & { from: string },
    ): Promise<{ data: { id: string } | null; error: { name: string } | null }>;
  };
};
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const from =
  process.env.EMAIL_FROM ||
  "Aubrey Rankings <accounts@aubrey.koltensserver.com>";

/** Injectable transport keeps delivery failure tests isolated from real email services. */
export function createEmailSender(
  transport: Transport | null,
  production: boolean,
  fromEmail = from,
) {
  return async (message: Message) => {
    if (!transport) {
      if (production)
        return { success: false, error: "Email delivery is not configured" };
      console.log("[Email Simulation - Development Mode]", {
        to: message.to,
        subject: message.subject,
        content: message.text || message.html,
      });
      return { success: true, simulated: true };
    }
    try {
      const response = await transport.emails.send({
        from: fromEmail,
        ...message,
      });
      if (response.error || !response.data?.id) {
        console.error(
          "[Email Error] Delivery rejected:",
          response.error?.name || "Missing delivery ID",
        );
        return { success: false, error: "Email delivery failed" };
      }
      return { success: true, id: response.data.id };
    } catch {
      console.error("[Email Error] Transport failed");
      return { success: false, error: "Email delivery failed" };
    }
  };
}

export async function sendEmail(message: Message) {
  return createEmailSender(
    resend,
    process.env.NODE_ENV === "production",
  )(message);
}
