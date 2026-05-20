import { Router, type IRouter } from "express";
import { db, questionSetsTable, questionsTable, foldersTable } from "@workspace/db";
import { eq, asc, inArray, and } from "drizzle-orm";

const router: IRouter = Router();

const API_HOSTS = ["mujib.chorcha.net", "tarek.chorcha.net"];

function chorchaHeaders(token: string): Record<string, string> {
  return {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,bn;q=0.8",
    Origin: "https://chorcha.net",
    Referer: "https://chorcha.net/",
    Authorization: `Bearer ${token}`,
    Cookie: `token=${token}`,
    "x-chorcha-mode": "api",
    "x-chorcha-platform": "web",
  };
}

const MCQ_OPTION_LETTERS = ["A", "B", "C", "D", "E"] as const;
const CQ_PART_LETTERS = ["A", "B", "C", "D"] as const;
const CQ_PART_LABELS: Record<string, string> = { A: "ক", B: "খ", C: "গ", D: "ঘ" };

const NOISE_FIELDS = new Set<string>([
  "_id", "id", "type", "qType", "answer", "answers", "meta", "createdAt", "updatedAt",
  "tags", "tag", "category", "subject", "chapter", "topic", "difficulty", "marks", "mark",
  "duration", "order", "index", "isActive", "active", "status", "board", "year", "examType",
  "questionType", "language", "qCount", "_v", "__v", "v", "short_name", "name", "title",
  "slug", "db", "teacher_id", "teacherId", "teacher_uid", "teacherUid", "user_id", "userId",
  "uploaded_by", "uploadedBy", "approved", "approved_by", "approvedBy", "approvedAt",
  "creator", "owner", "owner_id", "ownerId", "comments", "report", "reported", "votes",
  "score", "view", "views", "stats", "qid",
]);

interface MetaSubQuestion {
  _id?: string;
  question?: string;
  A?: string; B?: string; C?: string; D?: string; E?: string;
  answer?: string;
  solution?: string;
  [key: string]: unknown;
}

interface RawQuestion {
  _id?: string;
  type?: string;
  qType?: string;
  questionType?: string;
  question?: string;
  answer?: string;
  solution?: string;
  meta?: {
    question?: MetaSubQuestion[];
    ai_explanation?: {
      explanation?: string;
      cq_solve?: Record<string, string>;
      mcq_solve?: Record<string, string> | string;
    };
  };
  [key: string]: unknown;
}

const SOLUTION_PLACEHOLDERS = new Set(["upgrade", "Upgrade", "UPGRADE", "premium", "locked", ""]);

interface DecodedOption { letter: string; text: string; }
interface DecodedPart { key: string; label: string; text: string; solution: string | null; aiSolution: string | null; }
interface DecodedQuestion {
  id: string; index: number; type: "mcq" | "cq" | "sq" | "unknown";
  question: string; stemImages: string[];
  options: DecodedOption[]; parts: DecodedPart[];
  answer: string | null; solution: string | null; aiExplanation: string | null;
  extraFields: Record<string, string>; debug: Record<string, string>; hidden?: boolean;
}

function dcode(text: unknown, key: string): string {
  if (typeof text !== "string" || !key) return "";
  let out = "";
  for (let i = 0; i < text.length; i++) {
    out += String.fromCharCode(text.charCodeAt(i) - key.charCodeAt(i % 16));
  }
  return out;
}

function absolutizeImageUrl(rawSrc: string): string {
  const src = rawSrc.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
  if (!src) return src;
  if (/^(?:data:|blob:|https?:\/\/)/i.test(src)) return src;
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("/")) return `https://chorcha.net${src}`;
  return `https://chorcha.net/${src.replace(/^\.?\/*/, "")}`;
}

function extractImageUrls(cleanedText: string): string[] {
  const out: string[] = [];
  const re = /\[IMG:([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleanedText)) !== null) {
    const url = m[1].trim();
    if (url) out.push(url);
  }
  return out;
}

const MATH_CMD_RE = /\\(?:frac|sqrt|int|sum|prod|lim|left|right|times|cdot|cdots|ldots|pm|approx|equiv|neq|leq|geq|subset|supset|in|notin|to|Rightarrow|rightarrow|leftarrow|Leftrightarrow|alpha|beta|gamma|delta|epsilon|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|nabla|partial|infty|hbar|vec|hat|bar|tilde|overline|underline|begin|end|binom|log|ln|sin|cos|tan|cot|sec|csc|exp|det|max|min|gcd|forall|exists|mathbb|mathbf|mathrm|text)\b/;

function wrapNakedMathLines(text: string): string {
  return text.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith("$") || trimmed.startsWith("\\[") || trimmed.startsWith("\\(") || trimmed.startsWith("[IMG:") || trimmed.startsWith("[TABLE_HTML:")) return line;
    // Don't wrap lines that already contain any math delimiters — prevents double-wrapping
    // e.g. "বেগ \( v = \frac{a}{b} \) m/s" already has \( \) so skip
    if (trimmed.includes("\\(") || trimmed.includes("\\)") || trimmed.includes("\\[") || trimmed.includes("\\]") || trimmed.includes("$")) return line;
    const count = (trimmed.match(new RegExp(MATH_CMD_RE.source, "g")) ?? []).length;
    if (/[\u0980-\u09FF]/.test(trimmed)) return line;
    if (count >= 2 || (count >= 1 && /[{}^_]/.test(trimmed))) return `$$${trimmed}$$`;
    return line;
  }).join("\n");
}

