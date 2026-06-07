import { test } from "node:test";
import assert from "node:assert/strict";
import {
  basename,
  dirname,
  isMarkdown,
  resolveLink,
} from "../../src/core/paths.js";

test("resolveLink: finds by basename", () => {
  const files = ["folder/A.md", "other/B.md"];
  assert.equal(resolveLink("A", files), "folder/A.md");
  assert.equal(resolveLink("a", files), "folder/A.md");
});

test("resolveLink: prefers explicit path", () => {
  const files = ["a/Note.md", "b/Note.md"];
  assert.equal(resolveLink("b/Note", files), "b/Note.md");
});

test("resolveLink: returns null when missing", () => {
  assert.equal(resolveLink("Nope", ["A.md"]), null);
});

test("basename / dirname / isMarkdown", () => {
  assert.equal(basename("a/b/c.md"), "c.md");
  assert.equal(dirname("a/b/c.md"), "a/b");
  assert.equal(dirname("c.md"), "");
  assert.ok(isMarkdown("a.md"));
  assert.ok(isMarkdown("a.MARKDOWN"));
  assert.ok(!isMarkdown("a.png"));
});
