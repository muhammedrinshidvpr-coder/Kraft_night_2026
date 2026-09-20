// ==============================================================================
// SANGAM - CSV Import / Export Handler
// Multi-section CSV format:  [event], [group], [role], [programme]
// Parses into a blueprint matching the EventPlanner schema.
// Serialises live state back into the same format for replication.
// ==============================================================================

/**
 * Parse a multi-section CSV text into an event blueprint.
 *
 * Expected format:
 *   [event]
 *   title,venue
 *   Annual Tech Fest,Main Auditorium
 *
 *   [group]
 *   name,icon,description
 *   Technical,💻,Manages tech setup
 *
 *   [role]
 *   title,responsibility,group
 *   Stage Manager,Oversee stage,Technical
 *
 *   [programme]
 *   title,start_time,end_time,stage
 *   Inauguration,09:00,10:00,Main Stage
 *
 * @param {string} text  Raw CSV file content
 * @returns {{ title: string, venue: string, groups: object[], roleSlots: object[], programmes: object[] }}
 * @throws {Error} If the [event] section is missing or the file is malformed
 */
export function parseEventCSV(text) {
  if (!text || !text.trim()) {
    throw new Error("The CSV file is empty.");
  }

  // Strip BOM if present (Excel exports)
  const cleanText = String(text).replace(/^\uFEFF/, "");

  // Split into sections by [section_name] header lines.
  // Canonical names: event, group, role, programme. Accept common plurals.
  const SECTION_ALIASES = {
    event: "event",
    events: "event",
    group: "group",
    groups: "group",
    role: "role",
    roles: "role",
    programme: "programme",
    programmes: "programme",
    program: "programme",
    programs: "programme",
  };
  const SECTION_ORDER = { event: 0, group: 1, role: 2, programme: 3 };
  const sections = {};
  const sectionOrderSeen = [];
  let currentSection = null;
  const lines = cleanText.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//") || line.startsWith("#")) continue;

    const sectionMatch = line.match(/^\[([a-z_]+)\]$/i);
    if (sectionMatch) {
      const alias = sectionMatch[1].toLowerCase();
      const canonical = SECTION_ALIASES[alias];
      // Unknown sections are ignored (forward-compatible) but close current section
      if (!canonical) {
        currentSection = null;
        continue;
      }
      currentSection = canonical;
      if (!sections[currentSection]) sections[currentSection] = [];
      if (!sectionOrderSeen.includes(currentSection)) sectionOrderSeen.push(currentSection);
      continue;
    }

    if (currentSection) {
      sections[currentSection].push(line);
    }
  }

  if (!sections.event || sections.event.length < 2) {
    throw new Error("CSV must include an [event] section with a header row and at least one data row.");
  }

  // Enforce section order: [event] < [group] < [role] < [programme]
  for (let i = 1; i < sectionOrderSeen.length; i++) {
    if (SECTION_ORDER[sectionOrderSeen[i]] < SECTION_ORDER[sectionOrderSeen[i - 1]]) {
      throw new Error(
        `CSV sections out of order: [${sectionOrderSeen[i]}] must not appear before [${sectionOrderSeen[i - 1]}]. Expected order: [event], [group], [role], [programme].`
      );
    }
  }

  // ── [event] ──────────────────────────────────────────────────────────────
  const eventHeaders = parseCSVRow(sections.event[0]);
  const eventHeadersLower = eventHeaders.map((h) => String(h || "").trim().toLowerCase());
  if (!eventHeadersLower.includes("title")) {
    throw new Error("The [event] section must have a 'title' column.");
  }
  const eventData = sections.event[1] ? parseCSVRow(sections.event[1]) : [];
  const eventRow = zipRow(eventHeaders, eventData);
  const title = (eventRow.title || "").trim();
  const venue = (eventRow.venue || eventRow.venueorstage || eventRow.stage || "").trim();

  if (!title) {
    throw new Error("The [event] section must have a non-empty 'title' value.");
  }

  // ── [group] ───────────────────────────────────────────────────────────────
  const groups = [];
  if (sections.group && sections.group.length >= 2) {
    const groupHeaders = parseCSVRow(sections.group[0]);
    for (let i = 1; i < sections.group.length; i++) {
      const row = zipRow(groupHeaders, parseCSVRow(sections.group[i]));
      if (!row.name || !row.name.trim()) continue;
      groups.push({
        name: row.name.trim(),
        icon: (row.icon || "📁").trim(),
        description: (row.description || "").trim(),
      });
    }
  }

  // ── [role] ────────────────────────────────────────────────────────────────
  // Unknown group names leave the slot unassigned (no crash).
  const roleSlots = [];
  if (sections.role && sections.role.length >= 2) {
    const roleHeaders = parseCSVRow(sections.role[0]);
    for (let i = 1; i < sections.role.length; i++) {
      const row = zipRow(roleHeaders, parseCSVRow(sections.role[i]));
      if (!row.title || !row.title.trim()) continue;

      // Resolve group name → groupIndex (0-based index in `groups` array)
      let groupIndex = undefined;
      const groupName = (row.group || row.groupname || row.group_name || "").trim();
      if (groupName) {
        const idx = groups.findIndex(
          (g) => g.name.toLowerCase() === groupName.toLowerCase()
        );
        if (idx !== -1) groupIndex = idx;
      }

      const slot = {
        title: row.title.trim(),
        responsibility: (row.responsibility || "").trim(),
      };
      if (groupIndex !== undefined) slot.groupIndex = groupIndex;
      roleSlots.push(slot);
    }
  }

  // ── [programme] ───────────────────────────────────────────────────────────
  // Statuses are intentionally not parsed: every import starts as `scheduled`.
  const programmes = [];
  if (sections.programme && sections.programme.length >= 2) {
    const progHeaders = parseCSVRow(sections.programme[0]);
    for (let i = 1; i < sections.programme.length; i++) {
      const row = zipRow(progHeaders, parseCSVRow(sections.programme[i]));
      if (!row.title || !row.title.trim()) continue;
      programmes.push({
        title: row.title.trim(),
        startTime: (row.start_time || row.starttime || row.start || "10:00").trim(),
        endTime: (row.end_time || row.endtime || row.end || "").trim(),
        venueOrStage: (row.stage || row.venue || row.venueorstage || "").trim(),
      });
    }
  }

  return { title, venue, groups, roleSlots, programmes };
}