function cleanHtml(html: string | null | undefined): string {
  if (!html) return "";
  let out = html;
  out = out.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
    // Strip dangerous attrs first, THEN replace img tags so added styles aren't stripped
    const safe = match
      .replace(/\s+on\w+="[^"]*"/gi, "")
      .replace(/\s+style="[^"]*"/gi, "")
      .replace(/\s+class="[^"]*"/gi, "")
      .replace(/<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*?\/?>/gi, (_m, src: string) => `<img src="${absolutizeImageUrl(src)}" style="max-width:100%;height:auto;background:#fff;padding:2px;border-radius:4px" loading="lazy" />`);
    const encoded = Buffer.from(safe, "utf-8").toString("base64");
    return `\n[TABLE_HTML:${encoded}]\n`;
  });
  out = out
    .replace(/<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*?\/?>/gi, (_match, src: string) => `\n[IMG:${absolutizeImageUrl(src)}]\n`)
    .replace(/<source\b[^>]*?\bsrcset=["']([^,"']+)[^"']*["'][^>]*?\/?>/gi, (_match, src: string) => `\n[IMG:${absolutizeImageUrl(src)}]\n`)
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n").replace(/<li[^>]*>/gi, "• ").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, " ")
    .replace(/\r\n?/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  out = wrapNakedMathLines(out);
  return out;
}

function extractReadId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/read\/([A-Za-z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

function extractToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const cookies: Array<{ name?: string; value?: string }> = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { cookies?: unknown[] })?.cookies)
          ? (parsed as { cookies: Array<{ name?: string; value?: string }> }).cookies
          : [parsed as { name?: string; value?: string }];
      const tokenCookie = cookies.find((c) => typeof c?.name === "string" && c.name === "token");
      if (tokenCookie?.value) return String(tokenCookie.value).trim();
    } catch { /* fall through */ }
  }
  if (trimmed.includes("token=")) {
    const match = trimmed.match(/(?:^|;\s*)token=([^;\s]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return trimmed;
}

const SOLUTION_FIELD_NAMES = ["solution", "solutions", "sol", "explanation", "explain", "description", "desc", "answer_description", "answerDescription"];

function findRawSolutionField(q: RawQuestion): { fieldName: string; raw: string } {
  for (const key of SOLUTION_FIELD_NAMES) {
    const v = q[key];
    if (typeof v === "string" && v.length > 0 && !SOLUTION_PLACEHOLDERS.has(v.trim())) {
      return { fieldName: key, raw: v };
    }
  }
  return { fieldName: "", raw: "" };
}

function tryParseSolutionMap(rawDecoded: string): Record<string, string> | null {
  if (!rawDecoded) return null;
  let trimmed = rawDecoded.trim();
  if (trimmed.charCodeAt(0) === 0xfeff) trimmed = trimmed.slice(1);
  const startIdx = trimmed.indexOf("{");
  const endIdx = trimmed.lastIndexOf("}");
  if (startIdx < 0 || endIdx <= startIdx) return null;
  let candidate = trimmed.slice(startIdx, endIdx + 1);
  candidate = candidate.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  const collect = (parsed: unknown): Record<string, string> | null => {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
      else if (v && typeof v === "object" && "text" in (v as object)) {
        const t = (v as { text?: unknown }).text;
        if (typeof t === "string") out[k] = t;
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  };
  try { const r = collect(JSON.parse(candidate)); if (r) return r; } catch { /* next */ }
  const regexMap: Record<string, string> = {};
  const inner = candidate.slice(1, -1);
  const pairRegex = /"([A-Za-z0-9_\u0980-\u09FF]{1,8})"\s*:\s*"([\s\S]*?)"\s*(?=,\s*"[A-Za-z0-9_\u0980-\u09FF]{1,8}"\s*:|$)/g;
  for (const m of inner.matchAll(pairRegex)) {
    const key = m[1]; const value = m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    if (key && value) regexMap[key] = value;
  }
  return Object.keys(regexMap).length > 0 ? regexMap : null;
}

function splitCqExplanation(text: string): Record<string, string> | null {
  if (!text) return null;
  const BANG_TO_LETTER: Record<string, string> = { ক: "A", খ: "B", গ: "C", ঘ: "D" };
  const attempts = [
    { pattern: /\(([কখগঘ])\)\s*:?\s*/g, map: BANG_TO_LETTER },
    { pattern: /\(([A-D])\)\s*:?\s*/g, map: null as null | Record<string, string> },
  ];
  for (const { pattern, map } of attempts) {
    const markerPositions: Array<{ key: string; markerStart: number; contentStart: number }> = [];
    let m: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(text)) !== null) {
      const raw = m[1];
      const key = map ? map[raw] : raw;
      if (!key) continue;
      markerPositions.push({ key, markerStart: m.index, contentStart: re.lastIndex });
    }
    if (markerPositions.length < 2) continue;
    const result: Record<string, string> = {};
    for (let i = 0; i < markerPositions.length; i++) {
      const start = markerPositions[i].contentStart;
      const end = i + 1 < markerPositions.length ? markerPositions[i + 1].markerStart : text.length;
      const content = text.slice(start, end).trim();
      if (content) result[markerPositions[i].key] = content;
    }
    if (Object.keys(result).length > 0) return result;
  }
  return null;
}

function findPartSolutionsByField(q: RawQuestion, decodeKey: string): Record<string, string> {
  const out: Record<string, string> = {};
  const candidatesFor = (letter: string): string[] => {
    const lower = letter.toLowerCase();
    return [`sol${letter}`, `sol_${letter}`, `sol${lower}`, `sol_${lower}`, `solution${letter}`, `solution${lower}`, `${letter}_sol`, `${lower}_sol`, `${letter}_solution`, `${lower}_solution`];
  };
  for (const letter of CQ_PART_LETTERS) {
    for (const cand of candidatesFor(letter)) {
      const v = q[cand];
      if (typeof v === "string" && v.length > 0) {
        const decoded = cleanHtml(dcode(v, decodeKey));
        if (decoded) { out[letter] = decoded; break; }
      }
    }
  }
  return out;
}

function detectExplicitType(q: RawQuestion): "mcq" | "cq" | null {
  const explicit = (q.type ?? q.qType ?? q.questionType ?? "").toString().toLowerCase();
  if (explicit === "cq" || explicit === "creative" || explicit.includes("cq")) return "cq";
  if (explicit === "mcq" || explicit === "multiple-choice" || explicit.includes("mcq")) return "mcq";
  return null;
}

function autoDetectTypeFromName(name: string): "mcq" | "cq" | "sq" | null {
  const lower = name.toLowerCase();
  if (lower.includes("mcq") || lower.includes("multiple choice") || lower.includes("বহুনির্বাচনি")) return "mcq";
  if (lower.includes(" cq") || lower.includes("creative") || lower.includes("srijonshil") || lower.includes("সৃজনশীল") || lower.includes("-cq") || lower.endsWith("cq")) return "cq";
  if (lower.includes("sq") || lower.includes("short question") || lower.includes("সংক্ষিপ্ত")) return "sq";
  return null;
}

function buildMcqAiExplanation(type: "mcq" | "cq" | "sq" | "unknown", q: RawQuestion, cqSolveByLetter: Record<string, string>): string | null {
  const explanation = q.meta?.ai_explanation?.explanation;
  if (typeof explanation === "string" && explanation.trim().length > 0) return cleanHtml(explanation) || null;
  if (type !== "mcq") return null;
  const mcqSolve = q.meta?.ai_explanation?.mcq_solve;
  if (typeof mcqSolve === "string" && mcqSolve.trim().length > 0) return cleanHtml(mcqSolve) || null;
  if (Object.keys(cqSolveByLetter).length > 0) {
    const order = ["A", "B", "C", "D", "E"];
    const entries = Object.entries(cqSolveByLetter)
      .map(([k, v]) => [k.toUpperCase(), v] as const)
      .filter(([, v]) => v.trim().length > 0)
      .sort(([a], [b]) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)));
    const parts = entries.map(([letter, value]) => { const cleaned = cleanHtml(value); return cleaned ? `(${CQ_PART_LABELS[letter] ?? letter}) ${cleaned}` : ""; });
    const joined = parts.filter(Boolean).join("\n\n");
    return joined || null;
  }
  return null;
}

