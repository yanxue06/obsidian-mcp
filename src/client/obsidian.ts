/**
 * Thin client over the Obsidian Local REST API plugin.
 * Plugin: https://github.com/coddingtonbear/obsidian-local-rest-api
 *
 * The plugin defaults to HTTPS on port 27124 with a self-signed cert (HTTP on
 * 27123 must be explicitly enabled). We use `undici` rather than Node's `https`
 * so we can opt out of TLS verification for that self-signed cert without
 * leaking the choice into other dependencies.
 *
 * Methods are grouped by REST resource (vault / search / periodic / active /
 * commands / open). This is one cohesive client for one API — kept in a single
 * file on purpose; the section dividers are the map.
 */
import { Agent, request } from "undici";
import { configBaseUrl, type Config } from "./config.js";

export const PERIODS = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
] as const;
export type Period = (typeof PERIODS)[number];

export interface NoteMeta {
  path: string;
  tags?: string[];
  frontmatter?: Record<string, unknown>;
  stat?: {
    ctime?: number;
    mtime?: number;
    size?: number;
  };
}

export interface NoteContent extends NoteMeta {
  content: string;
}

export interface SearchHit {
  filename: string;
  score?: number;
  matches?: Array<{ match: { start: number; end: number }; context: string }>;
}

export interface DataviewRow {
  filename: string;
  result: unknown;
}

export class ObsidianError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ObsidianError";
  }
}

// Hard cap so a pathological vault (or a symlink loop the plugin exposes) can't
// make us walk forever. Larger vaults still work — we stop collecting here.
const LIST_VAULT_MAX_ENTRIES = 50_000;