/**
 * Serialise the current event state into a reusable multi-section CSV string.
 * Programme statuses are reset to 'scheduled' so the export is a clean template.
 *
 * @param {{ currentEvent: object, groups: object[], roleSlots: object[], programmes: object[] }} state
 * @returns {string} CSV string ready for download
 */
export function generateEventCSV(state) {
  const { currentEvent, groups = [], roleSlots = [], programmes = [] } = state;

  const lines = [];

  // ── [event] ───────────────────────────────────────────────────────────────
  lines.push("[event]");
  lines.push("title,venue");
  lines.push(
    `${csvEscape(currentEvent?.title || "Event")},${csvEscape(currentEvent?.venue || "TBD")}`
  );
  lines.push("");

  // ── [group] ───────────────────────────────────────────────────────────────
  const cleanGroups = groups.filter((g) => g && String(g.name || "").trim());
  if (cleanGroups.length > 0) {
    lines.push("[group]");
    lines.push("name,icon,description");
    for (const g of cleanGroups) {
      lines.push(
        `${csvEscape(String(g.name).trim())},${csvEscape(g.icon || "📁")},${csvEscape(g.description || "")}`
      );
    }
    lines.push("");
  }

  // ── [role] ────────────────────────────────────────────────────────────────
  const cleanRoles = roleSlots.filter((r) => r && String(r.title || "").trim());
  if (cleanRoles.length > 0) {
    lines.push("[role]");
    lines.push("title,responsibility,group");
    for (const r of cleanRoles) {
      // Resolve groupIndex back to group name (tolerates stale indices)
      let groupName = "";
      if (Number.isInteger(r.groupIndex) && r.groupIndex >= 0 && r.groupIndex < cleanGroups.length) {
        groupName = cleanGroups[r.groupIndex].name;
      } else if (typeof r.group === "string") {
        groupName = r.group;
      }
      lines.push(
        `${csvEscape(String(r.title).trim())},${csvEscape(r.responsibility || "")},${csvEscape(groupName)}`
      );
    }
    lines.push("");
  }

  // ── [programme] ───────────────────────────────────────────────────────────
  // Status column is omitted: re-import always starts programmes as `scheduled`.
  const cleanProgrammes = programmes.filter((p) => p && String(p.title || "").trim());
  if (cleanProgrammes.length > 0) {
    lines.push("[programme]");
    lines.push("title,start_time,end_time,stage");
    for (const p of cleanProgrammes) {
      lines.push(
        `${csvEscape(String(p.title).trim())},${csvEscape(p.startTime || "")},${csvEscape(p.endTime || "")},${csvEscape(p.venue || p.venueOrStage || "")}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a single CSV row, respecting quoted fields (RFC 4180 subset).
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVRow(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Zip header names with data values into a plain object.
 * Keys are normalised (lower-case, no spaces/underscores) so
 * `start_time`, `startTime` and `Start Time` all map to `starttime`.
 * The raw lower-cased key is also kept for compatibility.
 * @param {string[]} headers
 * @param {string[]} values
 * @returns {Record<string, string>}
 */
function zipRow(headers, values) {
  const obj = {};
  headers.forEach((h, i) => {
    const raw = String(h || "").trim().toLowerCase();
    const normalised = raw.replace(/[\s_]+/g, "");
    const value = values[i] !== undefined ? values[i] : "";
    obj[raw] = value;
    obj[normalised] = value;
  });
  return obj;
}

/**
 * Escape a value for CSV output.
 * Wraps in double-quotes if it contains commas, newlines, or double-quotes.
 * @param {string|number|undefined} value
 * @returns {string}
 */
function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
