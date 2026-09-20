# Sangam Brand Theme Refresh

## Goal

Align the complete Sangam interface with the supplied logo while keeping the product a clear, light-weight event command center. The refreshed ambience should feel connected, energetic, and trustworthy rather than generic SaaS or neon festival UI.

## Scope

### In scope

- Add a deployable Sangam vector brand mark based on the supplied logo.
- Use the mark on the landing/auth entry surfaces and the workspace sidebar.
- Replace the current pink, purple, cyan, and black decorative system with a brand system built around navy, blue, green/teal, orange/yellow, and warm neutrals.
- Update landing auroras, hero gradient text, CTA buttons, focus states, workspace accents, role badges, AI marks, and status treatments.
- Preserve all existing content, navigation, role permissions, AI behavior, data behavior, and mobile drawer behavior.
- Verify desktop and mobile entry/workspace views plus the existing test suite.

### Out of scope

- Rebuilding the information architecture or changing page content.
- Changing authentication, Supabase, AI, email, or event state logic.
- Redesigning the supplied logo artwork beyond a reusable vector approximation of the mark.
- Adding a dark mode or a second theme.

### Must not change

- Existing DOM IDs and JavaScript event contracts.
- Role/status meanings and permission behavior.
- Existing responsive breakpoints and drawer interactions unless a color/asset change requires a visual adjustment.

## Brand Decisions

### Palette roles

- **Navy:** primary text, high-contrast controls, workspace authority, and logo wordmark tone.
- **Orange/yellow:** primary action, active brand energy, highlights, and key metrics.
- **Blue:** navigation focus, manager/system information, links, and selected states.
- **Green/teal:** collaboration, people/team states, healthy/connected states, and AI availability.
- **Warm white/soft green-gray:** page and surface backgrounds.
- **Red:** reserved for live/urgent status so it remains semantically meaningful and is not replaced by logo colors.

### Logo usage

- Landing/auth/gateway: mark plus the existing Sangam text treatment, with the full tagline represented where space allows.
- Workspace: icon-only mark beside the existing `SANGAM` label and subtitle.
- Favicon: retain the existing inline fallback for zero-network loading, but recolor it to the brand palette.

## Integration Flow

`sangam-mark.svg` -> `<img>` in entry/workspace brand surfaces -> CSS token system -> component states and gradients -> desktop/mobile visual verification.

## File Changes

1. `submissions/team-linx/app/assets/sangam-mark.svg`
   - Add a transparent vector mark using the logo’s three-person/sun concept and brand colors.
2. `submissions/team-linx/app/index.html`
   - Add mark images to landing, auth/gateway brand surfaces, and workspace sidebar.
   - Update favicon colors and accessible image labeling.
3. `submissions/team-linx/app/style.css`
   - Replace global tokens and hard-coded decorative colors.
   - Restyle entry auroras, buttons, text gradients, workspace accents, status/role tags, AI surfaces, and planner accents to use the brand roles.
   - Preserve layout, sizing, and responsive behavior except for small logo alignment rules.

## Verification Strategy

- Run the existing Playwright test command from `submissions/team-linx/app`.
- Serve the static app and inspect landing, login, signup, gateway, dashboard, groups/chat, and AI drawer at desktop and mobile widths.
- Confirm no remaining pink/magenta/purple primary branding survives outside intentionally semantic error/status colors.
- Confirm mark images load from the project path and do not rely on the Downloads folder.
- Confirm keyboard focus remains visible and text/buttons retain contrast against the new colors.

## Acceptance Criteria

- The landing/auth/gateway and workspace clearly share one Sangam visual language.
- The supplied logo’s navy, blue, green/teal, and orange/yellow colors are recognizable in the interface without making every component multicolor.
- Primary actions are visibly branded and readable.
- Live, delayed, upcoming, completed, and role states remain distinguishable and semantically stable.
- Existing JS behavior and DOM hooks remain intact.
- Existing automated tests pass.
- Desktop and mobile layouts remain usable with no horizontal overflow caused by the branding changes.

## Task Breakdown

1. Add the vector mark asset and brand image hooks in HTML. Depends on no other task.
2. Replace the global color tokens and entry/workspace styling in CSS. Depends on task 1 for final asset proportions, but can be implemented in the same pass.
3. Run automated and browser-based visual verification. Depends on tasks 1 and 2.
4. Review the diff for scope control and confirm unrelated worktree changes were not altered. Depends on task 3.

## Rollback

Revert only the new SVG, HTML brand hooks, and CSS theme changes. No persisted data, API contracts, or migrations are involved.
