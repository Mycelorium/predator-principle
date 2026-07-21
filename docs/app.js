const state = { language: 'en', filter: 'all', claims: [], sources: [], published: [] };

const sourceMap = () => new Map(state.sources.map((source) => [source.id, source]));

function applyLanguage() {
  document.documentElement.lang = 'en';
  document.querySelectorAll('[data-en]').forEach((node) => {
    if (node.dataset.en != null) node.textContent = node.dataset.en;
  });
  renderClaims();
  renderDispatches();
}

function renderClaims() {
  const root = document.getElementById('claims');
  if (!root || !state.claims.length) return;
  const sources = sourceMap();
  const visible = state.claims.filter((claim) => state.filter === 'all' || claim.class === state.filter);
  root.innerHTML = visible.map((claim) => {
    const links = claim.sources.map((id) => {
      const source = sources.get(id);
      return source ? `<a href="${source.url}" target="_blank" rel="noopener">${id}</a>` : id;
    }).join('');
    return `<article class="claim" data-class="${claim.class}">
      <div class="claim-meta"><span class="claim-class">${claim.class}</span><span>${claim.id} · ${claim.status}</span></div>
      <h3>${claim.title_en}</h3>
      <p>${claim.claim_en}</p>
      <details>
        <summary>Boundaries and falsification</summary>
        <p><strong>Boundary:</strong> ${claim.boundary_en}</p>
        <p><strong>Falsified/weakened if:</strong> ${claim.falsifier_en}</p>
        ${links ? `<p class="source-links"><strong>Sources:</strong> ${links}</p>` : ''}
      </details>
    </article>`;
  }).join('');
}

function renderDispatches() {
  const root = document.getElementById('latest-dispatches');
  if (!root || !state.published.length) return;
  root.innerHTML = state.published.slice(0, 3).map((item) => `<article class="dispatch-card">
    <div class="claim-meta"><span class="claim-class">${item.class}</span><span>NO. ${String(item.sequence).padStart(2, '0')} · ${item.claim_ids.join(', ')}</span></div>
    <h3><a href="posts/${item.id}.html">${item.title_en}</a></h3>
    <p>${item.hook_en}</p>
    <p class="dispatch-boundary"><strong>Boundary:</strong> ${item.boundary_en}</p>
  </article>`).join('');
}

document.querySelectorAll('.filter').forEach((button) => {
  button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('active', item === button));
    renderClaims();
  });
});

Promise.all([
  fetch('data/claims.json').then((response) => response.json()),
  fetch('data/sources.json').then((response) => response.json()),
  fetch('data/published.json').then((response) => response.json())
]).then(([claims, sources, published]) => {
  state.claims = claims;
  state.sources = sources;
  state.published = published;
  applyLanguage();
}).catch(() => {
  const c = document.getElementById('claims');
  if (c) c.innerHTML = '<p>Claim register could not be loaded.</p>';
});