// Decodes a sub-question from meta.question[] array — these are plain HTML (not cipher-encoded)
function decodeMetaSubQuestion(
  parent: RawQuestion,
  sub: MetaSubQuestion,
  index: number,
  decodeKey: string,
  typeHint: "mcq" | "cq" | "sq" | null,
): DecodedQuestion {
  const questionText = cleanHtml(sub.question ?? "");
  // Decode parent's question field as the stem/passage context
  const stemDecoded = cleanHtml(dcode(parent.question ?? "", decodeKey));
  const stemImages = extractImageUrls(stemDecoded);

  if (typeHint === "sq") {
    return {
      id: `${parent._id ?? String(index)}_s${index}`, index: index + 1, type: "sq",
      question: questionText, stemImages, options: [], parts: [],
      answer: typeof sub.answer === "string" ? cleanHtml(sub.answer) || null : null,
      solution: typeof sub.solution === "string" ? cleanHtml(sub.solution) || null : null,
      aiExplanation: null, extraFields: {}, debug: {},
    };
  }

  const options: DecodedOption[] = [];
  for (const l of MCQ_OPTION_LETTERS) {
    const raw = sub[l];
    if (typeof raw === "string" && raw.length > 0) {
      const text = cleanHtml(raw);
      if (text) options.push({ letter: l, text });
    }
  }
  const answer = typeof sub.answer === "string" && /^[A-E]$/i.test(sub.answer.trim())
    ? sub.answer.trim().toUpperCase() : null;
  const solution = typeof sub.solution === "string" ? cleanHtml(sub.solution) || null : null;
  const aiRaw = parent.meta?.ai_explanation?.explanation;
  const aiExplanation = typeof aiRaw === "string" && aiRaw.trim() ? cleanHtml(aiRaw) || null : null;

  return {
    id: `${parent._id ?? String(index)}_s${index}`, index: index + 1,
    type: typeHint === "cq" ? "cq" : "mcq",
    question: questionText, stemImages, options, parts: [],
    answer, solution, aiExplanation, extraFields: {}, debug: {},
  };
}

