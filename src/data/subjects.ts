import type { Question } from "@/lib/parser";

export interface Subject {
  /** Stable id used for storing per-subject quiz state. */
  id: string;
  /** Short title shown on the picker, e.g. "IIS". */
  title: string;
  /** Full long name, e.g. "Nhập môn an toàn thông tin". */
  longName?: string;
  /** Short blurb shown under the title. */
  description?: string;
  /** Source URL the questions came from (Studocu, etc.). */
  source?: string;
  /** Pre-baked questions. Empty array = subject is reserved but not filled. */
  questions: Question[];
}

import iisRaw from "./subjects/iis.json";
import cneRaw from "./subjects/cne.json";

export const SUBJECTS: Subject[] = [
  iisRaw as Subject,
  cneRaw as Subject,
];
