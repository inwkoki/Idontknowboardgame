import { CARD_BY_ID, COLORS } from '../games/secret-rule/cards.js';

/** Build a card element. opts: { size: 'sm'|'md'|'lg', dim: bool, order: number } */
export function cardEl(id, opts = {}) {
  const c = CARD_BY_ID[id];
  const el = document.createElement('div');
  el.className = `card card-${c.color} card-${opts.size || 'md'}${opts.dim ? ' card-dim' : ''}`;
  el.dataset.id = id;
  el.innerHTML = `
    <span class="card-n">${c.n}</span>
    <span class="card-mark">${COLORS[c.color].mark}</span>
    <span class="card-emoji">${c.emoji}</span>
    <span class="card-name">${c.nameTh}</span>
    ${opts.order ? `<span class="card-order">${opts.order}</span>` : ''}`;
  return el;
}
