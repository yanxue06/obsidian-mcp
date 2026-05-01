import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNoteBody } from "./note.js";

test("buildNoteBody — content only, no frontmatter or links", () => {
  const out = buildNoteBody({ content: "hello" });
  assert.equal(out, "hello");
});

test("buildNoteBody — undefined content treated as empty", () => {
  const out = buildNoteBody({ frontmatter: { a: 1 } });
  assert.equal(out, "---\na: 1\n---\n\n");
});

test("buildNoteBody — frontmatter renders YAML block before content", () => {
  const out = buildNoteBody({
    content: "body",
    frontmatter: { title: "Foo", tags: ["a", "b"] },
  });
  assert.equal(
    out,
    "---\ntitle: Foo\ntags:\n  - a\n  - b\n---\n\nbody",
  );
});

test("buildNoteBody — empty frontmatter object is skipped", () => {
  const out = buildNoteBody({ content: "x", frontmatter: {} });
  assert.equal(out, "x");
});

test("buildNoteBody — appends ## Related when links provided", () => {
  const out = buildNoteBody({ content: "body", links: ["A", "B"] });
  assert.equal(out, "body\n\n## Related\n- [[A]]\n- [[B]]\n");
});

test("buildNoteBody — quotes YAML scalar containing reserved chars", () => {
  const out = buildNoteBody({
    content: "",
    frontmatter: { weird: "has: colon" },
  });
  assert.match(out, /weird: "has: colon"/);
});
