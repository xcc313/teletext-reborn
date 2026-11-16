# Requirements Document

## Introduction

Teletext Reborn resurrects broadcast teletext — the blocky, numbered-page information service that died with analog TV — as a live, AI-powered web terminal. Agents fetch and summarize real-time data into authentic 40×25 teletext pages. MVP scope: page 100 (index), 101 (news), 302 (weather), 888 (about). The app must be fully functional for judges with zero API keys configured (demo fallback). All implementation is executed by Kiro from tasks.md, test-first.

## Requirements

### Requirement 1: Teletext Page Rendering

**User Story:** As a viewer, I want pages rendered as authentic 40×25 teletext grids, so that the service looks and feels like 1985 broadcast teletext.

#### Acceptance Criteria

1. WHEN a page is loaded THE SYSTEM SHALL render a grid of exactly 40 columns × 25 rows.
2. WHEN rendering any cell THE SYSTEM SHALL use only the 8-color teletext palette (black, red, green, yellow, blue, magenta, cyan, white).
3. WHEN a page is rendered THE SYSTEM SHALL display the page number (100–899) and service name in the header row (row 0).
4. IF a content line exceeds 40 columns THEN THE SYSTEM SHALL wrap or truncate it according to the typesetting rules in steering, never overflowing the grid.
5. WHEN a page is rendered THE SYSTEM SHALL display four fastext navigation links in the bottom row (row 24), colored red, green, yellow, and cyan respectively.

### Requirement 2: Page Navigation

**User Story:** As a viewer, I want to navigate by entering three-digit page numbers or clicking fastext links, so that I can browse the service like a real teletext TV.

#### Acceptance Criteria

1. WHEN the viewer enters a valid three-digit page number (100–899) THE SYSTEM SHALL load that page.
2. IF the entered page number does not exist THEN THE SYSTEM SHALL display a teletext-styled "page not found" page and allow further navigation.
3. WHEN the viewer activates a fastext link THE SYSTEM SHALL navigate to its target page.
4. WHILE a page number is being typed THE SYSTEM SHALL show the partial entry in the header area.

### Requirement 3: Live Weather Page (302)

**User Story:** As a viewer, I want a live weather page, so that the terminal shows genuinely current information rather than static mock content.

#### Acceptance Criteria

1. WHEN the weather pipeline runs THE SYSTEM SHALL fetch current conditions and a short forecast from the Open-Meteo API for a configured location.
2. WHEN fresh weather data arrives THE SYSTEM SHALL regenerate page 302 within the configured refresh interval.
3. IF the weather fetch fails THEN THE SYSTEM SHALL keep the last successfully generated page and mark it stale in the header.
4. WHERE no location is configured THE SYSTEM SHALL use the default location disclosed in the README.

### Requirement 4: Live News Page (101)

**User Story:** As a viewer, I want a live news headlines page, so that I can glance at current stories in teletext form.

#### Acceptance Criteria

1. WHERE a news API key is configured THE SYSTEM SHALL fetch headlines from the configured provider.
2. WHERE no news API key is configured THE SYSTEM SHALL render a bundled demo feed so the app remains fully functional for judging.
3. WHEN headlines are fetched THE SYSTEM SHALL summarize each item into teletext-compatible lines of at most 40 columns.
4. IF the news fetch fails THEN THE SYSTEM SHALL fall back to the last good content or the bundled demo feed.

### Requirement 5: Content Pipeline and Validation Gate

**User Story:** As a developer, I want every generated page validated before display, so that a broken page can never reach the screen.

#### Acceptance Criteria

1. WHEN source data changes THE SYSTEM SHALL run the typesetter to produce a valid Page model.
2. THE SYSTEM SHALL validate every generated page against the grid, palette, header, and fastext invariants before display.
3. WHEN a page fails validation THE SYSTEM SHALL reject it, log the violation, and keep the last good page displayed.

### Requirement 6: Correctness via Property-Based Testing

**User Story:** As a developer, I want property-based tests for the renderer and typesetter, so that edge cases (long headlines, unusual characters, overflow) are caught beyond example-based unit tests.

#### Acceptance Criteria

1. THE SYSTEM SHALL include property-based tests asserting that for any generated page: dimensions are exactly 40×25, all colors belong to the palette, and the header matches the page-number format.
2. THE SYSTEM SHALL include property-based tests asserting that for arbitrary input text the typesetter never emits a line longer than 40 columns.

