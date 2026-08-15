# ChatGPT Clone (Next.js)

واجهة محادثة بأسلوب ChatGPT مبنية بـ Next.js App Router و Tailwind، وفق نظام التصميم في `DESIGN.md` (graphite ink on warm paper).

## التشغيل

```bash
npm install
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000).

## الردود الذكية

بدون مفتاح API يعمل التطبيق بردود تجريبية متدفقة (streaming).

### Gemini (مجاني — مُفضّل)

1. احصل على مفتاح من [Google AI Studio](https://aistudio.google.com/apikey)
2. في `.env.local` ضع:
   ```env
   GEMINI_API_KEY=your_key_here
   GEMINI_MODEL=gemini-2.5-flash
   ```
3. أعد تشغيل `npm run dev`

### OpenAI (مدفوع)

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

إذا وُجد مفتاح Gemini يُستخدم أولاً، ثم OpenAI، وإلا الرد التجريبي.

## المميزات

- شريط جانبي بمحفوظات المحادثات
- محادثة جديدة / حذف / اختيار محادثة
- إرسال مع Enter وتدفق الرد حرفاً بحرف
- حفظ المحادثات في `localStorage`
- تصميم رمادي مسطح وفق توكنات DESIGN.md
