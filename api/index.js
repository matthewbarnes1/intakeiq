// IntakeIQ — AI client-intake triage for solo & small law firms (stateless analyzer)
const express = require('express');
const crypto = require('node:crypto');

const PRACTICE_AREAS = [
  { key: 'personal_injury', label: 'Personal injury', kw: ['accident', 'injured', 'injury', 'crash', 'collision', 'slip', 'fell', 'fall', 'whiplash', 'hospital', 'hit me', 'rear-end', 'dog bite'], value: 'high' },
  { key: 'family', label: 'Family law', kw: ['divorce', 'custody', 'child support', 'alimony', 'separation', 'spouse', 'prenup', 'visitation'], value: 'medium' },
  { key: 'employment', label: 'Employment', kw: ['fired', 'terminated', 'wrongful', 'discrimination', 'harassment', 'wages', 'overtime', 'hostile work', 'retaliat', 'severance'], value: 'high' },
  { key: 'estate', label: 'Estate / probate', kw: ['will', 'estate', 'probate', 'inheritance', 'trust', 'executor', 'passed away', 'deceased'], value: 'medium' },
  { key: 'criminal', label: 'Criminal defense', kw: ['arrested', 'charged', 'dui', 'dwi', 'police', 'warrant', 'felony', 'misdemeanor', 'court date'], value: 'medium' },
  { key: 'business', label: 'Business / contract', kw: ['contract', 'breach', 'partner', 'llc', 'vendor', 'invoice unpaid', 'non-compete', 'shareholder'], value: 'medium' },
  { key: 'immigration', label: 'Immigration', kw: ['visa', 'green card', 'citizenship', 'deportation', 'asylum', 'uscis', 'immigration'], value: 'medium' },
  { key: 'landlord', label: 'Landlord / tenant', kw: ['landlord', 'tenant', 'eviction', 'lease', 'deposit', 'rent'], value: 'low' },
];
const URGENCY_KW = ['court date', 'deadline', 'tomorrow', 'this week', 'statute', 'served', 'summons', 'hearing', 'arrested', 'eviction notice', 'termination letter', 'urgent', 'asap'];
const RISK_KW = ['already have a lawyer', 'fired my lawyer', 'several attorneys', 'sue you', 'complaint against', 'bar complaint', 'free consultation only', 'no money', "can't pay", 'contingency only'];
const DATE_RE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(?:last|next)\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday)\b|\byesterday\b|\btoday\b/gi;
const MONEY_RE = /\$\s?[\d,]+(?:\.\d{2})?(?:\s?(?:k|thousand|million|m))?/gi;

function analyze(text) {
  const t = text.toLowerCase();
  const scores = PRACTICE_AREAS.map(a => ({ ...a, hits: a.kw.filter(k => t.includes(k)) })).map(a => ({ ...a, score: a.hits.length }));
  scores.sort((x, y) => y.score - x.score);
  const top = scores[0].score > 0 ? scores[0] : { key: 'general', label: 'General inquiry', hits: [], value: 'low', score: 0 };
  const urgency = URGENCY_KW.filter(k => t.includes(k));
  const risks = RISK_KW.filter(k => t.includes(k));
  const dates = [...new Set((text.match(DATE_RE) || []).map(s => s.trim()))].slice(0, 6);
  const money = [...new Set((text.match(MONEY_RE) || []).map(s => s.trim()))].slice(0, 6);
  const emails = [...new Set(text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [])];
  const phones = [...new Set(text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g) || [])];
  // merit/fit score out of 100
  let fit = 30 + Math.min(top.score * 12, 36);
  if (urgency.length) fit += 10;
  if (money.length) fit += 8;
  if (dates.length) fit += 6;
  fit -= risks.length * 12;
  if (text.length > 400) fit += 6;
  fit = Math.max(5, Math.min(96, fit));
  const verdict = fit >= 70 ? 'strong' : fit >= 45 ? 'promising' : 'caution';
  return { top, second: scores[1]?.score > 0 ? scores[1] : null, urgency, risks, dates, money, emails, phones, fit, verdict };
}

