import { router, json, error, ai } from '@appdeploy/sdk';
const tasks: Record<string, string> = {
  notes: 'Write standard study notes with clear headings, definitions, examples and a short summary. Plain text only.',
  quiz: 'Create 8 numbered practice questions followed by a clearly labelled Answer Key. Plain text only.',
  flashcards: 'Create 10 flashcards labelled Card 1, Card 2, etc., each with Question and Answer. Plain text only.',
  plan: 'Create a clean 7-day revision plan with Day, Task and Goal for each day. Plain text only.',
  shortnotes: 'Make concise exam-ready short notes with clear headings and simple bullet points. Plain text only.',
  essay: 'Use the headings Essay Title, Introduction/Thesis, Main Points, Supporting Arguments and Conclusion. Plain text only.',
  chat: 'Answer directly with headings Answer, Explanation and Example where useful. Use numbered steps for calculations. Plain text only.',
};
export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],
  'POST /api/study': [
    async ({ body }) => {
      const r = (body || {}) as {
        subject?: string;
        topic?: string;
        level?: string;
        kind?: string;
      };
      const topic = String(r.topic || '').trim(),
        kind = String(r.kind || 'notes');
      if (!topic) return error('Enter a topic first.', 400);
      if (!Object.prototype.hasOwnProperty.call(tasks, kind))
        return error('Choose a valid tool.', 400);
      try {
        const a = await ai.generate({
          system:
            'You are StudySmart, a fast, concise tutor. Answer directly and accurately. Use plain text only, with short headings, brief numbered steps, simple bullets, and readable formulas (for example, Speed = Distance ÷ Time). Never output Markdown markers or raw LaTeX. For calculations use Question, Given, Formula, Working, Final Answer. Avoid long introductions and unnecessary repetition.',
          prompt:
            'Subject: ' +
            String(r.subject || 'General') +
            '\nLevel: ' +
            String(r.level || 'Beginner') +
            '\nTopic: ' +
            topic +
            '\nTask: ' +
            tasks[kind],
          maxTokens: kind === 'quiz' ? 850 : kind === 'flashcards' ? 900 : kind === 'essay' ? 1000 : kind === 'plan' ? 700 : 650,
          thinkingMode: 'FAST',
        });
        return json({ text: a.text });
      } catch (e) {
        console.error('Study generation failed', e);
        return error('Study generation unavailable. Retry shortly.', 500);
      }
    },
  ],
  'POST /api/photo-solve': [
    async ({ body }) => {
      const r = (body || {}) as {
        image?: string;
        mimeType?: string;
        subject?: string;
        level?: string;
      };
      if (!r.image) return error('Upload a photo first.', 400);
      try {
        const a = await ai.generate({
          system:
            'You are StudySmart, a fast, concise tutor. Read the image carefully and solve the question accurately. Use plain text only, no Markdown markers or raw LaTeX. Give Question, Given, Formula, Working and Final Answer where relevant. Keep steps brief and state if the image is unclear.',
          prompt:
            'Subject: ' +
            String(r.subject || 'General') +
            '; level: ' +
            String(r.level || 'Beginner') +
            '. Solve this question photo step by step.',
          images: [
            { data: r.image, mimeType: String(r.mimeType || 'image/jpeg') },
          ],
          maxTokens: 700,
          thinkingMode: 'FAST',
        });
        return json({ text: a.text });
      } catch (e) {
        console.error('Photo solve failed', e);
        return error('Photo solver unavailable. Try again.', 500);
      }
    },
  ],
});
