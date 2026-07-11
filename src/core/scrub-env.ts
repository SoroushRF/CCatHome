/**
 * Build child-process env with obvious secrets stripped unless CCATHOME_PASS_ENV=1.
 */
export function scrubEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {
    PAGER: "cat",
    GIT_PAGER: "cat",
    GIT_TERMINAL_PROMPT: "0",
    GIT_EDITOR: "true",
    EDITOR: "true",
  };
  if (base.CCATHOME_PASS_ENV === "1") {
    return {
      ...base,
      PAGER: "cat",
      GIT_PAGER: "cat",
      GIT_TERMINAL_PROMPT: "0",
      GIT_EDITOR: "true",
      EDITOR: "true",
    };
  }
  const secretName = /(_TOKEN|_SECRET|_PASSWORD|_PASS|API_KEY|AWS_|AZURE_|GITHUB_TOKEN|NPM_TOKEN)/i;

  for (const [key, value] of Object.entries(base)) {
    if (value === undefined) continue;
    if (secretName.test(key)) continue;
    out[key] = value;
  }
  return out;
}