function decodeQuestion(q: RawQuestion, index: number, decodeKey: string, typeHint: "mcq" | "cq" | "sq" | null = null): DecodedQuestion {
  // SQ (Short Question): no options, no lettered parts — just question text + written answer + solution
  if (typeHint === "sq") {
    const questionDecoded = cleanHtml(dcode(q.question, decodeKey));
    const { raw: rawSolution } = findRawSolutionField(q);
    const decodedSol = rawSolution ? cleanHtml(dcode(rawSolution, decodeKey)) : null;
    const aiRaw = q.meta?.ai_explanation?.explanation;
    const aiExplanation = typeof aiRaw === "string" && aiRaw.trim() ? cleanHtml(aiRaw) || null : null;
    const cleanedQ = questionDecoded.replace(/\[IMG:[^\]]+\]/g, "").replace(/\n{3,}/g, "\n\n").trim();
    const stemImages = extractImageUrls(questionDecoded);
    return {
      id: q._id ?? String(index), index: index + 1, type: "sq",
      question: cleanedQ, stemImages, options: [], parts: [],
      answer: typeof q.answer === "string" && q.answer.trim() ? cleanHtml(dcode(q.answer, decodeKey)) || q.answer.trim() : null,
      solution: decodedSol || null, aiExplanation, extraFields: {}, debug: {},
    };
  }

  const explicit = detectExplicitType(q);
  const { fieldName: solutionFieldName, raw: rawSolution } = findRawSolutionField(q);
  const decodedSolutionRaw = rawSolution ? dcode(rawSolution, decodeKey) : "";
  const solutionMap = tryParseSolutionMap(decodedSolutionRaw);
  const partSolutionsByField = findPartSolutionsByField(q, decodeKey);

  const cqSolveMeta = q.meta?.ai_explanation?.cq_solve ?? null;
  const cqSolveByLetter: Record<string, string> = {};
  if (cqSolveMeta && typeof cqSolveMeta === "object") {
    for (const [k, v] of Object.entries(cqSolveMeta)) {
      if (typeof v === "string" && v.trim().length > 0) {
        const letter = k.toUpperCase();
        const cleaned = cleanHtml(v);
        if (cleaned) cqSolveByLetter[letter] = cleaned;
      }
    }
  }
  if (Object.keys(cqSolveByLetter).length === 0) {
    const rawExplanation = q.meta?.ai_explanation?.explanation;
    if (typeof rawExplanation === "string" && rawExplanation.trim().length > 0) {
      const split = splitCqExplanation(cleanHtml(rawExplanation));
      if (split) { for (const [k, v] of Object.entries(split)) { if (v.trim()) cqSolveByLetter[k] = v; } }
    }
  }

  const hasPartText = CQ_PART_LETTERS.some((l) => { const v = q[l]; return typeof v === "string" && v.length > 0; });
  const mapHasLetterKey = solutionMap !== null && Object.keys(solutionMap).some((k) => (CQ_PART_LETTERS as readonly string[]).includes(k.toUpperCase()));
  const hasFieldPartSolutions = Object.keys(partSolutionsByField).length > 0;
  const hasCqSolveMeta = Object.keys(cqSolveByLetter).length > 0;
  const hasMcqAnswer = typeof q.answer === "string" && /^[A-E]$/i.test(q.answer.trim());

  const populatedLetterFields = MCQ_OPTION_LETTERS.flatMap((l) => {
    const raw = q[l];
    if (typeof raw !== "string" || raw.length === 0) return [];
    const decoded = cleanHtml(dcode(raw, decodeKey));
    return decoded ? [decoded] : [];
  });
  const looksLikeMcqOptionShape = populatedLetterFields.length >= 2 && populatedLetterFields.every((text) => text.length <= 250 && !/\n/.test(text));
  const solutionMapHasCqParts = !hasMcqAnswer && solutionMap !== null && CQ_PART_LETTERS.some((l) => typeof solutionMap[l] === "string" && solutionMap[l].length > 20);

  const strongMcq = typeHint === "mcq" || (hasMcqAnswer && typeHint !== "cq") || (explicit === "mcq" && typeHint !== "cq") || (looksLikeMcqOptionShape && !solutionMapHasCqParts && explicit !== "cq" && typeHint !== "cq");
  const looksCq = !strongMcq && (explicit === "cq" || typeHint === "cq" || mapHasLetterKey || hasFieldPartSolutions || hasCqSolveMeta || hasPartText);

  const type: "mcq" | "cq" | "unknown" = looksCq ? "cq" : strongMcq ? "mcq" : (() => {
    const hasOption = MCQ_OPTION_LETTERS.some((l) => { const v = q[l]; return typeof v === "string" && v.length > 0; });
    return hasOption ? "mcq" : "unknown";
  })();

  const options: DecodedOption[] = [];
  const parts: DecodedPart[] = [];

  const resolveActualPartSolution = (letter: string): string | null => {
    if (partSolutionsByField[letter]) return partSolutionsByField[letter];
    if (solutionMap) {
      const candidate = solutionMap[letter] ?? solutionMap[letter.toLowerCase()] ?? solutionMap[CQ_PART_LABELS[letter] ?? ""] ?? null;
      if (typeof candidate === "string") return cleanHtml(candidate) || null;
    }
    return null;
  };

  if (type === "cq") {
    for (const letter of CQ_PART_LETTERS) {
      const raw = q[letter];
      const hasText = typeof raw === "string" && raw.length > 0;
      const actualSol = resolveActualPartSolution(letter);
      const aiSol = cqSolveByLetter[letter] ?? null;
      if (!hasText && !actualSol && !aiSol) continue;
      parts.push({ key: letter, label: CQ_PART_LABELS[letter] ?? letter, text: hasText ? cleanHtml(dcode(raw, decodeKey)) : "", solution: actualSol, aiSolution: aiSol });
    }
  } else {
    for (const letter of MCQ_OPTION_LETTERS) {
      const raw = q[letter];
      if (typeof raw !== "string" || raw.length === 0) continue;
      options.push({ letter, text: cleanHtml(dcode(raw, decodeKey)) });
    }
  }

  let residualSolution: string | null = null;
  if (decodedSolutionRaw) {
    if (type === "cq" && solutionMap) {
      residualSolution = null;
    } else {
      const cleaned = cleanHtml(decodedSolutionRaw);
      if (cleaned && /[\p{L}\p{N}]/u.test(cleaned)) residualSolution = cleaned;
    }
  }

  const consumedKeys = new Set<string>(["question", solutionFieldName, ...MCQ_OPTION_LETTERS, ...(type === "cq" ? CQ_PART_LETTERS : [])]);
  const extraFields: Record<string, string> = {};
  const debug: Record<string, string> = {};
  for (const [key, value] of Object.entries(q)) {
    if (typeof value !== "string" || value.length === 0) continue;
    const decoded = cleanHtml(dcode(value, decodeKey));
    if (decoded.length === 0 || !/[\p{L}\p{N}]/u.test(decoded)) continue;
    debug[key] = decoded;
    if (NOISE_FIELDS.has(key) || consumedKeys.has(key)) continue;
    extraFields[key] = decoded;
  }

  const questionDecoded = cleanHtml(dcode(q.question, decodeKey));
  const inlineImages = extractImageUrls(questionDecoded);
  const stemImages: string[] = [];
  const seenImages = new Set(inlineImages);
  const STEM_IMAGE_FIELDS = ["stem", "passage", "context", "intro", "image", "images", "image_url", "imageUrl", "img", "imgSrc", "img_src", "diagram", "figure", "media", "thumbnail", "cover"];
  for (const key of STEM_IMAGE_FIELDS) {
    const v = q[key];
    if (typeof v !== "string" || v.length === 0) continue;
    const decoded = cleanHtml(dcode(v, decodeKey));
    for (const url of extractImageUrls(decoded)) { if (!seenImages.has(url)) { seenImages.add(url); stemImages.push(url); } }
    const trimmed = decoded.trim();
    if (trimmed && /^(?:https?:|\/)/i.test(trimmed) && /\.(?:png|jpe?g|gif|webp|svg|bmp)(?:[?#]|$)/i.test(trimmed) && !seenImages.has(trimmed)) {
      const abs = absolutizeImageUrl(trimmed); seenImages.add(abs); stemImages.push(abs);
    }
  }

  return {
    id: q._id ?? String(index), index: index + 1, type, question: questionDecoded, stemImages, options, parts,
    answer: type === "mcq" && typeof q.answer === "string" && q.answer.trim().length > 0 ? q.answer.trim().toUpperCase() : null,
    solution: residualSolution,
    aiExplanation: buildMcqAiExplanation(type, q, cqSolveByLetter),
    extraFields, debug,
  };
}

interface ChorchaReadResponse {
  status?: string;
  data?: { questions?: RawQuestion[]; exam?: { name?: string; type?: string } };
}

async function fetchReadFromHost(host: string, id: string, token: string): Promise<{ json: ChorchaReadResponse; decodeKey: string }> {
  const res = await fetch(`https://${host}/read/${id}`, { headers: chorchaHeaders(token) });
  const body = await res.text();
  if (!res.ok) throw new Error(`Upstream ${host} returned ${res.status}: ${body.slice(0, 200)}`);
  const decodeKey = res.headers.get("x-chorcha-id") ?? "";
  if (!decodeKey) throw new Error(`Upstream ${host} did not return x-chorcha-id header`);
  let json: ChorchaReadResponse;
  try { json = JSON.parse(body); } catch { throw new Error(`Upstream ${host} returned non-JSON body`); }
  if (json.status && json.status !== "success") throw new Error(`Upstream ${host} returned status='${json.status}' (token may be invalid or expired)`);
  return { json, decodeKey };
}

function isStemOnly(q: DecodedQuestion): boolean {
  const textLeft = q.question.replace(/\[IMG:[^\]]+\]/g, "").trim();
  return !textLeft && !q.options.length && !q.parts.length && !q.answer && (q.stemImages.length > 0 || extractImageUrls(q.question).length > 0);
}

