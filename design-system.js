/* Reference-page behavior only. No AI requests or external writes. */
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let toastTimer;
function announce(message) {
  $('#toast').textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').textContent = ''; }, 5000);
}
function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#theme').setAttribute('aria-pressed', String(dark));
  $('#theme').textContent = dark ? 'Light appearance' : 'Dark appearance';
}
let storedTheme;
try { storedTheme = localStorage.getItem('alfred-theme'); } catch { /* Storage is optional. */ }
setTheme(storedTheme ? storedTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
$('#theme').addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme !== 'dark');
  try { localStorage.setItem('alfred-theme', document.documentElement.dataset.theme); } catch { /* Session appearance still works. */ }
});
function searchNav() {
  const query = $('#search').value.trim().toLowerCase();
  const links = $$('.side nav a');
  links.forEach(link => { link.hidden = !(`${link.textContent} ${link.dataset.keywords}`.toLowerCase().includes(query)); });
  const count = links.filter(link => !link.hidden).length;
  $('#searchStatus').textContent = !query ? 'All sections' : count ? `${count} matching section${count === 1 ? '' : 's'}` : 'No matching section. Clear search to browse.';
}
$('#search').addEventListener('input', searchNav);
$('#clearSearch').addEventListener('click', () => { $('#search').value = ''; searchNav(); $('#search').focus(); });
const navigation = $('.navigation');
if (matchMedia('(max-width: 52rem)').matches) navigation.open = false;
navigation.addEventListener('keydown', event => {
  if (event.key === 'Escape' && navigation.open) { navigation.open = false; navigation.querySelector('summary').focus(); }
});
$$('.side nav a').forEach(link => link.addEventListener('click', () => {
  $$('.side nav a').forEach(other => other.removeAttribute('aria-current'));
  link.setAttribute('aria-current', 'location');
}));
const tabs = $$('[role="tab"]');
function selectTab(tab) {
  tabs.forEach(other => {
    const active = other === tab;
    other.setAttribute('aria-selected', String(active));
    other.tabIndex = active ? 0 : -1;
    document.getElementById(other.dataset.tab).hidden = !active;
  });
}
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus(); selectTab(tabs[next]);
  });
});
const samples = {
  work: ['Help me make this opening clearer.', 'Start with what changed and what the reader needs to do. Put the background after that. I can help reshape the first paragraph.'],
  decision: ['Should I add the new feature before agreeing the scope?', 'First establish whether it changes the cost or delivery date. If it does, settle the scope with the client before building.'],
  personal: ['I would like a quiet evening without much planning.', 'Keep it easy: a simple meal and something familiar to read or watch. The rest can wait.']
};
$('#situation').addEventListener('change', event => {
  const [question, reply] = samples[event.target.value];
  $('#sampleQuestion').textContent = question; $('#sampleReply').textContent = reply;
});
let clearedDraft = '';
$('#clearDraft').addEventListener('click', () => {
  if ($('#clearDraft').dataset.undo === 'true') {
    $('#sampleDraft').value = clearedDraft; $('#clearDraft').textContent = 'Clear draft'; $('#clearDraft').dataset.undo = 'false'; announce('Local draft restored.');
  } else {
    clearedDraft = $('#sampleDraft').value;
    if (!clearedDraft) { announce('The draft is already empty.'); return; }
    $('#sampleDraft').value = ''; $('#clearDraft').textContent = 'Undo clear'; $('#clearDraft').dataset.undo = 'true'; announce('Draft cleared in this page. Use Undo clear to restore it.');
  }
});
$('#sampleDraft').addEventListener('input', () => { $('#clearDraft').textContent = 'Clear draft'; $('#clearDraft').dataset.undo = 'false'; });
let previousChoice = 'No choice selected.';
$('#choose').addEventListener('click', () => {
  previousChoice = $('#choiceStatus').textContent;
  $('#choiceStatus').textContent = `Demo choice: ${$('#choice').selectedOptions[0].textContent}. Held in this page only.`;
  $('#undoChoice').disabled = false;
});
$('#undoChoice').addEventListener('click', () => { $('#choiceStatus').textContent = previousChoice; $('#undoChoice').disabled = true; });
$('#readingWidth').addEventListener('click', () => {
  const wide = $('#reading').classList.toggle('wide');
  $('#readingWidth').setAttribute('aria-pressed', String(wide));
  $('#readingWidth').textContent = wide ? 'Focused reading view' : 'Wider reading view';
});
function renderButton() {
  const button = $('#playButton'), variant = $('#variant').value, state = $('#state').value;
  const labels = { default: 'Review evidence', disabled: 'Review evidence', loading: 'Loading example', error: 'Try again', success: 'Ready to review' };
  button.className = `button ${variant}`; button.dataset.state = state;
  button.disabled = ['disabled','loading'].includes(state);
  button.setAttribute('aria-busy', String(state === 'loading'));
  button.textContent = labels[state];
  $('#buttonCode').textContent = `<button class="button ${variant}" data-state="${state}"${button.disabled ? ' disabled' : ''}${state === 'loading' ? ' aria-busy="true"' : ''}>${labels[state]}</button>`;
  $('#buttonStatus').textContent = `${state[0].toUpperCase() + state.slice(1)} specimen. ${state === 'loading' ? 'No request is running.' : 'Use Tab to inspect keyboard focus.'}`;
}
$('#variant').addEventListener('change', renderButton); $('#state').addEventListener('change', renderButton);
$('#playButton').addEventListener('click', () => { $('#buttonStatus').textContent = 'Button activated. This is a component demonstration.'; });
function validateNote(submitted = false) {
  const ok = $('#reviewNote').value.trim().length > 0;
  $('#reviewNote').setAttribute('aria-invalid', String(!ok));
  $('#formStatus').classList.toggle('error', !ok);
  $('#formStatus').textContent = ok ? (submitted ? 'The example note passes validation. It has not been saved or sent.' : 'This note is ready for the example.') : 'Add a review note before continuing.';
  return ok;
}
$('#reviewNote').addEventListener('blur', () => validateNote());
$('#demoForm').addEventListener('submit', event => { event.preventDefault(); if (!validateNote(true)) $('#reviewNote').focus(); });
$$('[data-copy]').forEach(button => button.addEventListener('click', async () => {
  const source = document.getElementById(button.dataset.copy);
  try { await navigator.clipboard.writeText(source.textContent); announce('Example HTML copied.'); }
  catch {
    const range = document.createRange(); range.selectNodeContents(source);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); source.focus();
    announce('Text selected. Use your device’s Copy command.');
  }
}));
