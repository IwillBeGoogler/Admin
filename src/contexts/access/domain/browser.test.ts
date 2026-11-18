import { describe, expect, it } from "vitest";
import { browserName, osName } from "./access";

describe("browserName", () => {
  it.each([
    ["Mozilla/5.0 Chrome/120 Safari/537 Edg/120", "Edge"],
    ["Mozilla/5.0 Chrome/120 OPR/100", "Opera"],
    ["Mozilla/5.0 Firefox/120", "Firefox"],
    ["Mozilla/5.0 Chrome/120 Safari/537", "Chrome"],
    ["Mozilla/5.0 Version/17 Safari/605", "Safari"],
    ["curl/8.4", "CLI"],
    ["???", "Other"],
  ])("%s is %s", (ua, want) => expect(browserName(ua)).toBe(want));
});

describe("osName", () => {
  it.each([
    ["Windows NT 10.0", "Windows"],
    ["iPhone OS 17", "iOS"],
    ["Linux; Android 14", "Android"],
    ["Macintosh; Intel Mac OS X", "macOS"],
    ["X11; CrOS x86_64", "ChromeOS"],
    ["X11; Linux x86_64", "Linux"],
    ["???", "Other"],
  ])("%s is %s", (ua, want) => expect(osName(ua)).toBe(want));
});