function decodeQuestions(json: ChorchaReadResponse, decodeKey: string, typeHint: "mcq" | "cq" | "sq" | null = null): DecodedQuestion[] {
  const rawQuestions = json.data?.questions ?? [];

  // Pre-expand: questions whose options live in meta.question[] instead of top-level A/B/C/D
  const expandedPairs: Array<{ q: RawQuestion; sub?: MetaSubQuestion }> = [];
  for (const q of rawQuestions) {
    const metaQs = q.meta?.question;
    if (Array.isArray(metaQs) && metaQs.length > 0) {
      const hasTopLevelOpts = MCQ_OPTION_LETTERS.some(l => typeof q[l] === "string" && (q[l] as string).length > 0);
      if (!hasTopLevelOpts) {
        for (const sub of metaQs) expandedPairs.push({ q, sub });
        continue;
      }
    }
    expandedPairs.push({ q });
  }

  const decoded = expandedPairs.map(({ q, sub }, i) =>
    sub ? decodeMetaSubQuestion(q, sub, i, decodeKey, typeHint) : decodeQuestion(q, i, decodeKey, typeHint)
  );

  const merged: DecodedQuestion[] = [];
  let pendingStemImages: string[] = [];
  for (const q of decoded) {
    if (isStemOnly(q)) {
      for (const url of q.stemImages) { if (!pendingStemImages.includes(url)) pendingStemImages.push(url); }
      continue;
    }
    if (pendingStemImages.length > 0) {
      const seen = new Set<string>([...extractImageUrls(q.question), ...q.stemImages]);
      q.stemImages = [...pendingStemImages.filter((u) => !seen.has(u)), ...q.stemImages];
      pendingStemImages = [];
    }
    merged.push(q);
  }

  for (const q of merged) {
    const inlineUrls = extractImageUrls(q.question);
    if (inlineUrls.length === 0) continue;
    const seen = new Set<string>(q.stemImages);
    const fresh: string[] = [];
    for (const u of inlineUrls) { if (!seen.has(u)) { seen.add(u); fresh.push(u); } }
    q.stemImages = [...q.stemImages, ...fresh];
    q.question = q.question.replace(/\[IMG:[^\]]+\]/g, "").replace(/\n{3,}/g, "\n\n").replace(/^[\s\n]+|[\s\n]+$/g, "");
  }

  // SQ typeHint: all questions already decoded as "sq", no hiding needed
  const allHidden = typeHint !== "sq" && merged.length > 0 && merged.every((q) => {
    const wrongType = (typeHint === "mcq" && q.type === "cq") || (typeHint === "cq" && q.type === "mcq");
    return wrongType;
  });
  const annotated = merged.map((q) => {
    const wrongType = typeHint !== "sq" && ((typeHint === "mcq" && q.type === "cq") || (typeHint === "cq" && q.type === "mcq"));
    return { ...q, hidden: allHidden ? false : wrongType };
  });

  let visibleCounter = 0;
  return annotated.map((q) => {
    if (q.hidden) return { ...q, index: -1 };
    visibleCounter++;
    return { ...q, index: visibleCounter };
  });
}