const SAMPLE = `Hi, my name is Karen Doyle. I was rear-ended on I-90 last month (June 14) by a delivery van while stopped at a light. I went to the hospital with whiplash and a fractured wrist and I've missed three weeks of work so far — my employer is getting impatient. The van driver's insurance company called me yesterday offering $8,500 to settle and they want an answer this week. That feels low — my medical bills alone are already $11,200 and my physical therapist says I need at least two more months. I have the police report, photos of both cars, and the adjuster's voicemail. I've never hired a lawyer before. My number is (312) 555-0184, email karen.doyle@example.com. Can someone tell me if I have a case before I sign anything?`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CSS = `
:root{--bg:#faf9f6;--panel:#fff;--line:#e5e1d8;--ink:#221f1a;--dim:#6f6a5e;--navy:#1f3a5f;--gold:#a8842c;--gold-soft:#f7efdc;--green:#2e7d54;--green-soft:#e5f3ec;--red:#b3402e;--red-soft:#f9e6e2;--amber:#b7791f;--amber-soft:#fbf1dc;--font:"Avenir Next","Segoe UI",-apple-system,Helvetica,Arial,sans-serif;--serif:Georgia,"Times New Roman",serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);line-height:1.55}
a{color:var(--navy);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:960px;margin:0 auto;padding:0 22px}
nav{background:var(--navy);color:#fff}nav .wrap{display:flex;align-items:center;gap:22px;height:60px}
.logo{font-weight:700;font-size:1.2rem;color:#fff;display:flex;align-items:center;gap:10px;font-family:var(--serif)}.logo:hover{text-decoration:none}
.mark{width:26px;height:26px;border-radius:5px;background:var(--gold);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:.85rem;font-family:var(--font)}
nav a.nl{color:#c9d4e4}.spacer{flex:1}
.btn{display:inline-block;background:var(--gold);color:#fff;font-weight:700;padding:10px 18px;border-radius:6px;border:none;font-size:.95rem;cursor:pointer;font-family:var(--font)}
.btn:hover{filter:brightness(1.08);text-decoration:none}.btn.ghost{background:transparent;border:1.5px solid var(--line);color:var(--ink)}nav .btn.ghost{color:#fff;border-color:#3f5a82}.btn.small{padding:6px 12px;font-size:.85rem}
.hero{background:linear-gradient(165deg,var(--navy),#2c4f80 140%);color:#fff;padding:74px 0 64px}
.hero h1{font-family:var(--serif);font-size:2.75rem;line-height:1.13;margin:0 0 16px;max-width:660px}
.hero h1 em{font-style:italic;color:#e9c46a}
.hero p{color:#c9d4e4;font-size:1.13rem;max-width:600px;margin:0 0 26px}
.statrow{display:flex;gap:40px;flex-wrap:wrap;margin-top:36px}.statrow b{display:block;font-size:1.6rem;color:#e9c46a}.statrow span{color:#c9d4e4;font-size:.88rem}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:24px;margin-top:18px}.panel h3{margin-top:0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-top:26px}
.kicker{text-transform:uppercase;letter-spacing:.12em;font-size:.75rem;font-weight:700;color:var(--gold);margin:40px 0 6px}
h2.t{font-family:var(--serif);font-size:1.8rem;margin:0 0 10px}
textarea,input{width:100%;padding:11px 13px;border:1.5px solid var(--line);border-radius:8px;font-size:.95rem;font-family:var(--font);background:#fff;color:var(--ink)}
textarea{min-height:190px;resize:vertical}textarea:focus,input:focus{outline:none;border-color:var(--gold)}
.tag{display:inline-block;padding:2px 10px;border-radius:99px;font-size:.76rem;font-weight:700;margin:2px 3px 2px 0}
.tag.gold{background:var(--gold-soft);color:var(--gold)}.tag.green{background:var(--green-soft);color:var(--green)}.tag.red{background:var(--red-soft);color:var(--red)}.tag.amber{background:var(--amber-soft);color:var(--amber)}.tag.dim{background:#efece4;color:var(--dim)}
.score{font-size:2.6rem;font-weight:800}
.meter{height:10px;background:#efece4;border-radius:99px;overflow:hidden;max-width:340px}.meter i{display:block;height:100%}
pre.doc{background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:18px;white-space:pre-wrap;font-family:var(--font);font-size:.9rem;line-height:1.6}
.kv{display:grid;grid-template-columns:170px 1fr;gap:7px 16px;font-size:.93rem}.kv dt{color:var(--dim)}.kv dd{margin:0}
.footer{color:var(--dim);font-size:.85rem;border-top:1px solid var(--line);margin-top:70px;padding:30px 0}
@media(max-width:640px){.hero h1{font-size:2.1rem}.kv{grid-template-columns:1fr}}`;
const page = (title, body) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="description" content="IntakeIQ — paste any client inquiry, get a structured intake memo: practice area, urgency, deadlines, red flags, fit score, and a drafted reply. Built for solo and small law firms.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='5' fill='%231f3a5f'/><path d='M12 4l7 3v2H5V7l7-3zM6 10h2v7H6zm5 0h2v7h-2zm5 0h2v7h-2zM5 18h14v2H5z' fill='%23e9c46a'/></svg>">
<style>${CSS}</style></head><body>
<nav><div class="wrap"><a class="logo" href="/"><span class="mark">IQ</span>IntakeIQ</a>
<div class="spacer"></div><a class="nl" href="/whitepaper">Whitepaper</a><a class="btn small" href="/#try">Triage an inquiry</a></div></nav>
${body}
<div class="footer"><div class="wrap"><b style="color:var(--ink)">IntakeIQ</b> — every inquiry, triaged before your coffee cools. Demo deployment: analysis is illustrative, not legal advice; no inquiries are stored.</div></div></body></html>`;

const app = express();
app.use(express.urlencoded({ extended: true, limit: '200kb' }));

app.get('/', (req, res) => {
  const prefill = req.query.demo ? SAMPLE : '';
  res.send(page('IntakeIQ — client intake triage for small law firms', `
