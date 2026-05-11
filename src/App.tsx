import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Play,
  RefreshCw,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Shuffle,
  Eye,
  EyeOff,
  AlertTriangle,
  Sparkles,
  ClipboardPaste,
  Link2,
  Pencil,
  Save,
} from "lucide-react";
import {
  parseDocx,
  parsePlainText,
  parseHtml,
  parseUrl,
  fillInIsCorrect,
  SAMPLE_TEXT,
  type Question,
  type ParseResult,
} from "@/lib/parser";
import { SUBJECTS, type Subject } from "@/data/subjects";
import "./App.css";

type Screen = "input" | "quiz" | "result";
type InputTab = "file" | "text" | "web" | "url";

function App() {
  const [screen, setScreen] = useState<Screen>("input");
  const [tab, setTab] = useState<InputTab>("web");
  const [pastedText, setPastedText] = useState("");
  const [pastedHtml, setPastedHtml] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealMode, setRevealMode] = useState<"after-submit" | "instant">(
    "after-submit"
  );
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [optionOrders, setOptionOrders] = useState<Record<string, number[]>>({});
  // Map of questionId -> Set of option letters that the user has marked as
  // "actually correct". When the set is non-empty for a question, we override
  // the parser-detected correctness with the user's choice(s).
  const [correctOverrides, setCorrectOverrides] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    if (questions.length === 0) return;
    const orders: Record<string, number[]> = {};
    for (const q of questions) {
      // Fill-in questions have no options; skip shuffling.
      if (q.type === "fill") {
        orders[q.id] = [];
        continue;
      }
      const idxs = q.options.map((_, i) => i);
      if (shuffleOptions) shuffleArray(idxs);
      orders[q.id] = idxs;
    }
    setOptionOrders(orders);
  }, [questions, shuffleOptions]);

  // Apply user-supplied correct-answer overrides on top of the parser output.
  const resolvedQuestions = useMemo<Question[]>(() => {
    return questions.map((q) => {
      const override = correctOverrides[q.id];
      if (!override || override.length === 0) return q;
      return {
        ...q,
        options: q.options.map((o) => ({
          ...o,
          isCorrect: override.includes(o.letter),
        })),
      };
    });
  }, [questions, correctOverrides]);

  function resetQuiz() {
    setAnswers({});
    setSubmitted({});
    setCurrentIdx(0);
  }

  function startQuizFromResult(result: ParseResult) {
    if (result.questions.length === 0) {
      setParseError(
        "Không tìm thấy câu hỏi nào. Đảm bảo file/text có format kiểu \"Câu 1: ... A. ... B. ... C. ... D. ...\" và đáp án đúng được in đậm."
      );
      return;
    }
    setQuestions(result.questions);
    setWarnings(result.warnings);
    setParseError(null);
    resetQuiz();
    setScreen("quiz");
  }

  async function handleFile(file: File) {
    setParsing(true);
    setParseError(null);
    setFileName(file.name);
    try {
      const result = await parseDocx(file);
      startQuizFromResult(result);
    } catch (e) {
      console.error(e);
      setParseError(
        "Không đọc được file. Hiện tại app chỉ hỗ trợ .docx. File .doc cũ hoặc PDF chưa được hỗ trợ."
      );
    } finally {
      setParsing(false);
    }
  }

  function handleParseText() {
    setParsing(true);
    setParseError(null);
    try {
      const result = parsePlainText(pastedText);
      startQuizFromResult(result);
    } catch (e) {
      console.error(e);
      setParseError("Không parse được text. Kiểm tra lại format.");
    } finally {
      setParsing(false);
    }
  }

  function handleParseHtml() {
    setParsing(true);
    setParseError(null);
    try {
      if (!pastedHtml.trim()) {
        setParseError(
          "Chưa có nội dung. Mở trang Studocu, Ctrl+A → Ctrl+C rồi paste vào ô."
        );
        return;
      }
      const result = parseHtml(pastedHtml);
      startQuizFromResult(result);
    } catch (e) {
      console.error(e);
      setParseError("Không parse được nội dung dán. Thử lại hoặc dùng tab khác.");
    } finally {
      setParsing(false);
    }
  }

  async function handleParseUrl() {
    setParsing(true);
    setParseError(null);
    try {
      const result = await parseUrl(urlValue.trim());
      startQuizFromResult(result);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Không fetch được URL.";
      setParseError(
        `${msg} Studocu thường chặn cross-origin — anh thử tab "Dán từ web" thay thế (mở Studocu, Ctrl+A → Ctrl+C → paste).`
      );
    } finally {
      setParsing(false);
    }
  }

  function loadSample() {
    setTab("text");
    setPastedText(SAMPLE_TEXT);
  }

  function loadSubject(subject: Subject) {
    if (!subject.questions || subject.questions.length === 0) {
      setParseError(
        `Đề "${subject.title}" chưa có nội dung. Anh paste nội dung từ Studocu vào tab "Dán từ web" rồi bấm "Bắt đầu làm".`
      );
      return;
    }
    setFileName(subject.title);
    setQuestions(subject.questions);
    setWarnings([]);
    setParseError(null);
    resetQuiz();
    setScreen("quiz");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <header className="bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Quiz Học Bài</h1>
              <p className="text-xs text-slate-500">
                Upload file đề có đáp án in đậm → ôn thi nhanh
              </p>
            </div>
          </div>
          {screen !== "input" && (
            <button
              className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-slate-100"
              onClick={() => {
                setScreen("input");
                resetQuiz();
              }}
            >
              <RefreshCw size={14} /> Đề mới
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {screen === "input" && (
          <InputView
            tab={tab}
            setTab={setTab}
            pastedText={pastedText}
            setPastedText={setPastedText}
            pastedHtml={pastedHtml}
            setPastedHtml={setPastedHtml}
            urlValue={urlValue}
            setUrlValue={setUrlValue}
            onFile={handleFile}
            onParseText={handleParseText}
            onParseHtml={handleParseHtml}
            onParseUrl={handleParseUrl}
            parsing={parsing}
            error={parseError}
            fileName={fileName}
            loadSample={loadSample}
            subjects={SUBJECTS}
            onLoadSubject={loadSubject}
          />
        )}

        {screen === "quiz" && resolvedQuestions.length > 0 && (
          <QuizView
            questions={resolvedQuestions}
            rawQuestions={questions}
            currentIdx={currentIdx}
            setCurrentIdx={setCurrentIdx}
            answers={answers}
            setAnswers={setAnswers}
            submitted={submitted}
            setSubmitted={setSubmitted}
            revealMode={revealMode}
            setRevealMode={setRevealMode}
            shuffleOptions={shuffleOptions}
            setShuffleOptions={setShuffleOptions}
            optionOrders={optionOrders}
            warnings={warnings}
            correctOverrides={correctOverrides}
            setCorrectOverrides={setCorrectOverrides}
            onFinish={() => setScreen("result")}
          />
        )}

        {screen === "result" && (
          <ResultView
            questions={resolvedQuestions}
            answers={answers}
            onRestart={() => {
              resetQuiz();
              setScreen("quiz");
            }}
            onNew={() => {
              resetQuiz();
              setScreen("input");
            }}
          />
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-6 text-xs text-slate-400 text-center">
        Tip: trong file .docx, đáp án đúng phải được{" "}
        <strong>in đậm</strong> hoặc bôi highlight. Trong text, dùng{" "}
        <code>**đáp án đúng**</code>.
      </footer>
    </div>
  );
}

function InputView(props: {
  tab: InputTab;
  setTab: (t: InputTab) => void;
  pastedText: string;
  setPastedText: (s: string) => void;
  pastedHtml: string;
  setPastedHtml: (s: string) => void;
  urlValue: string;
  setUrlValue: (s: string) => void;
  onFile: (file: File) => void;
  onParseText: () => void;
  onParseHtml: () => void;
  onParseUrl: () => void;
  parsing: boolean;
  error: string | null;
  fileName: string | null;
  loadSample: () => void;
  subjects: Subject[];
  onLoadSubject: (s: Subject) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const pasteRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-6">
      {props.subjects.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Đề có sẵn
            </h2>
            <span className="text-xs text-slate-400">
              Click để vào làm bài ngay
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {props.subjects.map((s) => {
              const ready = s.questions.length > 0;
              return (
                <button
                  key={s.id}
                  onClick={() => props.onLoadSubject(s)}
                  className={`text-left border rounded-lg p-4 transition-colors ${
                    ready
                      ? "border-indigo-200 bg-indigo-50/40 hover:border-indigo-400 hover:bg-indigo-50"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold ${
                        ready
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-300 text-white"
                      }`}
                    >
                      {s.title.slice(0, 3)}
                    </span>
                    <p className="font-semibold text-slate-900">
                      {s.longName || s.title}
                    </p>
                  </div>
                  {s.description && (
                    <p className="text-xs text-slate-600 mb-2">{s.description}</p>
                  )}
                  <p
                    className={`text-xs font-medium ${
                      ready ? "text-indigo-700" : "text-amber-700"
                    }`}
                  >
                    {ready
                      ? `${s.questions.length} câu hỏi`
                      : "Chưa có nội dung — paste từ Studocu vào tab dưới"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap border-b border-slate-200">
          <TabButton
            active={props.tab === "web"}
            onClick={() => props.setTab("web")}
            icon={<ClipboardPaste size={16} />}
            label="Dán từ web / Studocu"
          />
          <TabButton
            active={props.tab === "url"}
            onClick={() => props.setTab("url")}
            icon={<Link2 size={16} />}
            label="Link URL"
          />
          <TabButton
            active={props.tab === "file"}
            onClick={() => props.setTab("file")}
            icon={<FileText size={16} />}
            label="File .docx"
          />
          <TabButton
            active={props.tab === "text"}
            onClick={() => props.setTab("text")}
            icon={<FileText size={16} />}
            label="Dán text"
          />
        </div>

        <div className="p-6">
          {props.tab === "file" && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) props.onFile(f);
              }}
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
                dragOver
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-slate-300 bg-slate-50"
              }`}
            >
              <Upload className="mx-auto text-slate-400 mb-3" size={36} />
              <p className="text-slate-700 font-medium mb-1">
                Kéo thả file <code>.docx</code> vào đây
              </p>
              <p className="text-sm text-slate-500 mb-4">
                Đáp án đúng phải được <strong>in đậm</strong> (bold) hoặc
                highlight trong file.
              </p>
              <button
                onClick={() => fileInput.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium"
              >
                <Upload size={16} /> Chọn file
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) props.onFile(f);
                }}
              />
              {props.fileName && (
                <p className="mt-3 text-xs text-slate-500">
                  Đã chọn: <strong>{props.fileName}</strong>
                </p>
              )}
            </div>
          )}

          {props.tab === "text" && (
            <div>
              <p className="text-sm text-slate-600 mb-2">
                Dán đề thi vào đây. Bọc đáp án đúng bằng dấu{" "}
                <code className="bg-slate-100 px-1 rounded">**...**</code> (kiểu
                markdown).
              </p>
              <textarea
                value={props.pastedText}
                onChange={(e) => props.setPastedText(e.target.value)}
                className="w-full h-72 p-3 border border-slate-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={`Câu 1: Thủ đô của Việt Nam là gì?\nA. TP. Hồ Chí Minh\nB. Đà Nẵng\n**C. Hà Nội**\nD. Hải Phòng\n\nCâu 2: ...`}
              />
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={props.onParseText}
                  disabled={props.parsing || !props.pastedText.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-md text-sm font-medium"
                >
                  <Play size={16} /> Bắt đầu làm
                </button>
                <button
                  onClick={props.loadSample}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium"
                >
                  <Sparkles size={16} /> Load đề mẫu
                </button>
              </div>
            </div>
          )}

          {props.tab === "web" && (
            <div>
              <p className="text-sm text-slate-600 mb-2">
                Mở trang Studocu (đã login), nhấn{" "}
                <kbd className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded text-xs">
                  Ctrl+A
                </kbd>{" "}
                →{" "}
                <kbd className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded text-xs">
                  Ctrl+C
                </kbd>
                , rồi paste vào ô bên dưới (
                <kbd className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded text-xs">
                  Ctrl+V
                </kbd>
                ). App sẽ giữ format đậm/highlight để phát hiện đáp án.
              </p>
              <div
                ref={pasteRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) =>
                  props.setPastedHtml((e.target as HTMLDivElement).innerHTML)
                }
                onPaste={(e) => {
                  const html = e.clipboardData.getData("text/html");
                  if (html) {
                    e.preventDefault();
                    if (pasteRef.current) {
                      pasteRef.current.innerHTML = html;
                      props.setPastedHtml(html);
                    }
                  }
                }}
                className="w-full min-h-72 max-h-96 overflow-auto p-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white prose prose-sm max-w-none"
                data-placeholder="Paste nội dung trang Studocu vào đây…"
              />
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  onClick={props.onParseHtml}
                  disabled={props.parsing || !props.pastedHtml.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-md text-sm font-medium"
                >
                  <Play size={16} /> Bắt đầu làm
                </button>
                <button
                  onClick={() => {
                    if (pasteRef.current) pasteRef.current.innerHTML = "";
                    props.setPastedHtml("");
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium"
                >
                  <X size={16} /> Xóa
                </button>
                <span className="text-xs text-slate-500">
                  App tự bỏ header/sidebar/quảng cáo và chỉ giữ lại các đoạn
                  có pattern câu hỏi.
                </span>
              </div>
            </div>
          )}

          {props.tab === "url" && (
            <div>
              <p className="text-sm text-slate-600 mb-2">
                Dán link Studocu (hoặc trang khác). App sẽ thử fetch qua CORS
                proxy public — <strong>chỉ best-effort</strong>, vì Studocu
                thường chặn bot. Nếu fail, anh dùng tab "Dán từ web".
              </p>
              <input
                type="url"
                value={props.urlValue}
                onChange={(e) => props.setUrlValue(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                placeholder="https://www.studocu.vn/vn/document/..."
              />
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={props.onParseUrl}
                  disabled={props.parsing || !props.urlValue.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-md text-sm font-medium"
                >
                  <Play size={16} /> Fetch & bắt đầu
                </button>
              </div>
            </div>
          )}

          {props.parsing && (
            <p className="mt-4 text-sm text-slate-500 flex items-center gap-2">
              <RefreshCw className="animate-spin" size={14} /> Đang xử lý…
            </p>
          )}
          {props.error && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{props.error}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-600 leading-relaxed">
        <h2 className="font-semibold text-slate-900 mb-2">Hướng dẫn nhanh</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Dán từ web / Studocu</strong> (khuyến nghị): mở trang đề,
            Ctrl+A → Ctrl+C → paste. App giữ format đậm/highlight và bỏ noise
            (header/sidebar/ads).
          </li>
          <li>
            <strong>Link URL</strong>: app thử fetch qua CORS proxy. Studocu
            thường chặn nên hay fail — fallback sang "Dán từ web".
          </li>
          <li>
            <strong>File .docx</strong>: bôi đậm (Ctrl+B) đáp án đúng trong
            Word rồi upload.
          </li>
          <li>
            <strong>Dán text</strong>: bọc đáp án đúng giữa{" "}
            <code className="bg-slate-100 px-1 rounded">**...**</code> hoặc kết
            thúc dòng bằng <code className="bg-slate-100 px-1 rounded">(*)</code>
            .
          </li>
          <li>
            App tự nhận <code>Câu 1:</code>, <code>1.</code>, <code>1)</code>
            {" "}làm câu hỏi và <code>A.</code>, <code>B)</code>, <code>a)</code>
            … làm đáp án. Trong quiz, bấm{" "}
            <strong>"Sửa đáp án"</strong> nếu phát hiện sai.
          </li>
        </ul>
      </div>
    </div>
  );
}

function TabButton(props: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={props.onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        props.active
          ? "border-indigo-600 text-indigo-600 bg-indigo-50/50"
          : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
      }`}
    >
      {props.icon} {props.label}
    </button>
  );
}

function QuizView(props: {
  questions: Question[];
  rawQuestions: Question[];
  currentIdx: number;
  setCurrentIdx: (n: number) => void;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submitted: Record<string, boolean>;
  setSubmitted: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  revealMode: "after-submit" | "instant";
  setRevealMode: (m: "after-submit" | "instant") => void;
  shuffleOptions: boolean;
  setShuffleOptions: (b: boolean) => void;
  optionOrders: Record<string, number[]>;
  warnings: string[];
  correctOverrides: Record<string, string[]>;
  setCorrectOverrides: React.Dispatch<
    React.SetStateAction<Record<string, string[]>>
  >;
  onFinish: () => void;
}) {
  const q = props.questions[props.currentIdx];
  const isFill = q.type === "fill";
  const order = props.optionOrders[q.id] || q.options.map((_, i) => i);
  const userAnswerLetter = props.answers[q.id];
  const userTypedAnswer = props.answers[q.id] ?? "";
  const isSubmitted = props.submitted[q.id] === true;
  const [editMode, setEditMode] = useState(false);
  const showResult =
    !editMode && (props.revealMode === "instant" || isSubmitted);
  const isLast = props.currentIdx === props.questions.length - 1;
  const hasOverride = !isFill && !!props.correctOverrides[q.id]?.length;
  const fillCorrect = isFill
    ? fillInIsCorrect(userTypedAnswer, q.answer ?? "")
    : false;
  const userHasAnswered = isFill
    ? userTypedAnswer.trim().length > 0
    : !!userAnswerLetter;

  function pick(letter: string) {
    if (editMode) {
      // In edit mode, clicking sets that option as the (single) correct answer
      // for this question, overriding the parser-detected correctness.
      props.setCorrectOverrides((prev) => ({ ...prev, [q.id]: [letter] }));
      // Reset submission state for this question so the user can re-answer.
      props.setSubmitted((s) => {
        const next = { ...s };
        delete next[q.id];
        return next;
      });
      setEditMode(false);
      return;
    }
    if (showResult && props.revealMode === "after-submit" && isSubmitted) return;
    props.setAnswers((a) => ({ ...a, [q.id]: letter }));
    if (props.revealMode === "instant") {
      props.setSubmitted((s) => ({ ...s, [q.id]: true }));
    }
  }

  function clearOverride() {
    props.setCorrectOverrides((prev) => {
      const next = { ...prev };
      delete next[q.id];
      return next;
    });
    props.setSubmitted((s) => {
      const next = { ...s };
      delete next[q.id];
      return next;
    });
  }

  function submitOrNext() {
    if (props.revealMode === "after-submit" && !isSubmitted && userHasAnswered) {
      props.setSubmitted((s) => ({ ...s, [q.id]: true }));
      return;
    }
    if (isLast) {
      props.onFinish();
    } else {
      props.setCurrentIdx(props.currentIdx + 1);
    }
  }

  function setFillAnswer(value: string) {
    props.setAnswers((a) => ({ ...a, [q.id]: value }));
    if (props.revealMode === "instant" && value.trim().length > 0) {
      // Don't auto-submit on typing in instant mode — wait for blur/enter.
    }
  }

  function submitFill() {
    if (props.revealMode === "after-submit" && userTypedAnswer.trim()) {
      props.setSubmitted((s) => ({ ...s, [q.id]: true }));
    }
  }

  const answeredCount = Object.keys(props.answers).length;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="text-sm text-slate-600">
            Câu <strong>{props.currentIdx + 1}</strong> /{" "}
            {props.questions.length} · Đã trả lời{" "}
            <strong>{answeredCount}</strong>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {!isFill && (
              <button
                onClick={() => setEditMode((m) => !m)}
                className={`flex items-center gap-1 px-2 py-1 rounded border ${
                  editMode
                    ? "border-rose-300 bg-rose-50 text-rose-700"
                    : hasOverride
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 text-slate-500"
                }`}
                title="Sửa lại đáp án đúng cho câu này"
              >
                {editMode ? <Save size={12} /> : <Pencil size={12} />}{" "}
                {editMode
                  ? "Click đáp án đúng…"
                  : hasOverride
                  ? "Đã sửa đáp án"
                  : "Sửa đáp án"}
              </button>
            )}
            {hasOverride && !editMode && (
              <button
                onClick={clearOverride}
                className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50"
                title="Bỏ override, dùng lại đáp án đã phát hiện tự động"
              >
                <RefreshCw size={12} /> Reset
              </button>
            )}
            {!isFill && (
              <button
                onClick={() => props.setShuffleOptions(!props.shuffleOptions)}
                className={`flex items-center gap-1 px-2 py-1 rounded border ${
                  props.shuffleOptions
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-500"
                }`}
                title="Xáo trộn thứ tự đáp án"
              >
                <Shuffle size={12} /> Trộn đáp án
              </button>
            )}
            <button
              onClick={() =>
                props.setRevealMode(
                  props.revealMode === "instant" ? "after-submit" : "instant"
                )
              }
              className={`flex items-center gap-1 px-2 py-1 rounded border ${
                props.revealMode === "instant"
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-slate-200 text-slate-500"
              }`}
              title="Hiện đáp án ngay khi chọn"
            >
              {props.revealMode === "instant" ? (
                <Eye size={12} />
              ) : (
                <EyeOff size={12} />
              )}{" "}
              {props.revealMode === "instant" ? "Hiện đáp án ngay" : "Tự kiểm tra"}
            </button>
          </div>
        </div>

        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all"
            style={{
              width: `${((props.currentIdx + 1) / props.questions.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <p className="text-xs font-medium text-indigo-600 mb-2">
          Câu {props.currentIdx + 1}
        </p>
        <h2 className="text-lg font-semibold text-slate-900 mb-5 leading-relaxed">
          {q.text}
        </h2>

        {editMode && (
          <div className="mb-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800">
            Chế độ sửa đáp án: click vào đáp án anh cho là đúng. App sẽ
            override kết quả phát hiện tự động.
          </div>
        )}

        {isFill ? (
          <div className="space-y-2">
            <label className="block text-xs text-slate-500 mb-1">
              Gõ đáp án vào ô dưới (không phân biệt hoa thường):
            </label>
            <input
              type="text"
              value={userTypedAnswer}
              onChange={(e) => setFillAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitFill();
                }
              }}
              disabled={
                showResult &&
                props.revealMode === "after-submit" &&
                isSubmitted
              }
              placeholder="Ví dụ: 255.255.255.0"
              className={`w-full px-4 py-3 border-2 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
                showResult
                  ? fillCorrect
                    ? "border-green-500 bg-green-50"
                    : "border-red-400 bg-red-50"
                  : "border-slate-300 bg-white focus:border-indigo-500"
              }`}
            />
            {!showResult && (
              <p className="text-xs text-slate-400">
                Mẹo: bấm <kbd className="px-1 rounded bg-slate-100 border">Enter</kbd>{" "}
                để chấm, hoặc bấm nút <strong>Kiểm tra</strong> bên dưới.
              </p>
            )}
          </div>
        ) : (
        <div className="space-y-2">
          {order.map((origIdx, displayIdx) => {
            const opt = q.options[origIdx];
            const displayLetter = String.fromCharCode(65 + displayIdx);
            const picked = userAnswerLetter === opt.letter;

            let cls =
              "border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/40";
            if (editMode) {
              cls = opt.isCorrect
                ? "border-emerald-400 bg-emerald-50 hover:border-rose-400 hover:bg-rose-50"
                : "border-slate-200 bg-white hover:border-rose-400 hover:bg-rose-50";
            } else {
              if (picked && !showResult) {
                cls = "border-indigo-500 bg-indigo-50";
              }
              if (showResult) {
                if (opt.isCorrect) {
                  cls = "border-green-500 bg-green-50";
                } else if (picked) {
                  cls = "border-red-400 bg-red-50";
                } else {
                  cls = "border-slate-200 bg-white";
                }
              }
            }

            return (
              <button
                key={opt.letter}
                onClick={() => pick(opt.letter)}
                disabled={
                  !editMode &&
                  showResult &&
                  props.revealMode === "after-submit" &&
                  isSubmitted
                }
                className={`w-full text-left flex items-start gap-3 px-4 py-3 border-2 rounded-lg transition-colors ${cls}`}
              >
                <span
                  className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-semibold ${
                    editMode && opt.isCorrect
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : showResult && opt.isCorrect
                      ? "border-green-500 bg-green-500 text-white"
                      : showResult && picked
                      ? "border-red-500 bg-red-500 text-white"
                      : picked
                      ? "border-indigo-500 bg-indigo-500 text-white"
                      : "border-slate-300 text-slate-600"
                  }`}
                >
                  {displayLetter}
                </span>
                <span className="flex-1 text-slate-800 pt-0.5">{opt.text}</span>
                {editMode && opt.isCorrect && (
                  <Check className="text-emerald-600 flex-shrink-0" size={20} />
                )}
                {!editMode && showResult && opt.isCorrect && (
                  <Check className="text-green-600 flex-shrink-0" size={20} />
                )}
                {!editMode && showResult && !opt.isCorrect && picked && (
                  <X className="text-red-600 flex-shrink-0" size={20} />
                )}
              </button>
            );
          })}
        </div>
        )}

        {showResult && (
          <div
            className={`mt-5 px-4 py-3 rounded-md text-sm ${
              (isFill
                ? fillCorrect
                : q.options.find((o) => o.letter === userAnswerLetter)?.isCorrect)
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {isFill
              ? fillCorrect
                ? "Chính xác!"
                : `Sai rồi. Đáp án đúng: ${q.answer ?? "(không có)"}`
              : q.options.find((o) => o.letter === userAnswerLetter)?.isCorrect
              ? "Chính xác!"
              : `Sai rồi. Đáp án đúng: ${
                  q.options
                    .filter((o) => o.isCorrect)
                    .map((o) => o.text)
                    .join(", ") || "(không phát hiện được)"
                }`}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => props.setCurrentIdx(Math.max(0, props.currentIdx - 1))}
          disabled={props.currentIdx === 0}
          className="inline-flex items-center gap-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-md text-sm hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft size={16} /> Trước
        </button>

        <button
          onClick={submitOrNext}
          disabled={
            props.revealMode === "after-submit" &&
            !isSubmitted &&
            !userHasAnswered
          }
          className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-md text-sm font-medium"
        >
          {props.revealMode === "after-submit" && !isSubmitted
            ? "Kiểm tra"
            : isLast
            ? "Xem kết quả"
            : "Tiếp"}
          {!(props.revealMode === "after-submit" && !isSubmitted) && (
            <ChevronRight size={16} />
          )}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-xs font-medium text-slate-500 mb-2">
          Bản đồ câu hỏi
        </p>
        <div className="flex flex-wrap gap-2">
          {props.questions.map((qq, i) => {
            const ans = props.answers[qq.id];
            const isFillQ = qq.type === "fill";
            const isCorrect = isFillQ
              ? fillInIsCorrect(ans ?? "", qq.answer ?? "")
              : !!qq.options.find((o) => o.letter === ans)?.isCorrect;
            const ok = !!ans && isCorrect && props.submitted[qq.id];
            const wrong = !!ans && !isCorrect && props.submitted[qq.id];
            const answered = !!ans && (isFillQ ? ans.trim().length > 0 : true);
            return (
              <button
                key={qq.id}
                onClick={() => props.setCurrentIdx(i)}
                className={`w-8 h-8 rounded text-xs font-medium border ${
                  i === props.currentIdx
                    ? "ring-2 ring-indigo-500 ring-offset-1"
                    : ""
                } ${
                  ok
                    ? "bg-green-500 text-white border-green-500"
                    : wrong
                    ? "bg-red-500 text-white border-red-500"
                    : answered
                    ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                    : "bg-white text-slate-600 border-slate-300"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {props.warnings.length > 0 && (
        <details className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">
          <summary className="cursor-pointer font-medium flex items-center gap-1">
            <AlertTriangle size={14} /> {props.warnings.length} cảnh báo khi
            parse
          </summary>
          <ul className="mt-2 space-y-1 list-disc pl-5">
            {props.warnings.slice(0, 30).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ResultView(props: {
  questions: Question[];
  answers: Record<string, string>;
  onRestart: () => void;
  onNew: () => void;
}) {
  const score = useMemo(() => {
    let correct = 0;
    for (const q of props.questions) {
      const ans = props.answers[q.id];
      if (!ans) continue;
      if (q.type === "fill") {
        if (fillInIsCorrect(ans, q.answer ?? "")) correct++;
      } else if (q.options.find((o) => o.letter === ans)?.isCorrect) {
        correct++;
      }
    }
    return { correct, total: props.questions.length };
  }, [props.questions, props.answers]);

  const pct = props.questions.length
    ? Math.round((score.correct / score.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
        <Trophy
          size={48}
          className={`mx-auto mb-3 ${
            pct >= 80
              ? "text-amber-500"
              : pct >= 50
              ? "text-indigo-500"
              : "text-slate-400"
          }`}
        />
        <p className="text-sm text-slate-500 mb-1">Kết quả của anh</p>
        <h2 className="text-4xl font-bold text-slate-900">
          {score.correct} / {score.total}
        </h2>
        <p className="text-lg text-slate-600 mt-1">{pct}% đúng</p>

        <div className="flex justify-center gap-3 mt-6">
          <button
            onClick={props.onRestart}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium"
          >
            <RefreshCw size={16} /> Làm lại đề này
          </button>
          <button
            onClick={props.onNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium"
          >
            <Upload size={16} /> Upload đề mới
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Xem lại từng câu</h3>
        <div className="space-y-4">
          {props.questions.map((q, i) => {
            const userAnsRaw = props.answers[q.id];
            const isFillQ = q.type === "fill";
            const userAns = isFillQ
              ? undefined
              : q.options.find((o) => o.letter === userAnsRaw);
            const correct = q.options.filter((o) => o.isCorrect);
            const isCorrect = isFillQ
              ? fillInIsCorrect(userAnsRaw ?? "", q.answer ?? "")
              : !!userAns?.isCorrect;
            const userAnsText = isFillQ
              ? userAnsRaw ?? ""
              : userAns?.text ?? "";
            const hasAns = isFillQ
              ? (userAnsRaw ?? "").trim().length > 0
              : !!userAns;
            return (
              <div
                key={q.id}
                className={`border rounded-lg p-4 ${
                  isCorrect
                    ? "border-green-200 bg-green-50/40"
                    : hasAns
                    ? "border-red-200 bg-red-50/40"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                      isCorrect
                        ? "bg-green-500 text-white"
                        : hasAns
                        ? "bg-red-500 text-white"
                        : "bg-slate-300 text-white"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <p className="font-medium text-slate-900 flex-1">{q.text}</p>
                </div>
                <div className="mt-2 ml-8 text-sm space-y-1">
                  <p className="text-slate-600">
                    Đáp án của anh:{" "}
                    <span
                      className={
                        hasAns
                          ? isCorrect
                            ? "text-green-700 font-medium"
                            : "text-red-700 font-medium"
                          : "text-slate-400 italic"
                      }
                    >
                      {hasAns ? userAnsText : "(chưa trả lời)"}
                    </span>
                  </p>
                  {!isCorrect && (
                    <p className="text-slate-600">
                      Đáp án đúng:{" "}
                      <span className="text-green-700 font-medium">
                        {isFillQ
                          ? q.answer ?? "(không có)"
                          : correct.length > 0
                          ? correct.map((o) => o.text).join(", ")
                          : "(không phát hiện được)"}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function shuffleArray<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export default App;