function summarizeExamType(questions: DecodedQuestion[]): "mcq" | "cq" | "sq" | "mixed" | "unknown" {
  if (questions.length === 0) return "unknown";
  const types = new Set(questions.map((q) => q.type));
  if (types.size === 1) {
    const only = Array.from(types)[0];
    if (only === "mcq" || only === "cq" || only === "sq") return only;
    return "unknown";
  }
  if (types.has("mcq") && types.has("cq")) return "mixed";
  return "unknown";
}

const ALLOWED_IMAGE_HOSTS = ["chorcha.net", "testmozusercontent.com"];
function isAllowedImageHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWED_IMAGE_HOSTS.some((s) => h === s || h.endsWith(`.${s}`));
}

interface BankExam {
  _id: string;
  name: string;
  short_name?: string;
  qCount?: number;
}

interface BankResponse {
  status?: string;
  data?: {
    page?: number;
    exams?: BankExam[];
    totalPages?: number;
    meta_name?: string;
    series?: { name?: string; meta_name?: string; [key: string]: unknown };
  };
}

function extractBankSlug(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/question-bank\/([A-Za-z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  // bare slug: all lowercase with hyphens, looks like a URL slug
  if (/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(trimmed) && trimmed.includes("-")) return trimmed;
  return null;
}

async function fetchBankPage(host: string, slug: string, page = 1): Promise<BankResponse> {
  const url = `https://${host}/question-bank/${slug}${page > 1 ? `?page=${page}` : ""}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "application/json",
      Origin: "https://chorcha.net",
      Referer: "https://chorcha.net/",
      "x-chorcha-mode": "api",
    },
  });
  if (!res.ok) throw new Error(`Bank ${host} returned ${res.status}`);
  const json = await res.json() as BankResponse;
  if (json.status && json.status !== "success") throw new Error(`Bank ${host} status='${json.status}'`);
  return json;
}

async function fetchAllBankExams(host: string, slug: string): Promise<{ exams: BankExam[]; bankName: string }> {
  const first = await fetchBankPage(host, slug, 1);
  const totalPages = first.data?.totalPages ?? 1;
  // series.name has the real display name (e.g. "পদার্থবিজ্ঞান ১ম (MCQ)"); fall back to meta_name then slug
  const bankName = first.data?.series?.name ?? first.data?.series?.meta_name ?? first.data?.meta_name ?? slug;
  const exams: BankExam[] = [...(first.data?.exams ?? [])];
  for (let p = 2; p <= Math.min(totalPages, 20); p++) {
    try {
      const page = await fetchBankPage(host, slug, p);
      exams.push(...(page.data?.exams ?? []));
    } catch { break; }
  }
  return { exams, bankName };
}

async function decodeAndSaveExam(exam: BankExam, folderId: number, token: string, globalTypeHint: "mcq" | "cq" | "sq" | null, bankTypeHint: "mcq" | "cq" | "sq" | null = null, sortOrder = 0): Promise<typeof questionSetsTable.$inferSelect | null> {
  const readId = exam._id || exam.short_name;
  if (!readId) return null;
  // Priority: user-forced > per-exam name detection > bank-level detection
  const typeHint = globalTypeHint ?? autoDetectTypeFromName(exam.name ?? "") ?? bankTypeHint;
  let questions: DecodedQuestion[] = [];
  let hostUsed: string | null = null;
  for (const h of API_HOSTS) {
    try {
      const { json, decodeKey } = await fetchReadFromHost(h, readId, token);
      questions = decodeQuestions(json, decodeKey, typeHint);
      hostUsed = h;
      break;
    } catch { /* try next */ }
  }
  if (!hostUsed) return null;
  const visible = questions.filter((q) => !q.hidden);
  const examType = globalTypeHint ?? summarizeExamType(visible);
  const [questionSet] = await db.insert(questionSetsTable).values({
    folderId,
    name: exam.name || `Set ${readId}`,
    examType,
    totalQuestions: visible.length,
    sourceUrl: `https://chorcha.net/read/${readId}`,
    sortOrder,
  }).returning();
  if (!questionSet) return null;
  const rows = questions.map((q) => ({
    setId: questionSet.id,
    chorchaId: q.id,
    questionIndex: q.index,
    type: q.type,
    questionText: q.question,
    options: q.options,
    parts: q.parts,
    answer: q.answer,
    solution: q.solution,
    stemImages: q.stemImages,
    aiExplanation: q.aiExplanation,
    hidden: q.hidden ?? false,
  }));
  if (rows.length > 0) {
    try {
      await db.insert(questionsTable).values(rows);
    } catch {
      for (const row of rows) {
        try { await db.insert(questionsTable).values(row); } catch { /* skip individual */ }
      }
    }
  }
  return questionSet;
}

