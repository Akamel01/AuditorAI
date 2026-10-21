import { describe, expect, it } from "vitest";
import {
  crawlDelayMs,
  isAllowed,
  parseRobots,
  type RobotsFile,
} from "../../src/discovery/robots";

// Fixtures are the rules observed on each host during the Track A probe
// (.autoforge/discovery/source-feasibility.md). No network in this file.
const ALBERTA = `User-agent: *
Disallow: /api/
Disallow: /dataset/rate/
Disallow: /dataset/*/history
Crawl-delay: 10
`;

const MONTREAL = `User-agent: *
Disallow: /api/
Disallow: /*?*tags=
Crawl-delay: 10
`;

const BC = `User-agent: *
Disallow: /search
Disallow: /gov/search
Disallow: /en/search/
Disallow: /query.html
`;

const TORONTO = `User-agent: *
Disallow: /wp-admin/
Allow: /
`;

const MANITOBA = `User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: *
Allow: /
`;

function fixture(text: string): RobotsFile {
  return parseRobots(text);
}

describe("parseRobots", () => {
  it("parses groups, rules and crawl-delay", () => {
    const r = fixture(ALBERTA);
    expect(r.allowAll).toBe(false);
    expect(r.denyAll).toBe(false);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].disallow).toEqual(["/api/", "/dataset/rate/", "/dataset/*/history"]);
    expect(crawlDelayMs(r)).toBe(10000);
  });

  it("returns null crawl delay when undeclared", () => {
    expect(crawlDelayMs(fixture(BC))).toBeNull();
  });

  it("keeps consecutive user-agent lines in one group", () => {
    const r = fixture(MANITOBA);
    expect(r.groups).toHaveLength(3);
    expect(r.groups[0].agents).toEqual(["gptbot"]);
    expect(r.groups[1].agents).toEqual(["claudebot"]);
  });
});

describe("isAllowed — host fixtures", () => {
  it("alberta: blocks /api/ and history paths, allows others", () => {
    const r = fixture(ALBERTA);
    expect(isAllowed(r, "/api/3/action/package_show")).toBe(false);
    expect(isAllowed(r, "/dataset/rate/x")).toBe(false);
    expect(isAllowed(r, "/dataset/abc/history")).toBe(false);
    expect(isAllowed(r, "/dataset/abc/resource")).toBe(true);
    expect(isAllowed(r, "/")).toBe(true);
  });

  it("montreal: blocks /api/ and faceted tag queries", () => {
    const r = fixture(MONTREAL);
    expect(isAllowed(r, "/api/3/action/package_show")).toBe(false);
    expect(isAllowed(r, "/dataset/some-slug?tags=transport")).toBe(false);
    expect(isAllowed(r, "/dataset/some-slug")).toBe(true);
  });

  it("bc: blocks search endpoints, allows document and asset paths", () => {
    const r = fixture(BC);
    expect(isAllowed(r, "/gov/search?q=rsa")).toBe(false);
    expect(isAllowed(r, "/search")).toBe(false);
    expect(isAllowed(r, "/en/search/road-safety")).toBe(false);
    expect(isAllowed(r, "/query.html?id=1")).toBe(false);
    expect(isAllowed(r, "/assets/gov/BC/transportation/rsa.pdf")).toBe(true);
  });

  it("toronto: allows everything except /wp-admin/", () => {
    const r = fixture(TORONTO);
    expect(isAllowed(r, "/legdocs/mmis/2024/roadsafety.pdf")).toBe(true);
    expect(isAllowed(r, "/wp-admin/x")).toBe(false);
  });

  it("manitoba: our neutral UA is unaffected by AI-agent bans", () => {
    const r = fixture(MANITOBA);
    expect(isAllowed(r, "/data/rsa.pdf")).toBe(true);
    expect(isAllowed(r, "/data/rsa.pdf", "GPTBot")).toBe(false);
    expect(isAllowed(r, "/data/rsa.pdf", "ClaudeBot")).toBe(false);
  });
});

describe("isAllowed — precedence", () => {
  it("longest match wins", () => {
    const r = fixture(`User-agent: *
Disallow: /a/
Allow: /a/b/
`);
    expect(isAllowed(r, "/a/c")).toBe(false);
    expect(isAllowed(r, "/a/b/c")).toBe(true);
  });

  it("Allow overrides Disallow at equal specificity", () => {
    const r = fixture(`User-agent: *
Disallow: /x/
Allow: /x/
`);
    expect(isAllowed(r, "/x/y")).toBe(true);
  });

  it("an empty Disallow value does not block", () => {
    const r = fixture(`User-agent: *
Disallow:
`);
    expect(isAllowed(r, "/anything")).toBe(true);
  });

  it("allow-all file allows everything and deny-all file denies everything", () => {
    expect(isAllowed({ groups: [], allowAll: true, denyAll: false }, "/x")).toBe(true);
    expect(
      isAllowed(
        { groups: [], allowAll: false, denyAll: true, skipReason: "robots.txt HTTP 403" },
        "/x",
      ),
    ).toBe(false);
  });
});
