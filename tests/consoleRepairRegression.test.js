import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("webapp entrypoint does not contain intentional console repair failures", () => {
  const main = readFileSync(new URL("../webapp/main.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../webapp/styles.css", import.meta.url), "utf8");

  assert.equal(main.includes("INTENTIONAL_"), false);
  assert.equal(main.includes("intentional-blank-screen"), false);
  assert.equal(styles.includes("intentional-blank-screen"), false);
});

test("dev server exposes configured OpenAI model list before requiring API key", () => {
  const server = readFileSync(new URL("../dev-server.mjs", import.meta.url), "utf8");
  const modelsBranch = server.indexOf('upstreamPath === "/v1/models"');
  const missingKeyBranch = server.indexOf("OpenAI API key is missing");

  assert.notEqual(modelsBranch, -1);
  assert.notEqual(missingKeyBranch, -1);
  assert.ok(modelsBranch < missingKeyBranch);
});