router.post("/decode-bank-to-folder", async (req, res) => {
  const folderId = typeof req.body?.folderId === "number" ? req.body.folderId : parseInt(req.body?.folderId, 10);
  const rawInput = typeof req.body?.input === "string" ? req.body.input : "";
  const rawToken = typeof req.body?.token === "string" ? req.body.token : "";
  const rawTypeHint = typeof req.body?.typeHint === "string" ? req.body.typeHint : null;
  const replaceExisting = req.body?.replace === true;
  const typeHint: "mcq" | "cq" | "sq" | null = rawTypeHint === "mcq" || rawTypeHint === "cq" || rawTypeHint === "sq" ? rawTypeHint : null;

  if (!Number.isFinite(folderId)) return res.status(400).json({ error: "Invalid folderId." });
  if (!rawInput.trim()) return res.status(400).json({ error: "input is required." });

  const token = extractToken(rawToken) ?? "";
  if (!token) return res.status(400).json({ error: "Missing token. Paste your Chorcha session token." });

  const bankSlug = extractBankSlug(rawInput);
  if (!bankSlug) return res.status(400).json({ error: "Provide a question-bank URL (chorcha.net/question-bank/<slug>) or bare slug." });

  const [folder] = await db.select({ id: foldersTable.id }).from(foldersTable).where(eq(foldersTable.id, folderId)).limit(1);
  if (!folder) return res.status(400).json({ error: "Folder not found." });

  // Fetch bank listing from first available host
  let exams: BankExam[] = [];
  let bankName = bankSlug;
  let bankHost: string | null = null;
  for (const h of API_HOSTS) {
    try {
      const result = await fetchAllBankExams(h, bankSlug);
      exams = result.exams;
      bankName = result.bankName;
      bankHost = h;
      break;
    } catch (err) {
      req.log.warn({ err, host: h }, "Bank listing fetch failed, trying next host");
    }
  }

  if (!bankHost || exams.length === 0) {
    return res.status(502).json({ error: "Could not fetch bank listing or bank is empty. Check the URL." });
  }

  // Auto-detect type from bank slug/name as fallback for per-exam detection
  const bankTypeHint: "mcq" | "cq" | "sq" | null = autoDetectTypeFromName(bankSlug) ?? autoDetectTypeFromName(bankName) ?? null;

  // Delete existing sets if replace mode is requested
  if (replaceExisting) {
    const existingSets = await db.select({ id: questionSetsTable.id }).from(questionSetsTable).where(eq(questionSetsTable.folderId, folderId));
    for (const s of existingSets) {
      await db.delete(questionsTable).where(eq(questionsTable.setId, s.id));
    }
    if (existingSets.length > 0) {
      await db.delete(questionSetsTable).where(eq(questionSetsTable.folderId, folderId));
    }
  }

  // Decode each exam in batches of 4
  const created: (typeof questionSetsTable.$inferSelect)[] = [];
  let failed = 0;
  const BATCH = 4;
  for (let i = 0; i < exams.length; i += BATCH) {
    const batch = exams.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((exam, bIdx) => decodeAndSaveExam(exam, folderId, token, typeHint, bankTypeHint, i + bIdx + 1)));
    for (const r of results) {
      if (r) created.push(r); else failed++;
    }
  }

  return res.status(201).json({ bankName, sets: created, total: exams.length, created: created.length, failed });
});

router.get("/image", async (req, res) => {
  const url = typeof req.query.url === "string" ? req.query.url : "";
  const rawToken = typeof req.query.token === "string" ? req.query.token : "";
  const token = extractToken(rawToken) ?? "";
  if (!url) return res.status(400).json({ error: "Missing url query parameter." });

  let parsed: URL;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: "url is not a valid URL." }); }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return res.status(400).json({ error: "url must be http or https." });
  if (!isAllowedImageHost(parsed.hostname)) return res.status(403).json({ error: `Host '${parsed.hostname}' not allowed.` });

  const fallbackHosts = [parsed.hostname, "assets.chorcha.net", "chorcha.net", "cdn.chorcha.net", "media.chorcha.net"];
  const tried = new Set<string>();
  let lastErr: unknown = null;
  for (const host of fallbackHosts) {
    if (tried.has(host)) continue;
    tried.add(host);
    const target = `${parsed.protocol}//${host}${parsed.pathname}${parsed.search}`;
    try {
      const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0", Accept: "image/*,*/*;q=0.8", Referer: "https://chorcha.net/" };
      if (token) { headers["Cookie"] = `token=${token}`; headers["Authorization"] = `Bearer ${token}`; }
      const upstream = await fetch(target, { headers });
      if (!upstream.ok || !upstream.body) { lastErr = new Error(`${host} returned ${upstream.status}`); continue; }
      const ct = upstream.headers.get("content-type") ?? "";
      if (!ct.startsWith("image/") && ct !== "application/octet-stream") { lastErr = new Error(`non-image content-type '${ct}'`); continue; }
      res.setHeader("Content-Type", ct);
      const cl = upstream.headers.get("content-length");
      if (cl) res.setHeader("Content-Length", cl);
      res.setHeader("Cache-Control", "public, max-age=86400, immutable");
      return res.status(200).send(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) { lastErr = err; }
  }
  const message = lastErr instanceof Error ? lastErr.message : "Image fetch failed";
  req.log.warn({ url, message }, "image proxy failed");
  return res.status(502).json({ error: message });
});

