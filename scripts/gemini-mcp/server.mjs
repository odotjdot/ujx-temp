/**
 * UJX-Temp / FMOS-Lite Gemini MCP Server
 * Gemini tools: code review, hater-check, implementation, analysis
 * Notion tools: push story, update status, add comment, search
 *
 * Forked from FMOSV2's gemini-mcp on 2026-05-06; system prompt adapted
 * to ujx-temp's stack (Next.js App Router + MySQL + Cognito + Stripe + WC).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- Gemini setup ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  process.stderr.write("GEMINI_API_KEY is required\n");
  process.exit(1);
}

const genai = new GoogleGenerativeAI(GEMINI_API_KEY);

const flash = genai.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: { maxOutputTokens: 8192 },
});

const pro = genai.getGenerativeModel({
  model: "gemini-2.5-pro",
  generationConfig: { maxOutputTokens: 16384 },
});

async function callGemini(model, prompt) {
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// --- Notion setup ---
const NOTION_TOKEN = process.env.NOTION_TOKEN;
if (!NOTION_TOKEN) {
  process.stderr.write("NOTION_TOKEN not set — notion_* tools will fail\n");
}

const NOTION_TASKS_DB_ID = "2b853fb2-b916-806f-bed3-da4c6d98936e";
const NOTION_API_VERSION = "2022-06-28";

async function notionFetch(path, method = "GET", body = null) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_API_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || JSON.stringify(json));
  return json;
}

function toRichText(str) {
  const blocks = [];
  for (let i = 0; i < str.length; i += 2000) {
    blocks.push({ text: { content: str.slice(i, i + 2000) } });
  }
  return blocks;
}

// --- UJX-Temp / FMOS-Lite project system prompt (baked into all Gemini calls) ---
const PROJECT_SYSTEM = `You are a senior engineer reviewing ujx-temp — a forkable Next.js 15 App Router template ("FMOS-Lite") that ships ujamaaexpo.com first and clones for functionunion.com, abmillerday.com, IncPros, and future sites.

Stack:
- Frontend: Next.js 15 App Router, React 19, TypeScript strict, Tailwind 3
- Content: WordPress at hq.funkmedia.net/<tenant> via REST + GraphQL (no Faust, no Apollo)
- Storage: MySQL on fm-aurora-cluster — DB fm_funkmedia, table contact_submissions (multi-tenant via tenant_id column)
- Commerce: WooCommerce on hq.funkmedia.net/<tenant> via WPGraphQL + Stripe Elements
- Auth: AWS Cognito User Pool fm-temp-sites — admin (custom:role=admin) + customer (custom:role=customer), tenant_access CSV attribute
- Email: AWS SES
- Migration target: FMOS Postgres when FMOS is ready

Core rules to enforce (in this project):
- TENANT_ID always from process.env.TENANT_ID — NEVER hardcoded fallback to a tenant slug like 'ujamaaexpo' (this is a forkable template)
- No hardcoded tenant emails like 'info@ujamaaexpo.com' as fallback — env-driven only, throw if missing
- Lib functions throw explicit Error if required env var missing (fail loud, not silent)
- reCAPTCHA v3 server-verified, fails closed (missing secret = reject, NOT bypass)
- Stripe webhooks idempotent via INSERT IGNORE on event_id; side effects only on first delivery
- PaymentIntent created from server-side fresh cart total — never trust client amount
- Cart removeFromCart failure must surface to user — never silent continue
- Order confirmation server-verifies PI from Stripe — never trusts URL params for sensitive data
- mysql2 with .execute() and parameter binding is correct — do NOT recommend pool.query() instead
- Cookies: httpOnly + Secure + SameSite=Lax for auth tokens
- App Router conventions: server components by default, 'use client' only when needed; root app/layout.tsx may NOT export non-Next.js named exports (no helper exports from layout.tsx)
- API responses: { success: true, ...data } or { success: false, error } — consistent shape
- Money is integer cents in code (parseCurrencyToCents from lib/cart-total.ts) — dollars only at display via formatCents()
- No "as any" — fix the type instead
- Multi-tenant: every cross-tenant query filtered by tenant_id from authenticated session/env, never client-supplied
- JWT verification via jose against Cognito JWKS for /console and /dashboard gates
`;

// --- Tool definitions ---
const TOOLS = [
  {
    name: "gemini_code_review",
    description:
      "Code review via Gemini Flash. Pass a git diff and optional story context. Returns structured findings: MUST FIX / SHOULD FIX / NICE TO HAVE with line-level callouts. Fast and cheap — use for every story before /review.",
    inputSchema: {
      type: "object",
      properties: {
        diff: { type: "string", description: "The git diff to review (git diff output)" },
        context: { type: "string", description: "Story context: AC, handler name, what the change is doing (optional)" },
        focus: {
          type: "string",
          description: "Specific area to focus on: security | scope | i18n | types | all (default: all)",
          enum: ["security", "scope", "i18n", "types", "all"],
        },
      },
      required: ["diff"],
    },
  },
  {
    name: "gemini_hater_check",
    description:
      "Brutal AC compliance check via Gemini 2.5 Pro. Grades implementation against written acceptance criteria word-for-word. Returns PASS/FAIL per AC item with evidence. Use at end of epic.",
    inputSchema: {
      type: "object",
      properties: {
        acceptance_criteria: { type: "string", description: "The written AC from Notion — verbatim. This is the contract." },
        implementation: { type: "string", description: "Relevant code, curl output, or file contents to verify against the AC" },
        story_title: { type: "string", description: "Story title for context (optional)" },
      },
      required: ["acceptance_criteria", "implementation"],
    },
  },
  {
    name: "gemini_implement",
    description:
      "Implementation task via Gemini Flash. Describe the task, provide existing code context. Returns complete implementation ready to apply. Use for boilerplate, migrations, handler scaffolding.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "What to implement — be specific. Include handler name, table names, route paths." },
        existing_code: { type: "string", description: "Existing files or code patterns to follow (optional but recommended)" },
        constraints: { type: "string", description: "Additional constraints: schema, role requirements, return shape (optional)" },
      },
      required: ["task"],
    },
  },
  {
    name: "gemini_analyze",
    description:
      "General code analysis via Gemini Flash. Ask any question about code: architecture, bugs, patterns, performance. Large context window — can handle full files.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "What to analyze or answer" },
        code: { type: "string", description: "Code, logs, or data to analyze" },
      },
      required: ["question"],
    },
  },
  {
    name: "notion_push_story",
    description:
      "Create a story, task, or epic in the Notion TASKS database. Returns the created page ID and URL. Use when starting a new story or pushing a SCRUM plan item.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the story/task/epic" },
        level: {
          type: "string",
          enum: ["Epic", "Story", "Task"],
          description: "Work item level (default: Story)",
        },
        status: {
          type: "string",
          enum: ["Not Started", "In Progress", "Waiting", "In Review", "Complete"],
          description: "Status (default: Not Started)",
        },
        priority: {
          type: "string",
          enum: ["Critical", "High", "Medium", "Low"],
          description: "Priority (default: Medium)",
        },
        story_points: { type: "integer", description: "Story points estimate (optional)" },
        acceptance_criteria: { type: "string", description: "AC text — this is the contract (optional)" },
        user_story: { type: "string", description: "As a [role], I want [X] so that [Y] (optional)" },
        sprint_page_id: { type: "string", description: "Notion page ID of the sprint to link (optional)" },
      },
      required: ["title"],
    },
  },
  {
    name: "notion_update_status",
    description:
      "Update the Status of a Notion TASKS page. Use to flip a story In Progress at start, In Review after implementation, Complete after /review passes.",
    inputSchema: {
      type: "object",
      properties: {
        page_id: { type: "string", description: "Notion page ID (UUID)" },
        status: {
          type: "string",
          enum: ["Not Started", "In Progress", "Waiting", "In Review", "Complete"],
          description: "New status value",
        },
      },
      required: ["page_id", "status"],
    },
  },
  {
    name: "notion_add_comment",
    description:
      "Post a comment to a Notion page. Use to record review findings, hater-check results, session notes, or deployment verification.",
    inputSchema: {
      type: "object",
      properties: {
        page_id: { type: "string", description: "Notion page ID (UUID)" },
        body: { type: "string", description: "Comment text (markdown — stored as plain text)" },
      },
      required: ["page_id", "body"],
    },
  },
  {
    name: "notion_search",
    description:
      "Search Notion pages by title. Optionally filter to a specific database. Returns array of matching pages with id, title, and url.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Title search query" },
        database_id: { type: "string", description: "Filter to a specific database ID (optional — defaults to all)" },
      },
      required: ["query"],
    },
  },
];

// --- Server ---
const server = new Server(
  { name: "gemini-ujx-temp", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let text;

    // --- Gemini tools ---
    if (name === "gemini_code_review") {
      const focus = args.focus || "all";
      const focusNote = focus === "all" ? "" : `\nFocus area: ${focus.toUpperCase()} only.`;
      const prompt = `${PROJECT_SYSTEM}

You are doing a code review.${focusNote}
${args.context ? `\nStory context:\n${args.context}` : ""}

Git diff:
\`\`\`diff
${args.diff}
\`\`\`

Return structured findings in exactly this format:

## MUST FIX
- [file:line] Issue description — why it violates project rules

## SHOULD FIX
- [file:line] Issue description

## NICE TO HAVE
- [file:line] Suggestion

## SUMMARY
One sentence overall assessment. Grade: A / B / C / D / F`;

      text = await callGemini(flash, prompt);

    } else if (name === "gemini_hater_check") {
      const prompt = `${PROJECT_SYSTEM}

You are the HATER — a brutal, zero-mercy AC compliance auditor.
Your job: grade the implementation against the WRITTEN acceptance criteria, word for word.
If AC says "returns 201" and it returns 200, FAIL. No partial credit. No interpretation.

${args.story_title ? `Story: ${args.story_title}\n` : ""}

ACCEPTANCE CRITERIA (the contract):
${args.acceptance_criteria}

IMPLEMENTATION (code/curl output/files):
${args.implementation}

Grade each AC item PASS or FAIL with evidence. Then give an overall verdict.

Format:
## AC COMPLIANCE

### [AC Item 1 text]
**PASS** / **FAIL** — Evidence: [quote the code or output that proves it]

### [AC Item N text]
...

## OVERALL VERDICT
**PASS** / **FAIL**
Grade: A / B / C / D / F
Summary: [one brutal sentence]

## BLOCKERS (if any FAIL)
- What specifically must change before this ships`;

      text = await callGemini(pro, prompt);

    } else if (name === "gemini_implement") {
      const prompt = `${PROJECT_SYSTEM}

Implementation task:
${args.task}

${args.existing_code ? `Existing code to follow:\n${args.existing_code}` : ""}
${args.constraints ? `\nConstraints:\n${args.constraints}` : ""}

Return complete, production-ready code. No placeholders. No TODOs. No mock data.
Follow all project rules above exactly.`;

      text = await callGemini(flash, prompt);

    } else if (name === "gemini_analyze") {
      const prompt = `${PROJECT_SYSTEM}

Question: ${args.question}
${args.code ? `\nCode/data:\n${args.code}` : ""}

Be direct. No fluff.`;

      text = await callGemini(flash, prompt);

    // --- Notion tools ---
    } else if (name === "notion_push_story") {
      const props = {
        Name: { title: [{ text: { content: args.title } }] },
        Status: { status: { name: args.status || "Not Started" } },
        Priority: { select: { name: args.priority || "Medium" } },
        Level: { select: { name: args.level || "Story" } },
      };
      if (args.story_points != null) props["Story Points"] = { number: args.story_points };
      if (args.acceptance_criteria) props["Acceptance Criteria"] = { rich_text: toRichText(args.acceptance_criteria) };
      if (args.user_story) props["Description"] = { rich_text: toRichText(args.user_story) };
      if (args.sprint_page_id) props["Sprint"] = { relation: [{ id: args.sprint_page_id }] };

      const page = await notionFetch("/pages", "POST", {
        parent: { database_id: NOTION_TASKS_DB_ID },
        properties: props,
      });

      text = JSON.stringify({ id: page.id, url: page.url });

    } else if (name === "notion_update_status") {
      await notionFetch(`/pages/${args.page_id}`, "PATCH", {
        properties: { Status: { status: { name: args.status } } },
      });
      text = `Status updated to "${args.status}" on page ${args.page_id}`;

    } else if (name === "notion_add_comment") {
      await notionFetch("/comments", "POST", {
        parent: { page_id: args.page_id },
        rich_text: toRichText(args.body),
      });
      text = `Comment posted to page ${args.page_id}`;

    } else if (name === "notion_search") {
      const body = { query: args.query, page_size: 10 };
      if (args.database_id) {
        body.filter = { property: "object", value: "page" };
      }
      const res = await notionFetch("/search", "POST", body);

      const results = (res.results || [])
        .filter((r) => {
          if (!args.database_id) return true;
          return r.parent?.database_id?.replace(/-/g, "") === args.database_id.replace(/-/g, "");
        })
        .map((r) => ({
          id: r.id,
          title: r.properties?.Name?.title?.[0]?.plain_text || r.properties?.title?.title?.[0]?.plain_text || "(untitled)",
          url: r.url,
        }));

      text = JSON.stringify(results, null, 2);

    } else {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    return { content: [{ type: "text", text }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: `${name.startsWith("notion") ? "Notion" : "Gemini"} error: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("Gemini MCP server running (v1.1.0 — Gemini + Notion)\n");