<div class="hero"><div class="wrap">
<h1>Every inquiry answered like your <em>best paralegal</em> read it first.</h1>
<p>Solo and small firms lose winnable matters to whoever responds first — while intake email piles up. Paste any inquiry into IntakeIQ and get an instant structured memo: practice area, urgency, deadlines, red flags, a fit score, and a ready-to-send reply.</p>
<a class="btn" href="#try">Triage an inquiry now</a> &nbsp; <a class="btn ghost" href="/?demo=1#try" style="color:#fff">Load a sample inquiry</a>
<div class="statrow">
<div><b>42%</b><span>of firms take 3+ days to reply to new leads (industry surveys)</span></div>
<div><b>#1</b><span>factor in client choice: response speed</span></div>
<div><b>0</b><span>inquiries stored by this demo — paste freely</span></div>
</div></div></div>
<div class="wrap">
<div class="kicker" id="try">Try it</div><h2 class="t">Paste the inquiry, exactly as it arrived</h2>
<div class="panel">
<form method="post" action="/triage">
<textarea name="inquiry" required minlength="40" placeholder="Paste the email, web-form message, or call transcript here…">${esc(prefill)}</textarea>
<div style="display:flex;gap:12px;align-items:center;margin-top:12px;flex-wrap:wrap">
<button class="btn">Triage this inquiry</button>
<span style="color:var(--dim);font-size:.85rem">Nothing is saved. Demo uses IntakeIQ's deterministic triage engine; production adds your firm's LLM key for deeper drafting.</span></div>
</form></div>
<div class="kicker">What you get</div><h2 class="t">From inbox chaos to a decision in seconds</h2>
<div class="grid">
<div class="panel"><h3>Classification & fit</h3><p style="color:var(--dim)">Practice area, matter value signals, and a 0–100 fit score tuned to what your firm actually takes.</p></div>
<div class="panel"><h3>Deadlines & red flags</h3><p style="color:var(--dim)">Dates, amounts, urgency markers, and caution signals (serial firm-switchers, fee resistance) extracted automatically.</p></div>
<div class="panel"><h3>Reply, drafted</h3><p style="color:var(--dim)">A professional first-response email ready to personalize and send — because speed wins engagements.</p></div>
</div></div>`));
});

app.post('/triage', (req, res) => {
  const text = (req.body.inquiry || '').slice(0, 20000);
  if (text.trim().length < 40) return res.redirect('/');
  const a = analyze(text);
  const color = a.verdict === 'strong' ? 'var(--green)' : a.verdict === 'promising' ? 'var(--amber)' : 'var(--red)';
  const reply = `Subject: Re: your ${a.top.label.toLowerCase()} inquiry

