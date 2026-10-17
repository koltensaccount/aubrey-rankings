import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail =
  process.env.EMAIL_FROM || "Aubrey Rankings <accounts@aubrey.koltensserver.com>";

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  if (resend) {
    try {
      const response = await resend.emails.send({
        from: fromEmail,
        to,
        subject,
        html,
        text,
      });
      return { success: true, id: response.data?.id };
    } catch (error) {
      console.error("[Email Error] Failed to send email via Resend:", error);
      return { success: false, error };
    }
  } else {
    console.log("-----------------------------------------");
    console.log(`[Email Simulation - Development Mode]`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content:\n${text || html}`);
    console.log("-----------------------------------------");
    return { success: true, simulated: true };
  }
}
