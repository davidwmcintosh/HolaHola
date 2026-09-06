type Options = Record<string, string | boolean>;

const commands = new Set(["list", "show", "create", "revision", "ready", "claim", "approve", "reject", "export"]);
const mutationCommands = new Set(["create", "revision", "ready", "claim", "approve", "reject"]);

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(64);
}
function parse(argv: string[]): { command: string; options: Options } {
  const command = argv.shift();
  if (!command || !commands.has(command)) fail("Usage: shared-spec-cli <list|show|create|revision|ready|claim|approve|reject|export> --url URL --token TOKEN");
  const options: Options = {};
  while (argv.length) {
    const part = argv.shift()!;
    if (!part.startsWith("--")) fail(`Unexpected argument: ${part}`);
    const name = part.slice(2);
    const value = argv[0] && !argv[0].startsWith("--") ? argv.shift()! : true;
    if (!name || options[name] !== undefined) fail(`Invalid or repeated option: ${part}`);
    options[name] = value;
  }
  return { command, options };
}
function required(options: Options, name: string): string {
  const value = options[name];
  if (typeof value !== "string" || !value) fail(`--${name} is required`);
  return value;
}
function json(value: string | boolean | undefined, name: string): unknown {
  if (typeof value !== "string") return undefined;
  try { return JSON.parse(value); } catch { fail(`--${name} must be JSON`); }
}

export async function runSharedSpecCli(argv = process.argv.slice(2)): Promise<void> {
  const { command, options } = parse(argv);
  const baseUrl = required(options, "url").replace(/\/$/, "");
  const token = required(options, "token");
  const documentId = typeof options.id === "string" ? options.id : "";
  let path = "/documents";
  let method = "GET";
  let body: Record<string, unknown> | undefined;
  if (command === "show") path = `/documents/${required(options, "id")}`;
  if (command === "export") path = `/documents/${required(options, "id")}/export`;
  if (command === "create") { method = "POST"; body = { title: required(options, "title"), kind: required(options, "kind"), repository: required(options, "repository"), gitPath: required(options, "path"), markdown: required(options, "markdown"), summary: options.summary }; }
  if (command === "revision") { method = "POST"; path = `/documents/${required(options, "id")}/revisions`; body = { baseRevisionId: required(options, "base"), markdown: required(options, "markdown") }; }
  if (command === "ready") { method = "POST"; path = `/documents/${required(options, "id")}/ready`; body = { revisionId: required(options, "revision"), requestedReviewerActorId: options.reviewer }; }
  if (command === "claim") { method = "POST"; path = `/reviews/${required(options, "id")}/claim`; body = {}; }
  if (command === "approve" || command === "reject") { method = "POST"; path = `/reviews/${required(options, "id")}/${command}`; body = { rationale: options.rationale, evidenceReferences: json(options.evidence, "evidence") }; }
  const headers: Record<string, string> = { "x-shared-spec-token": token };
  if (mutationCommands.has(command)) {
    headers["idempotency-key"] = required(options, "idempotency-key");
    headers["content-type"] = "application/json";
  }
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const output = command === "export" ? await response.text() : JSON.stringify(await response.json(), null, 2);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${output}`);
  process.stdout.write(`${output}\n`);
}

if (process.argv[1]?.includes("shared-spec-cli")) {
  runSharedSpecCli().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}