import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { scrubEnv } from "./scrub-env.js";

describe("scrubEnv", () => {
  const PREV = process.env.CCATHOME_PASS_ENV;

  afterEach(() => {
    if (PREV === undefined) delete process.env.CCATHOME_PASS_ENV;
    else process.env.CCATHOME_PASS_ENV = PREV;
  });

  it("strips secret-like keys and keeps safe ones", () => {
    delete process.env.CCATHOME_PASS_ENV;
    const out = scrubEnv({
      PATH: "/usr/bin",
      HOME: "/home/u",
      GITHUB_TOKEN: "secret",
      NPM_TOKEN: "npm",
      MY_API_KEY: "k",
      AWS_SECRET_ACCESS_KEY: "aws",
      DATABASE_URL: "postgres://x",
      NORMAL_VAR: "ok",
    });
    expect(out.PATH).toBe("/usr/bin");
    expect(out.NORMAL_VAR).toBe("ok");
    expect(out.GITHUB_TOKEN).toBeUndefined();
    expect(out.NPM_TOKEN).toBeUndefined();
    expect(out.MY_API_KEY).toBeUndefined();
    expect(out.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(out.DATABASE_URL).toBeUndefined();
    expect(out.PAGER).toBe("cat");
    expect(out.GIT_TERMINAL_PROMPT).toBe("0");
  });

  it("passes through when CCATHOME_PASS_ENV=1", () => {
    const out = scrubEnv({
      CCATHOME_PASS_ENV: "1",
      GITHUB_TOKEN: "secret",
      PATH: "/bin",
    });
    expect(out.GITHUB_TOKEN).toBe("secret");
    expect(out.PAGER).toBe("cat");
  });
});
