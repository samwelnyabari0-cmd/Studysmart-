import './styles.css';
import { api } from '@appdeploy/client';
async function prepareQuestionPhoto(file: File): Promise<{data: string; mimeType: string}> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close(); throw new Error('Could not prepare the image.'); }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not compress the image.')), 'image/jpeg', 0.82));
  const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read the image.')); reader.readAsDataURL(blob); });
  return { data: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
}
type Kind =
  | 'notes'
  | 'quiz'
  | 'flashcards'
  | 'plan'
  | 'shortnotes'
  | 'essay'
  | 'chat';
let kind: Kind = 'notes',
  latest = '';
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const labels: Record<Kind, string> = {
  notes: 'Study notes',
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  plan: 'Revision plan',
  shortnotes: 'Short notes',
  essay: 'Essay helper',
  chat: 'AI tutor chat',
};
const read = (k: string): any[] => {
  try {
    return JSON.parse(localStorage.getItem(k) || '[]');
  } catch {
    return [];
  }
};
const write = (k: string, v: any[]) => localStorage.setItem(k, JSON.stringify(v));
function renderAnswer(target: HTMLElement, raw: string) {
  const safe = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
  const plain = raw.replace(/\\\[/g, '').replace(/\\\]/g, '').replace(/\\\(/g, '').replace(/\\\)/g, '').replace(/\\text\{([^}]*)\}/g, '$1').replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1) / ($2)').replace(/\\div/g, '÷').replace(/\\times/g, '×').replace(/\\cdot/g, '·').replace(/\\sqrt\{([^}]*)\}/g, '√($1)').replace(/\$\$?/g, '').replace(/\\/g, '');
  const lines = plain.split(/\r?\n/); let html = '', list: 'ul' | 'ol' | '' = '';
  const closeList = () => { if (list) { html += `</${list}>`; list = ''; } };
  for (const line of lines) { const t = line.trim(); if (!t || /^---+$/.test(t)) { closeList(); continue; } const h = t.match(/^#{1,4}\s+(.+)$/); if (h) { closeList(); html += `<h4>${safe(h[1].replace(/\*\*/g,''))}</h4>`; continue; } const bullet = t.match(/^(?:[-*•])\s+(.+)$/); const numbered = t.match(/^\d+[.)]\s+(.+)$/); if (bullet || numbered) { const tag = bullet ? 'ul' : 'ol'; if (list !== tag) { closeList(); html += `<${tag}>`; list = tag; } html += `<li>${safe((bullet ? bullet[1] : numbered![1]).replace(/\*\*/g,''))}</li>`; continue; } closeList(); html += `<p>${safe(t.replace(/\*\*/g, '').replace(/\*/g, ''))}</p>`; }
  closeList(); target.innerHTML = html;
}
document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(
  b =>
    (b.onclick = () => {
      kind = b.dataset.kind as Kind;
      document
        .querySelectorAll('.tool')
        .forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      $('button#generate').textContent = 'Generate ' + labels[kind] + ' →';
    })
);
document
  .querySelectorAll<HTMLButtonElement>('[data-jump]')
  .forEach(
    b =>
      (b.onclick = () =>
        $('#' + b.dataset.jump).scrollIntoView({ behavior: 'smooth' }))
  );
$('button#generate').onclick = async () => {
  const topic = $<HTMLTextAreaElement>('#topic').value.trim();
  if (!topic) {
    $('p#status').textContent = 'Enter a topic first.';
    return;
  }
  $('p#status').textContent = 'Working…';
  try {
    const r = await api.post('/api/study', {
      subject: $<HTMLInputElement>('#subject').value,
      topic,
      level: $<HTMLSelectElement>('#level').value,
      kind,
    });
    latest = String(r.data?.text || '');
    renderAnswer($('div#result'), latest || 'No answer returned.');
    $<HTMLElement>('#result-title').textContent = labels[kind];
    $('p#status').textContent = latest
      ? 'Study material ready.'
      : 'Please retry.';
  } catch {
    $('p#status').textContent = 'Generation failed. Check internet and retry.';
  }
};
function renderSaved() {
  const q = $<HTMLInputElement>('#search').value.toLowerCase(),
    list = $('#saved-list');
  list.replaceChildren();
  read('ss-library')
    .filter(x => (x.subject + x.title + x.text).toLowerCase().includes(q))
    .forEach((x, i) => {
      const a = document.createElement('article'),
        p = document.createElement('p'),
        open = document.createElement('button'),
        del = document.createElement('button');
      p.textContent =
        x.subject + ' · ' + x.title + ' — ' + x.text.slice(0, 150);
      open.textContent = 'Open';
      open.onclick = () => {
        latest = x.text;
        renderAnswer($('#result'), latest);
      };
      del.textContent = 'Delete';
      del.onclick = () => {
        const arr = read('ss-library');
        arr.splice(i, 1);
        write('ss-library', arr);
        renderSaved();
      };
      a.append(p, open, del);
      list.append(a);
    });
  if (!list.childElementCount) list.textContent = 'No saved notes yet.';
}
function renderTasks() {
  const el = $('#tasks');
  el.replaceChildren();
  read('ss-tasks').forEach((t, i) => {
    const a = document.createElement('article'),
      b = document.createElement('button');
    a.textContent =
      t.subject + ' — ' + t.name + ' · ' + (t.date || 'No due date') + ' ';
    b.textContent = 'Delete';
    b.onclick = () => {
      const x = read('ss-tasks');
      x.splice(i, 1);
      write('ss-tasks', x);
      renderTasks();
    };
    a.append(b);
    el.append(a);
  });
}
function renderMeetings() {
  const el = $('#meeting-list');
  el.replaceChildren();
  read('ss-meetings').forEach((m, i) => {
    const p = document.createElement('p'),
      a = document.createElement('a'),
      b = document.createElement('button');
    a.href = m.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = m.name || 'Open meeting';
    b.textContent = 'Remove';
    b.onclick = () => {
      const x = read('ss-meetings');
      x.splice(i, 1);
      write('ss-meetings', x);
      renderMeetings();
    };
    p.append(a, document.createTextNode(' '), b);
    el.append(p);
  });
}
$('#save').onclick = () => {
  if (!latest) {
    $('#status').textContent = 'Generate something first.';
    return;
  }
  const a = read('ss-library');
  a.unshift({
    subject: $<HTMLInputElement>('#subject').value || 'General',
    title: $('#result-title').textContent,
    text: latest,
  });
  write('ss-library', a);
  renderSaved();
  $('#status').textContent = 'Saved to My Library.';
};
$('#copy').onclick = async () => {
  if (latest)
    try {
      await navigator.clipboard.writeText(latest);
      $('#status').textContent = 'Copied.';
    } catch {
      $('#status').textContent = 'Select and copy the text.';
    }
};
$('#share').onclick = async () => {
  if (latest && navigator.share)
    try {
      await navigator.share({ title: 'StudySmart', text: latest });
    } catch {}
};
$('#search').oninput = renderSaved;
$('#add-task').onclick = () => {
  const subject = $<HTMLInputElement>('#task-subject').value.trim(),
    name = $<HTMLInputElement>('#task-name').value.trim();
  if (!subject || !name) {
    $('#status').textContent = 'Enter a subject and task.';
    return;
  }
  const a = read('ss-tasks');
  a.push({ subject, name, date: $<HTMLInputElement>('#task-date').value });
  write('ss-tasks', a);
  renderTasks();
};
$('#export').onclick = () => {
  const rows = [
      ['Subject', 'Task', 'Due'],
      ...read('ss-tasks').map(x => [x.subject, x.name, x.date]),
    ],
    csv = rows
      .map(r =>
        r.map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(',')
      )
      .join('\n'),
    url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    a = document.createElement('a');
  a.href = url;
  a.download = 'studysmart-planner.csv';
  a.click();
  URL.revokeObjectURL(url);
};
$('#add-meeting').onclick = () => {
  const url = $<HTMLInputElement>('#meeting-url').value.trim();
  if (!/^https:\/\//i.test(url)) {
    $('#status').textContent = 'Enter a valid HTTPS link.';
    return;
  }
  const a = read('ss-meetings');
  a.push({ name: $<HTMLInputElement>('#meeting-name').value, url });
  write('ss-meetings', a);
  renderMeetings();
};
$('#larger').onclick = () => (document.documentElement.style.fontSize = '110%');
$('#smaller').onclick = () => (document.documentElement.style.fontSize = '90%');
$('#solve').onclick = async () => {
  const file = $<HTMLInputElement>('#photo-file').files?.[0];
  if (!file) {
    $('#status').textContent = 'Please take or choose a question photo first.';
    return;
  }
  if (!file.type.startsWith('image/')) {
    $('#status').textContent = 'Please choose a JPG, PNG or other image file.';
    return;
  }
  const button = $<HTMLButtonElement>('#solve');
  button.disabled = true;
  button.textContent = 'Scanning photo…';
  $('#status').textContent = 'Preparing photo and solving your question. Please wait…';
  try {
    const prepared = await prepareQuestionPhoto(file);
    const r = await api.post('/api/photo-solve', {
      image: prepared.data,
      mimeType: prepared.mimeType,
      subject: $<HTMLInputElement>('#subject').value,
      level: $<HTMLSelectElement>('#level').value,
    });
    latest = String(r.data?.text || '').trim();
    if (!latest) throw new Error('No answer returned. Try a clearer photo.');
    renderAnswer($('#result'), latest);
    $('#result-title').textContent = 'Photo solution';
    $('#status').textContent = 'Photo solved. Review the steps and final answer below.';
    $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    console.error('StudySmart photo solver error:', err);
    const message = err instanceof Error ? err.message : '';
    $('#status').textContent = message || 'Photo solving failed. Check your internet connection, use a clear JPG/PNG photo, and try again. The AI service may be temporarily unavailable.';
  } finally {
    button.disabled = false;
    button.textContent = 'Scan photo & explain answer';
  }
};
renderSaved();
renderTasks();
renderMeetings();
