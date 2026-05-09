# Quiz Học Bài

Web app làm trắc nghiệm từ file `.docx` hoặc text dán vào — đáp án **in đậm** (bold) hoặc **bôi highlight** trong file sẽ được nhận làm đáp án đúng.

Hỗ trợ:

- **Đề có sẵn** (pre-baked): mở app là click vào môn để vào làm ngay, không cần upload gì. Đề được lưu trong `src/data/subjects/*.json`.
- **Dán từ web / Studocu**: copy toàn bộ trang Studocu rồi paste — app giữ format đậm/highlight.
- **Link URL**: app thử fetch qua CORS proxy (best-effort).
- **Upload `.docx`** (Microsoft Word) — parse trực tiếp trong trình duyệt, không cần backend.
- **Dán text** — đánh dấu đáp án đúng bằng `**...**` (markdown bold) hoặc kết thúc dòng bằng `(*)`.
- **Sửa đáp án**: nếu app phát hiện sai, bấm "Sửa đáp án" trong quiz để override.
- Trộn ngẫu nhiên thứ tự đáp án.
- 2 chế độ ôn: "Tự kiểm tra" (chọn rồi bấm Kiểm tra) và "Hiện đáp án ngay".
- Bản đồ câu hỏi, % điểm cuối bài, xem lại từng câu.

App **chạy 100% phía client** (file `.docx` không bị upload đi đâu cả) và build ra static HTML/JS/CSS — host được trên bất kỳ static host nào (Vercel, Netlify, Cloudflare Pages, GitHub Pages, ...).

## Chạy local

Yêu cầu: Node.js 18+.

```bash
npm install
npm run dev
```

Mở http://localhost:5173.

## Build production

```bash
npm run build
```

Output ở thư mục `dist/`. Đây là toàn bộ những gì cần host.

## Deploy

### Vercel (dễ nhất)

1. Push repo lên GitHub.
2. Vào https://vercel.com → "Add New Project" → import repo.
3. Vercel auto-detect Vite, click **Deploy**. Xong.

Hoặc dùng CLI:

```bash
npm install -g vercel
vercel --prod
```

### Netlify

1. Push repo lên GitHub.
2. Vào https://netlify.com → "Add new site" → "Import existing project" → chọn repo.
3. Build command: `npm run build`. Publish directory: `dist`. Click **Deploy**.

Hoặc drag & drop folder `dist/` (sau khi `npm run build`) vào https://app.netlify.com/drop.

### Cloudflare Pages

1. Push repo lên GitHub.
2. Cloudflare dashboard → Workers & Pages → Create application → Pages → Connect to Git.
3. Build command: `npm run build`. Build output: `dist`.

### GitHub Pages

```bash
npm run build
npx gh-pages -d dist
```

### Static server bất kỳ

Sau khi `npm run build`, copy nội dung folder `dist/` lên web server (nginx, Apache, S3 + CloudFront, ...). Không cần Node.js trên server.

## Cách chuẩn bị file đề

### File `.docx`

Mở file đề bằng Word/Google Docs, **bôi đậm (Ctrl+B) đáp án đúng** cho từng câu rồi save. Format:

```
Câu 1: Thủ đô Việt Nam là gì?
A. TP. Hồ Chí Minh
B. Đà Nẵng
C. Hà Nội         ← bôi đậm dòng này
D. Hải Phòng
```

App tự nhận diện các tiền tố:

- Câu hỏi: `Câu 1:`, `Cau 1.`, `1.`, `1)`, `Question 1`, `Q 1`
- Đáp án: `A.`, `B)`, `c.`, `d)` ... (A → H)

### Dán text (không có file Word)

Bọc đáp án đúng bằng `**...**`:

```
Câu 1: 2 + 2 bằng?
A. 3
**B. 4**
C. 5
D. 6
```

Hoặc kết thúc dòng đáp án đúng bằng `(*)`:

```
Câu 1: 2 + 2 bằng?
A. 3
B. 4 (*)
C. 5
D. 6
```

## Studocu?

Studocu yêu cầu đăng nhập + có CORS chặn fetch từ trình duyệt nên app không tự download trực tiếp được. Có 3 cách:

1. **Tab "Dán từ web / Studocu"** (khuyến nghị): mở trang Studocu (đã login), Ctrl+A → Ctrl+C → paste vào ô trong app. App giữ format đậm/highlight.
2. **Bake vào source**: copy nội dung 2-3 môn hay dùng vào file `src/data/subjects/*.json` (xem cấu trúc bên dưới) rồi `npm run build` để pre-load luôn — anh chỉ cần click "Đề có sẵn".
3. Tải file `.docx`/PDF của Studocu rồi upload — chắc chắn nhất.

### Thêm đề mới vào "Đề có sẵn"

Tạo file `src/data/subjects/<slug>.json`:

```json
{
  "id": "iis",
  "title": "IIS",
  "longName": "Nhập môn an toàn thông tin",
  "description": "Đề ôn tập IIS Quiz Final Trial.",
  "source": "https://www.studocu.vn/...",
  "questions": [
    {
      "id": "q-1",
      "text": "Câu hỏi 1?",
      "options": [
        { "letter": "A", "text": "Đáp án A", "isCorrect": false },
        { "letter": "B", "text": "Đáp án B", "isCorrect": true  },
        { "letter": "C", "text": "Đáp án C", "isCorrect": false },
        { "letter": "D", "text": "Đáp án D", "isCorrect": false }
      ]
    }
  ]
}
```

Rồi import nó trong `src/data/subjects.ts` và push vào mảng `SUBJECTS`.

## Tech stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- [mammoth.js](https://github.com/mwilliamson/mammoth.js) để parse `.docx` → HTML và giữ thông tin bold/highlight.
- Lucide icons.

## Cấu trúc

```
src/
  App.tsx                    ← UI 3 màn hình: input → quiz → result
  lib/parser.ts              ← Parse DOCX / text / HTML / URL → Question[]
  data/subjects.ts           ← Đăng ký các môn pre-baked
  data/subjects/<slug>.json  ← Câu hỏi của từng môn
  App.css, index.css
```
