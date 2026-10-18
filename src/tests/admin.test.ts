import { it } from "node:test";
import assert from "node:assert/strict";
import { checkIsAdmin } from "../lib/admin";
it("report administration fails closed and requires verified email grants", () => {
  const session = { user: { id: "member", email: "admin@example.com", emailVerified: false } };
  assert.equal(checkIsAdmin(session, {}), false);
  assert.equal(checkIsAdmin(session, { ADMIN_USER_IDS: " , ", ADMIN_EMAILS: " , " }), false);
  assert.equal(checkIsAdmin(null, { ADMIN_USER_IDS: "member" }), false);
  assert.equal(checkIsAdmin(session, { ADMIN_USER_IDS: "owner" }), false);
  assert.equal(checkIsAdmin(session, { ADMIN_USER_IDS: " member " }), true);
  assert.equal(checkIsAdmin(session, { ADMIN_EMAILS: "admin@example.com" }), false);
  assert.equal(checkIsAdmin({user:{...session.user,emailVerified:true}}, { ADMIN_EMAILS: " ADMIN@example.com " }), true);
});