router.post("/decode-to-folder", async (req, res) => {
  const folderId = typeof req.body?.folderId === "number" ? req.body.folderId : parseInt(req.body?.folderId, 10);
  const rawInput = typeof req.body?.input === "string" ? req.body.input : "";
  const rawToken = typeof req.body?.token === "string" ? req.body.token : "";
  const nameOverride = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const rawTypeHint = typeof req.body?.typeHint === "string" ? req.body.typeHint : null;
  const typeHint: "mcq" | "cq" | "sq" | null = rawTypeHint === "mcq" || rawTypeHint === "cq" || rawTypeHint === "sq" ? rawTypeHint : null;

  if (!Number.isFinite(folderId)) return res.status(400).json({ error: "Invalid folderId." });
  if (!rawInput.trim()) return res.status(400).json({ error: "input is required." });

  const token = extractToken(rawToken) ?? "";
  if (!token) return res.status(400).json({ error: "Missing token. Paste your Chorcha session token." });

  const id = extractReadId(rawInput);
  if (!id) return res.status(400).json({ error: "Provide a Chorcha read URL (chorcha.net/read/<id>) or just the read ID." });

  const [folder] = await db.select({ id: foldersTable.id, name: foldersTable.name }).from(foldersTable).where(eq(foldersTable.id, folderId)).limit(1);
  if (!folder) return res.status(400).json({ error: "Folder not found." });

  let host: string | null = null;
  let questions: DecodedQuestion[] = [];

  let lastErr: unknown = null;
  for (const h of API_HOSTS) {
    try {
      const { json, decodeKey } = await fetchReadFromHost(h, id, token);
      questions = decodeQuestions(json, decodeKey, typeHint);
      host = h;
      break;
    } catch (err) {
      lastErr = err;
      req.log.warn({ err, host: h }, "Chorcha host failed, trying next");
    }
  }

  if (!host) {
    const message = lastErr instanceof Error ? lastErr.message : "All upstream hosts failed";
    return res.status(502).json({ error: message });
  }

  const visible = questions.filter((q) => !q.hidden);
  const examType = typeHint ?? summarizeExamType(visible);
  const setName = nameOverride || `Set ${id}`;

  const [questionSet] = await db.insert(questionSetsTable).values({
    folderId,
    name: setName,
    examType,
    totalQuestions: visible.length,
    sourceUrl: `https://chorcha.net/read/${id}`,
  }).returning();

  if (!questionSet) return res.status(500).json({ error: "Failed to create question set." });

  if (questions.length > 0) {
    const rows = questions.map((q) => ({
      setId: questionSet.id,
      chorchaId: q.id,
      questionIndex: q.index,
      type: q.type,
      questionText: q.question,
      options: q.options,
      parts: q.parts,
      answer: q.answer,
      solution: q.solution,
      stemImages: q.stemImages,
      aiExplanation: q.aiExplanation,
      hidden: q.hidden ?? false,
    }));
    try {
      await db.insert(questionsTable).values(rows);
    } catch {
      for (const row of rows) {
        try { await db.insert(questionsTable).values(row); } catch { /* skip individual */ }
      }
    }
  }

  return res.status(201).json(questionSet);
});

// ─── Mock Exam: generate random questions from selected sets ──────────────────
router.post("/mock-exam/generate", async (req, res) => {
  const rawSetIds = req.body?.setIds;
  const count = typeof req.body?.count === "number" ? Math.max(1, Math.min(200, req.body.count)) : 25;
  const shuffle = req.body?.shuffle !== false;
  const types: string[] = Array.isArray(req.body?.types) ? req.body.types : [];

  if (!Array.isArray(rawSetIds) || rawSetIds.length === 0) {
    return res.status(400).json({ error: "setIds is required and must be a non-empty array." });
  }
  const setIds: number[] = (rawSetIds as unknown[]).map((id) => parseInt(String(id), 10)).filter((id) => Number.isFinite(id) && id > 0);
  if (setIds.length === 0) return res.status(400).json({ error: "No valid set IDs provided." });

  const allQuestions = await db.select().from(questionsTable).where(
    and(
      inArray(questionsTable.setId, setIds),
      eq(questionsTable.hidden, false),
      types.length > 0 ? inArray(questionsTable.type, types) : undefined,
    )
  );

  if (allQuestions.length === 0) {
    return res.status(200).json({ questions: [], total: 0, fromSets: setIds.length });
  }

  const pool = [...allQuestions];
  if (shuffle) {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
  }
  const selected = pool.slice(0, count);

  return res.json({ questions: selected, total: allQuestions.length, fromSets: setIds.length });
});

export default router;
