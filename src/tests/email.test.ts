import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmailSender } from "../lib/email";
const message = { to: "test@example.com", subject: "Test", html: "Test" };
describe("Recovery email delivery failures", () => {
  it("propagates provider rejection instead of claiming success", async () => {
    const send = createEmailSender(
      {
        emails: {
          send: async () => ({
            data: null,
            error: { name: "validation_error" },
          }),
        },
      },
      true,
    );
    assert.equal((await send(message)).success, false);
  });
  it("handles transport errors and missing production configuration", async () => {
    const send = createEmailSender(
      {
        emails: {
          send: async () => {
            throw new Error("offline");
          },
        },
      },
      true,
    );
    assert.equal((await send(message)).success, false);
    assert.equal((await createEmailSender(null, true)(message)).success, false);
  });
  it("requires an actual delivery ID to acknowledge delivery", async () => {
    const send = createEmailSender(
      {
        emails: {
          send: async () => ({ data: { id: "test-delivery" }, error: null }),
        },
      },
      true,
    );
    assert.deepEqual(await send(message), {
      success: true,
      id: "test-delivery",
    });
  });
});
