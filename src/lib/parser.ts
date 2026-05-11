import mammoth from "mammoth";

export interface QuestionOption {
  letter: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
  /**
   * "mcq" (default) = multiple-choice; pick a letter.
   * "fill" = fill-in-the-blank; type the answer into a text box.
   */
  type?: "mcq" | "fill";
  /** For fill-in questions: the expected answer, as it appears in the source. */
  answer?: string;
  explanation?: string;
}

/**
 * Normalize a fill-in answer for case-insensitive / whitespace-insensitive
 * comparison. Folds Unicode ligatures (ﬁ→fi, ﬂ→fl, etc.) and collapses
 * spaces.
 */
export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d`]/g, "")
    .replace(/[.,;:!?()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns true if the user's typed answer matches the expected one. */
export function fillInIsCorrect(user: string, expected: string): boolean {
  if (!user || !expected) return false;
  return normalizeAnswer(user) === normalizeAnswer(expected);
}

export interface ParseResult {
  questions: Question[];
  warnings: string[];
}

const QUESTION_PREFIX_RE =
  /^(?:c[âa]u|question|q|bài|b[àa]i)\s*\d+\s*[.:)-]?/i;
const NUMBERED_QUESTION_RE = /^(\d{1,3})\s*[.):-]\s+/;
const ANSWER_PREFIX_RE = /^([A-Ha-h])\s*[.):-]\s*/;

interface RawLine {
  text: string;
  boldRatio: number;
}

/**
 * Convert a DOCX File/Blob to an array of "lines" (one per paragraph) that
 * also carry a boldRatio: the fraction of the line's characters that were
 * bold/highlighted. Bold/highlighted answers are taken to be the correct one.
 */
export async function docxToLines(file: File | Blob): Promise<RawLine[]> {
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "u => u",
        "highlight => mark",
        "comment-reference => ''",
      ],
    }
  );
  return htmlToLines(html);
}

/**
 * Convert arbitrary HTML (e.g. pasted from a Studocu page) into RawLines.
 * Each block-level element becomes a single line, with its boldRatio measured
 * by walking the text nodes.
 */
export function htmlToLines(html: string): RawLine[] {
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Strip elements that never contain useful content.
  for (const sel of ["script", "style", "noscript", "iframe", "header", "footer", "nav", "aside", "form", "button"]) {
    for (const el of Array.from(doc.body.querySelectorAll(sel))) {
      el.remove();
    }
  }

  // If there are no semantic block elements at all (e.g. a plain text dump
  // wrapped in a single <pre>), fall back to splitting on newlines.
  const blocks = Array.from(
    doc.body.querySelectorAll(
      "p, li, h1, h2, h3, h4, h5, h6, tr, div, blockquote"
    )
  ).filter((el) => {
    // Only keep "leaf" blocks (no block descendants), to avoid double-counting.
    return !el.querySelector(
      "p, li, h1, h2, h3, h4, h5, h6, tr, blockquote"
    ) && (el.textContent?.trim().length ?? 0) > 0;
  });

  const lines: RawLine[] = [];
  if (blocks.length === 0) {
    // Fallback: walk the body once, then split by newlines.
    const { text, boldChars } = collectText(doc.body);
    const totalLen = text.replace(/\s/g, "").length || 1;
    const ratio = boldChars / totalLen;
    for (const raw of text.split(/\r?\n+/)) {
      const trimmed = raw.replace(/\s+/g, " ").trim();
      if (!trimmed) continue;
      lines.push({ text: trimmed, boldRatio: ratio });
    }
    return lines;
  }

  for (const block of blocks) {
    const { text, boldChars } = collectText(block);
    const trimmed = text.replace(/\s+/g, " ").trim();
    if (!trimmed) continue;
    const totalLen = trimmed.replace(/\s/g, "").length || 1;
    lines.push({ text: trimmed, boldRatio: boldChars / totalLen });
  }
  return lines;
}

/**
 * Walk a node and collect plain text plus how many of those (non-whitespace)
 * characters are inside a bold-ish element.
 */
function collectText(node: Node): { text: string; boldChars: number } {
  let text = "";
  let boldChars = 0;
  walk(node, false);
  return { text, boldChars };

  function walk(n: Node, inBold: boolean) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n.textContent ?? "";
      text += t;
      if (inBold) {
        boldChars += t.replace(/\s/g, "").length;
      }
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as HTMLElement;
    const tag = el.tagName.toLowerCase();
    let nowBold = inBold;
    if (tag === "strong" || tag === "b" || tag === "mark" || tag === "u") {
      nowBold = true;
    }
    const style = el.getAttribute("style") || "";
    if (
      /font-weight\s*:\s*(bold|[6-9]\d{2})/i.test(style) ||
      /background(-color)?\s*:\s*(?!transparent|inherit|initial|unset|none|#?fff|white|rgb\(255,\s*255,\s*255\))/i.test(
        style
      ) ||
      /text-decoration[^;]*underline/i.test(style)
    ) {
      nowBold = true;
    }
    for (const child of Array.from(el.childNodes)) {
      walk(child, nowBold);
    }
  }
}

/**
 * Convert plain text (no formatting) into RawLines. Users can mark the correct
 * answer with **bold** markdown, surrounding [[text]], or by appending "(*)".
 */
export function plainTextToLines(input: string): RawLine[] {
  const lines: RawLine[] = [];
  for (const raw of input.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    let isCorrect = false;

    if (/\(\*\)\s*$/.test(line)) {
      isCorrect = true;
      line = line.replace(/\(\*\)\s*$/, "").trim();
    }
    if (/^\*\*.+\*\*$/.test(line)) {
      isCorrect = true;
      line = line.replace(/^\*\*|\*\*$/g, "").trim();
    } else if (/\*\*[^*]+\*\*/.test(line)) {
      const stripped = line.replace(/\*\*([^*]+)\*\*/g, "$1");
      const inner = (line.match(/\*\*([^*]+)\*\*/g) || [])
        .map((m) => m.replace(/\*\*/g, ""))
        .join(" ");
      const innerLen = inner.replace(/\s/g, "").length;
      const totalLen = stripped.replace(/\s/g, "").length || 1;
      if (innerLen / totalLen > 0.5) isCorrect = true;
      line = stripped.trim();
    }
    if (/^\[\[.+\]\]$/.test(line)) {
      isCorrect = true;
      line = line.replace(/^\[\[|\]\]$/g, "").trim();
    }

    lines.push({ text: line, boldRatio: isCorrect ? 1 : 0 });
  }
  return lines;
}

/**
 * Group lines into questions. A question starts with one of:
 *  - "Câu X", "Question X", "Q X"
 *  - "1.", "1)", "1-"
 * Answer choices start with "A." / "A)" / "a)" through D-H.
 * Anything else is treated as continuation of the most recent question or answer.
 */
export function groupLinesIntoQuestions(lines: RawLine[]): ParseResult {
  const questions: Question[] = [];
  const warnings: string[] = [];

  let current: {
    text: string;
    options: { letter: string; text: string; boldChars: number; totalChars: number }[];
  } | null = null;
  let lastTarget: "question" | "option" | null = null;

  const flush = () => {
    if (!current) return;
    const text = current.text.trim();
    if (!text || current.options.length === 0) {
      current = null;
      lastTarget = null;
      return;
    }
    const options: QuestionOption[] = current.options.map((o) => ({
      letter: o.letter,
      text: o.text.trim(),
      isCorrect: o.totalChars > 0 && o.boldChars / o.totalChars > 0.5,
    }));
    if (!options.some((o) => o.isCorrect)) {
      warnings.push(
        `Câu "${truncate(text, 60)}" không phát hiện đáp án nào được bôi đậm.`
      );
    }
    questions.push({
      id: `q-${questions.length + 1}`,
      text,
      options,
    });
    current = null;
    lastTarget = null;
  };

  for (const { text, boldRatio } of lines) {
    const qPrefix = QUESTION_PREFIX_RE.exec(text);
    const numberedMatch = NUMBERED_QUESTION_RE.exec(text);
    const answerMatch = ANSWER_PREFIX_RE.exec(text);

    if (
      qPrefix &&
      // Heuristic: numeric line that's also short and doesn't have an answer
      // letter at start is a question header.
      !answerMatch
    ) {
      flush();
      current = {
        text: text.slice(qPrefix[0].length).trim().replace(/^[:.\-)]\s*/, ""),
        options: [],
      };
      lastTarget = "question";
      continue;
    }

    if (
      numberedMatch &&
      !answerMatch &&
      // Avoid mistaking enumerated answers like "1) wrong" inside an existing
      // question for a new question. Treat short numeric lines as questions
      // only when there's no current question OR the current one already has
      // 2+ options.
      (!current || current.options.length >= 2)
    ) {
      flush();
      current = {
        text: text.slice(numberedMatch[0].length).trim(),
        options: [],
      };
      lastTarget = "question";
      continue;
    }

    if (answerMatch && current) {
      const letter = answerMatch[1].toUpperCase();
      const optText = text.slice(answerMatch[0].length).trim();
      const charLen = optText.replace(/\s/g, "").length;
      // Approximation: the prefix "A." is ~1-2 chars of the original line, so
      // we can use the line-level bold ratio for the option directly.
      current.options.push({
        letter,
        text: optText,
        boldChars: Math.round(charLen * boldRatio),
        totalChars: charLen,
      });
      lastTarget = "option";
      continue;
    }

    if (current) {
      if (lastTarget === "option" && current.options.length > 0) {
        const last = current.options[current.options.length - 1];
        const charLen = text.replace(/\s/g, "").length;
        last.text = (last.text + " " + text).trim();
        last.totalChars += charLen;
        last.boldChars += Math.round(charLen * boldRatio);
      } else {
        current.text = (current.text + " " + text).trim();
      }
    }
  }

  flush();

  return { questions, warnings };
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

export async function parseDocx(file: File): Promise<ParseResult> {
  const lines = await docxToLines(file);
  return groupLinesIntoQuestions(lines);
}

export function parsePlainText(text: string): ParseResult {
  const lines = plainTextToLines(text);
  return groupLinesIntoQuestions(lines);
}

export function parseHtml(html: string): ParseResult {
  const lines = htmlToLines(html);
  return groupLinesIntoQuestions(lines);
}

/**
 * Best-effort fetch of a Studocu (or other) URL through a public CORS proxy.
 * Many Studocu pages are paywalled / require login, so this often fails.
 * The error is propagated so the UI can prompt the user to fall back to
 * "paste from web" mode.
 */
export async function parseUrl(url: string): Promise<ParseResult> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("URL phải bắt đầu bằng http:// hoặc https://");
  }
  const proxies = [
    (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  ];
  let lastErr: unknown = null;
  for (const make of proxies) {
    try {
      const res = await fetch(make(url), { redirect: "follow" });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      const result = parseHtml(html);
      if (result.questions.length > 0) return result;
      lastErr = new Error("Không tìm thấy câu hỏi nào trong trang.");
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Không fetch được URL (CORS hoặc paywall).");
}

export const SAMPLE_TEXT = `Câu 1: Thủ đô của Việt Nam là gì?
A. TP. Hồ Chí Minh
B. Đà Nẵng
**C. Hà Nội**
D. Hải Phòng

Câu 2: 2 + 2 bằng bao nhiêu?
A. 3
**B. 4**
C. 5
D. 6

Câu 3: Ngôn ngữ lập trình nào được tạo bởi Brendan Eich vào năm 1995?
A. Python
B. Java
**C. JavaScript**
D. Ruby
`;