Dear [Name],

Thank you for reaching out — I've reviewed the details you shared${a.dates.length ? `, including the timeline around ${a.dates[0]}` : ''}. Matters like this are time-sensitive${a.urgency.length ? ` (you mentioned ${a.urgency[0]}), and preserving your position may require action soon` : ''}, so I'd like to schedule a brief consultation this week.

From what you've described, this appears to fall within our ${a.top.label.toLowerCase()} practice. On that call we'll cover: (1) the key facts and documents${a.money.length ? `, including the amounts you mentioned (${a.money.join(', ')})` : ''}; (2) applicable deadlines; and (3) how our engagement and fees work.

Please reply with two times that suit you, or book directly at [scheduling link]. Until we sign an engagement letter, please don't sign anything from an insurer or opposing party without advice.

Kind regards,
[Attorney name]
[Firm] · [Phone]`;
  res.send(page('Triage result · IntakeIQ', `
<div class="wrap" style="padding-top:36px;max-width:820px">
<div class="kicker"><a href="/">← Triage another</a></div>
<h2 class="t">Intake memo</h2>
<div class="panel">
<div style="display:flex;gap:30px;align-items:center;flex-wrap:wrap">
<div><div class="score" style="color:${color}">${a.fit}<span style="font-size:1.1rem;color:var(--dim)">/100</span></div>
<div class="meter"><i style="width:${a.fit}%;background:${color}"></i></div>
<div style="margin-top:6px"><span class="tag ${a.verdict === 'strong' ? 'green' : a.verdict === 'promising' ? 'amber' : 'red'}">${a.verdict === 'strong' ? 'Strong fit — respond now' : a.verdict === 'promising' ? 'Promising — worth a consult' : 'Caution — screen carefully'}</span></div></div>
<dl class="kv" style="flex:1;min-width:260px">
<dt>Practice area</dt><dd><b>${a.top.label}</b>${a.second ? ` <span style="color:var(--dim)">(also ${a.second.label})</span>` : ''}</dd>
<dt>Signals matched</dt><dd>${a.top.hits.length ? a.top.hits.map(h => `<span class="tag gold">${esc(h)}</span>`).join('') : '<span style="color:var(--dim)">none strong</span>'}</dd>
<dt>Urgency markers</dt><dd>${a.urgency.length ? a.urgency.map(h => `<span class="tag amber">${esc(h)}</span>`).join('') : '<span style="color:var(--dim)">none detected</span>'}</dd>
<dt>Dates found</dt><dd>${a.dates.length ? a.dates.map(h => `<span class="tag dim">${esc(h)}</span>`).join('') : '<span style="color:var(--dim)">—</span>'}</dd>
<dt>Amounts found</dt><dd>${a.money.length ? a.money.map(h => `<span class="tag dim">${esc(h)}</span>`).join('') : '<span style="color:var(--dim)">—</span>'}</dd>
<dt>Contact captured</dt><dd>${[...a.emails, ...a.phones].map(h => `<span class="tag dim">${esc(h)}</span>`).join('') || '<span style="color:var(--dim)">—</span>'}</dd>
<dt>Red flags</dt><dd>${a.risks.length ? a.risks.map(h => `<span class="tag red">${esc(h)}</span>`).join('') : '<span class="tag green">none detected</span>'}</dd>
</dl></div></div>
<div class="panel"><h3>Suggested next steps</h3>
<ol style="color:var(--dim);margin:0;padding-left:20px;line-height:1.9">
<li>Run a conflict check on the parties named${a.emails.length ? ` (${esc(a.emails[0])})` : ''}.</li>
<li>${a.urgency.length ? `Calendar the urgent item (“${esc(a.urgency[0])}”) before anything else.` : 'Confirm no limitation deadline is imminent.'}</li>
<li>Send the drafted reply below within the hour — response speed is the #1 driver of engagement.</li>
<li>${a.verdict === 'caution' ? 'Screen the red-flag items on a short call before quoting fees.' : 'Prepare the engagement letter for your ' + a.top.label.toLowerCase() + ' template.'}</li>
</ol></div>
<div class="panel"><h3>Drafted first response</h3><pre class="doc">${esc(reply)}</pre></div>
</div>`));
});

const WHITEPAPER = `INTAKEIQ — WHITEPAPER
Client-intake triage for the firms that answer their own phones · July 2026

