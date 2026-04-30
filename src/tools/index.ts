import type { AnyToolDef } from "./types.js";
import {
  deleteNoteTool,
  getActiveNoteTool,
  listVaultTool,
} from "./vault.js";
import {
  appendNoteTool,
  createNoteTool,
  getNoteTool,
  patchNoteTool,
  updateNoteTool,
} from "./note.js";
import {
  findOrphansTool,
  queryDataviewTool,
  searchVaultTool,
} from "./search.js";
import { findBrokenLinksTool, traverseGraphTool } from "./graph.js";
import { appendDailyNoteTool, getDailyNoteTool } from "./periodic.js";
import { getOutlineTool } from "./outline.js";
import { getBacklinksTool } from "./backlinks.js";
import { listTagsTool } from "./tags.js";
import { moveNoteTool } from "./move.js";
import {
  listCommandsTool,
  openNoteTool,
  runCommandTool,
} from "./commands.js";
import { getVaultStatsTool } from "./stats.js";

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
  updateNoteTool,
  appendNoteTool,
  appendDailyNoteTool,
  patchNoteTool,
  moveNoteTool,
  deleteNoteTool,
  // ui / commands
  openNoteTool,
  listCommandsTool,
  runCommandTool,
];
