import type { AnyToolDef } from "./types.js";

// discovery — find what's in the vault
import { listVaultTool } from "./discovery/list_vault.js";
import { searchVaultTool } from "./discovery/search_vault.js";
import { queryDataviewTool } from "./discovery/query_dataview.js";
import { listTagsTool } from "./discovery/list_tags.js";
import { getVaultStatsTool } from "./discovery/get_vault_stats.js";

// reading — get content out
import { getNoteTool } from "./reading/get_note.js";
import { getOutlineTool } from "./reading/get_outline.js";
import { getActiveNoteTool } from "./reading/get_active_note.js";
import { getDailyNoteTool } from "./reading/get_daily_note.js";

// graph — walk and analyze the link structure
import { getBacklinksTool } from "./graph/get_backlinks.js";
import { traverseGraphTool } from "./graph/traverse_graph.js";
import { findOrphansTool } from "./graph/find_orphans.js";
import { findBrokenLinksTool } from "./graph/find_broken_links.js";

// writing — create and modify notes
import { createNoteTool } from "./writing/create_note.js";
import { createNotesTool } from "./writing/create_notes.js";
import { upsertNoteTool } from "./writing/upsert_note.js";
import { updateNoteTool } from "./writing/update_note.js";
import { appendNoteTool } from "./writing/append_to_note.js";
import { appendDailyNoteTool } from "./writing/append_to_daily_note.js";
import { patchNoteTool } from "./writing/patch_note.js";
import { moveNoteTool } from "./writing/move_note.js";
import { deleteNoteTool } from "./writing/delete_note.js";

// commands — drive Obsidian itself
import { openNoteTool } from "./commands/open_note.js";
import { listCommandsTool } from "./commands/list_commands.js";
import { runCommandTool } from "./commands/run_command.js";

export const allTools: AnyToolDef[] = [
  // discovery
  listVaultTool,
  searchVaultTool,
  queryDataviewTool,
  listTagsTool,
  getVaultStatsTool,
  // reading
  getNoteTool,
  getOutlineTool,
  getActiveNoteTool,
  getDailyNoteTool,
  // graph
  getBacklinksTool,
  traverseGraphTool,
  findOrphansTool,
  findBrokenLinksTool,
  // writing
  createNoteTool,
  createNotesTool,
  upsertNoteTool,
  updateNoteTool,
  appendNoteTool,
  appendDailyNoteTool,
  patchNoteTool,
  moveNoteTool,
  deleteNoteTool,
  // commands
  openNoteTool,
  listCommandsTool,
  runCommandTool,
];