THE PROBLEM
For solo and small law firms, the inbox is the pipeline — and it's on fire. Industry studies consistently show a large share of firms take days to respond to new client inquiries, while consumer research puts response speed as the top factor in which lawyer gets hired. Clio's 2026 solo & small-firm report finds small firms lagging larger peers in converting AI into revenue: they've bought drafting tools, but the leak is upstream, at intake. Every unread inquiry is a matter won by the firm across the street.
Reading intake is real work: classifying the practice area, spotting deadlines and limitation periods, extracting contacts and amounts, screening red-flag clients, and writing a competent first reply. At 20–50 inquiries a week, it's a part-time job most small firms give to nobody.

THE SOLUTION
IntakeIQ does the first read. Paste (or auto-forward) any inquiry and get a structured intake memo in seconds: practice-area classification with matched signals; a 0–100 fit score; urgency markers, dates, and dollar amounts extracted; contact details captured; red-flag screening (serial firm-switchers, fee resistance); recommended next steps including conflict check; and a professional first-response email drafted for the matter type. The live demo runs IntakeIQ's deterministic triage engine and stores nothing; production connects the firm's LLM key for deeper drafting, integrates with email/web forms, and syncs to Clio/practice-management tools.

WHY NOW
Small firms adopted AI for documents in 2024-25; 2026 is the year the intake funnel becomes the differentiator as consumer legal shopping moves fully online. LLM costs make per-inquiry analysis effectively free. And unlike drafting, intake triage doesn't touch work product — adoption friction is near zero.

MARKET
~450,000 US law firms; roughly three-quarters are 1–5 lawyers. At $79–$199/mo, US small-firm intake alone is a $400M+ ARR opportunity, expanding to accountants, therapists, contractors — any professional-services intake funnel.

BUSINESS MODEL
$79/mo (manual paste + email forward), $199/mo (web-form widget, auto-triage, practice-management sync). Product-led: the free tier triages 10 inquiries/mo.

SOURCES
- Clio 2026 solo & small-firm report: clio.com/about/press/2026-solo-small-firm-report/
- Clio: AI for small law firms: clio.com/blog/ai-for-small-law-firms/
- NC Bar Association (May 2026): law-firm AI adoption surveys: ncbar.org/nc-lawyer/2026-05/by-the-numbers-what-surveys-show-about-law-firm-ai-adoption/`;

app.get('/whitepaper', (req, res) => res.send(page('Whitepaper · IntakeIQ', `<div class="wrap" style="padding-top:36px;max-width:760px"><div class="panel"><pre class="doc">${esc(WHITEPAPER)}</pre></div></div>`)));
app.use((req, res) => res.status(404).send(page('Not found', `<div class="wrap" style="padding-top:60px"><div class="panel">Page not found. <a href="/">Home</a></div></div>`)));

if (require.main === module) app.listen(process.env.PORT || 3012, () => console.log('IntakeIQ on :' + (process.env.PORT || 3012)));
module.exports = app;