export class ObsidianClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly dispatcher: Agent;
  private readonly timeoutMs: number;

  constructor(private readonly config: Config) {
    this.baseUrl = configBaseUrl(config);
    this.headers = {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: "application/json",
    };
    this.timeoutMs = config.timeoutMs;
    this.dispatcher = new Agent({
      // The plugin ships a self-signed cert by default; opting out is the
      // recommended path. Users who terminate TLS elsewhere set
      // OBSIDIAN_VERIFY_TLS=true.
      connect: { rejectUnauthorized: config.verifyTls },
    });
  }

  // ---------- low-level HTTP ----------

  private async req<T = unknown>(
    method: string,
    path: string,
    init?: {
      body?: string | Buffer;
      headers?: Record<string, string>;
      query?: Record<string, string | number | boolean | undefined>;
      expect?: "json" | "text" | "empty";
    },
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (init?.query) {
      for (const [k, v] of Object.entries(init.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    let res;
    try {
      res = await request(url.toString(), {
        method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
        headers: { ...this.headers, ...(init?.headers ?? {}) },
        body: init?.body,
        dispatcher: this.dispatcher,
        bodyTimeout: this.timeoutMs,
        headersTimeout: this.timeoutMs,
      });
    } catch (err) {
      const e = err as Error & { code?: string };
      const hint =
        e.code === "ECONNREFUSED"
          ? ` Is Obsidian running and the Local REST API plugin enabled at ${this.baseUrl}?`
          : "";
      throw new ObsidianError(
        `Request to ${method} ${url.pathname} failed: ${e.message}.${hint}`,
      );
    }

    const status = res.statusCode;
    if (status >= 400) {
      let body: unknown;
      try {
        body = await res.body.json();
      } catch {
        try {
          body = await res.body.text();
        } catch {
          body = undefined;
        }
      }
      throw new ObsidianError(
        `Obsidian API ${method} ${url.pathname} → ${status}`,
        status,
        body,
      );
    }

    if (init?.expect === "empty" || status === 204) {
      await res.body.dump(); // drain so the connection can be reused
      return undefined as T;
    }
    if (init?.expect === "text") {
      return (await res.body.text()) as unknown as T;
    }
    const ct = res.headers["content-type"];
    const isJson =
      typeof ct === "string" && ct.toLowerCase().includes("application/json");
    if (isJson) return (await res.body.json()) as T;
    return (await res.body.text()) as unknown as T;
  }

  // ---------- vault ----------

  /**
   * List every file in the vault, recursively.
   *
   * The plugin's `GET /vault/` only returns immediate children (folders come
   * back with a trailing '/'), so we walk the tree ourselves and prefix each
   * entry with its parent path. Without this, anything that depends on a
   * complete file list (find_orphans, link resolution, create_notes existence
   * checks, upsert's `existed` flag) silently misses notes in subfolders.
   */
  async listVault(): Promise<string[]> {
    const out: string[] = [];

    const walk = async (folder: string): Promise<void> => {
      if (out.length >= LIST_VAULT_MAX_ENTRIES) return;
      const data = await this.req<{ files: string[] }>(
        "GET",
        folder ? `/vault/${encodeURIPath(folder)}/` : "/vault/",
      );
      for (const entry of data.files ?? []) {
        if (out.length >= LIST_VAULT_MAX_ENTRIES) return;
        if (entry.endsWith("/")) {
          const sub = entry.slice(0, -1);
          await walk(folder ? `${folder}/${sub}` : sub);
        } else {
          out.push(folder ? `${folder}/${entry}` : entry);
        }
      }
    };

    await walk("");
    return out;
  }

  /** List files inside a folder (relative path, no leading slash). */
  async listFolder(folder: string): Promise<string[]> {
    const safe = folder.replace(/^\/+|\/+$/g, "");
    const data = await this.req<{ files: string[] }>(
      "GET",
      `/vault/${encodeURIPath(safe)}/`,
    );
    return data.files ?? [];
  }

  /** Get a note's content + metadata. */
  async getNote(path: string): Promise<NoteContent> {
    const data = await this.req<NoteContent | string>(
      "GET",
      `/vault/${encodeURIPath(path)}`,
      { headers: { Accept: "application/vnd.olrapi.note+json" } },
    );
    if (typeof data === "string") {
      return { path, content: data };
    }
    return { ...data, path: data.path ?? path };
  }

  /** Get the raw markdown content of a note. */
  async getNoteText(path: string): Promise<string> {
    return this.req<string>("GET", `/vault/${encodeURIPath(path)}`, {
      headers: { Accept: "text/markdown" },
      expect: "text",
    });
  }

  /** Create or overwrite a note. */
  async putNote(path: string, content: string): Promise<void> {
    await this.req("PUT", `/vault/${encodeURIPath(path)}`, {
      body: content,
      headers: { "Content-Type": "text/markdown" },
      expect: "empty",
    });
  }

  /** Append content to an existing note (creates if missing). */
  async appendNote(path: string, content: string): Promise<void> {
    await this.req("POST", `/vault/${encodeURIPath(path)}`, {
      body: content,
      headers: { "Content-Type": "text/markdown" },
      expect: "empty",
    });
  }

  /** Delete a note. */
  async deleteNote(path: string): Promise<void> {
    await this.req("DELETE", `/vault/${encodeURIPath(path)}`, {
      expect: "empty",
    });
  }

  /** Patch a note relative to a heading, block, or frontmatter field. */
  async patchNote(
    path: string,
    body: string,
    headers: {
      operation: "append" | "prepend" | "replace";
      targetType: "heading" | "block" | "frontmatter";
      target: string;
    },
  ): Promise<void> {
    await this.req("PATCH", `/vault/${encodeURIPath(path)}`, {
      body,
      headers: {
        "Content-Type": "text/markdown",
        Operation: headers.operation,
        "Target-Type": headers.targetType,
        Target: headers.target,
      },
      expect: "empty",
    });
  }

  // ---------- search ----------

  /**
   * Plain-text search across the vault.
   *
   * The plugin's `/search/simple/` takes the query as URL params with no body.
   * Two subtleties: (1) sending Content-Type without a body trips the plugin's
   * strict request parsing, so we omit it; (2) with no body and no
   * Content-Length, undici defaults to chunked encoding and the plugin then
   * waits for body bytes that never arrive — hanging until our timeout. Forcing
   * `Content-Length: 0` makes undici emit a fixed-length empty body instead.
   */
  async simpleSearch(query: string, contextLength = 100): Promise<SearchHit[]> {
    const data = await this.req<SearchHit[]>("POST", "/search/simple/", {
      query: { query, contextLength },
      headers: { "Content-Length": "0" },
    });
    return data ?? [];
  }

  /** Dataview DQL query. Requires the Dataview plugin in the vault. */
  async dataview(dql: string): Promise<DataviewRow[]> {
    const data = await this.req<DataviewRow[]>("POST", "/search/", {
      body: dql,
      headers: { "Content-Type": "application/vnd.olrapi.dataview.dql+txt" },
    });
    return data ?? [];
  }

  /** JsonLogic query. */
  async jsonLogicSearch(query: unknown): Promise<unknown[]> {
    const data = await this.req<unknown[]>("POST", "/search/", {
      body: JSON.stringify(query),
      headers: { "Content-Type": "application/vnd.olrapi.jsonlogic+json" },
    });
    return data ?? [];
  }

  // ---------- periodic notes ----------

  async getPeriodic(period: Period): Promise<NoteContent> {
    const data = await this.req<NoteContent | string>(
      "GET",
      `/periodic/${period}/`,
      { headers: { Accept: "application/vnd.olrapi.note+json" } },
    );
    if (typeof data === "string") return { path: `${period}.md`, content: data };
    return data as NoteContent;
  }

  async appendPeriodic(period: Period, content: string): Promise<void> {
    await this.req("POST", `/periodic/${period}/`, {
      body: content,
      headers: { "Content-Type": "text/markdown" },
      expect: "empty",
    });
  }

  // ---------- active note ----------

  async getActive(): Promise<NoteContent> {
    const data = await this.req<NoteContent>("GET", "/active/", {
      headers: { Accept: "application/vnd.olrapi.note+json" },
    });
    return data;
  }

  // ---------- commands ----------

  async listCommands(): Promise<Array<{ id: string; name: string }>> {
    const data = await this.req<{ commands: Array<{ id: string; name: string }> }>(
      "GET",
      "/commands/",
    );
    return data.commands ?? [];
  }

  async runCommand(id: string): Promise<void> {
    await this.req("POST", `/commands/${encodeURIComponent(id)}/`, {
      expect: "empty",
    });
  }

  // ---------- open ----------

  /** Open a note in Obsidian's UI (focuses the workspace tab). */
  async openNote(path: string, options?: { newLeaf?: boolean }): Promise<void> {
    await this.req("POST", `/open/${encodeURIPath(path)}`, {
      query: options?.newLeaf ? { newLeaf: "true" } : undefined,
      expect: "empty",
    });
  }

  async ping(): Promise<{ ok: boolean; service?: string; version?: string }> {
    const data = await this.req<{ status?: string; service?: string; versions?: { obsidian?: string } }>(
      "GET",
      "/",
    );
    return {
      ok: data?.status === "OK" || true,
      service: data?.service,
      version: data?.versions?.obsidian,
    };
  }
}

/**
 * Encode a vault-relative path while preserving "/" separators — the plugin
 * treats each path component as a URL-encoded segment.
 */
export function encodeURIPath(p: string): string {
  return p
    .replace(/^\/+/, "")
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}
