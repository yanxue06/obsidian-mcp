import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countWords,
  parseHeadings,
  parseLinks,
  parseTags,
  stripCode,
} from "../../src/core/markdown.js";

test("parseLinks: simple wiki-link", () => {
  const links = parseLinks("Hello [[World]] and [[Other Note]].");
  assert.deepEqual(
    links.map((l) => l.target),
    ["World", "Other Note"],
  );
});

test("parseLinks: handles aliases and headings", () => {
  const links = parseLinks(
    "see [[Note A|alias]], [[Note B#Heading]], [[Note C#^block-id|alias]]",
  );
  assert.deepEqual(
    links.map((l) => l.target),
    ["Note A", "Note B", "Note C"],
  );
});

test("parseLinks: ignores links inside fenced code", () => {
  const md = "before [[A]]\n```\n[[B]]\n```\nafter [[C]]";
  const links = parseLinks(md);
  assert.deepEqual(
    links.map((l) => l.target),
    ["A", "C"],
  );
});

test("parseLinks: ignores links inside inline code", () => {
  const links = parseLinks("real [[A]] and `[[B]]` literal");
  assert.deepEqual(
    links.map((l) => l.target),
    ["A"],
  );
});

test("parseLinks: markdown links to local files", () => {
  const links = parseLinks("see [text](path/to/note.md) and [bad](https://x)");
  assert.deepEqual(
    links.map((l) => l.target),
    ["path/to/note.md"],
  );
});

test("parseTags: inline tags", () => {
  const tags = parseTags("hello #project and #project/sub and #foo-bar");
  assert.deepEqual(tags.sort(), ["foo-bar", "project", "project/sub"].sort());
});

test("parseTags: ignores tags in code", () => {
  const tags = parseTags("real #real\n```\n#fake\n```\nalso `#also-fake`");
  assert.deepEqual(tags, ["real"]);
});

test("parseTags: does not match #1 (numeric only) — Obsidian convention", () => {
  const tags = parseTags("issue #123 closed");
  assert.equal(tags.length, 0);
});

test("stripCode removes fences and inline code", () => {
  const out = stripCode("a `b` c\n```\nd\n```\ne");
  assert.match(out, /a\s+\s+c/);
  assert.doesNotMatch(out, /b/);
  assert.doesNotMatch(out, /d/);
  assert.match(out, /e/);
});

test("parseHeadings extracts ATX headings", () => {
  const md = [
    "# Title",
    "intro",
    "## Section A",
    "```",
    "## not a heading",
    "```",
    "### Sub",
  ].join("\n");
  const h = parseHeadings(md);
  assert.deepEqual(
    h.map((x) => `${x.level}:${x.text}`),
    ["1:Title", "2:Section A", "3:Sub"],
  );
});

test("countWords approximates", () => {
  assert.equal(countWords("hello world"), 2);
  assert.equal(countWords("# Heading\nfour words here exactly"), 5);
  assert.equal(countWords("`stripped` does not count"), 3);
});
