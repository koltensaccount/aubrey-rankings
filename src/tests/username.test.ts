import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeUsername, validateUsername, RESERVED_USERNAMES } from "../lib/username";

describe("Username Validator & Normalizer", () => {
  it("normalizes uppercase and trims whitespace", () => {
    assert.equal(normalizeUsername("  Cinemaphile_99  "), "cinemaphile_99");
    assert.equal(normalizeUsername("KOLTEN.B"), "kolten.b");
  });

  it("validates compliant usernames", () => {
    const validNames = ["cinema_fan", "film.buff", "cinephile99", "alex_10", "mubi.critic"];
    for (const name of validNames) {
      const res = validateUsername(name);
      assert.equal(res.valid, true, `Expected ${name} to be valid`);
      assert.equal(res.normalized, name.toLowerCase());
    }
  });

  it("rejects too short or too long usernames", () => {
    assert.equal(validateUsername("ab").valid, false);
    assert.equal(validateUsername("a".repeat(21)).valid, false);
    assert.equal(validateUsername("abc").valid, true);
    assert.equal(validateUsername("a".repeat(20)).valid, true);
  });

  it("rejects usernames with leading or trailing periods/underscores as starting character", () => {
    assert.equal(validateUsername(".cinemafan").valid, false);
    assert.equal(validateUsername("cinemafan.").valid, false);
    assert.equal(validateUsername("_cinemafan").valid, false);
    assert.equal(validateUsername("cinemafan_").valid, false);
  });

  it("rejects consecutive periods", () => {
    assert.equal(validateUsername("film..buff").valid, false);
    assert.equal(validateUsername("film...buff").valid, false);
  });

  it("rejects spaces and illegal symbols", () => {
    assert.equal(validateUsername("film buff").valid, false);
    assert.equal(validateUsername("film@buff").valid, false);
    assert.equal(validateUsername("film#buff").valid, false);
    assert.equal(validateUsername("film$buff").valid, false);
  });

  it("rejects reserved system keywords", () => {
    for (const reserved of ["admin", "api", "settings", "profile", "login", "signup"]) {
      const res = validateUsername(reserved);
      assert.equal(res.valid, false, `Expected reserved keyword "${reserved}" to be rejected`);
      assert.match(res.error || "", /reserved/i);
    }
  });
});
