const CAT_COLORS = {
  beef: '#913b3b',
  breakfast: 'var(--cat-breakfast)',
  chicken: '#d97d3a',
  dessert: 'var(--cat-dessert)',
  goat: '#8b5a45',
  lamb: '#7a3e48',
  miscellaneous: '#7b8772',
  pasta: '#d4a353',
  pork: '#ba6d66',
  seafood: '#52828d',
  side: '#8c9c61',
  starter: '#cf7357',
  vegan: '#467a54',
  vegetarian: '#629e71',
  lunch: 'var(--cat-lunch)',
  dinner: 'var(--cat-dinner)',
};

const DEFAULT_TIME_BY_CATEGORY = {
  breakfast: '20 min',
  lunch: '25 min',
  dinner: '35 min',
  dessert: '45 min',
};

export const BOOKMARK_OUT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
export const BOOKMARK_IN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;

export function catColor(cat) { 
  if (!cat) return 'var(--ink-3)';
  return CAT_COLORS[cat.toLowerCase()] || 'var(--ink-3)'; 
}

export function inferDifficulty(recipe) {
  const count = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0;
  if (count <= 6) return 'Easy';
  if (count <= 8) return 'Medium';
  return 'Hard';
}

export function getRecipeMeta(recipe) {
  const servings = Number.isFinite(recipe.servings) ? recipe.servings : 2;
  const difficulty = recipe.difficulty || inferDifficulty(recipe);
  const totalTime = recipe.totalTime || DEFAULT_TIME_BY_CATEGORY[recipe.category] || '30 min';
  return { servings, difficulty, totalTime };
}

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case '\'': return '&#39;';
      default: return ch;
    }
  });
}

export function formatInstructions(text) {
  if (text == null) return '';
  const timeRegex = /(\d+)\s*(min|minute|hr|hour)s?/gi;
  let result = '';
  let lastIndex = 0;
  let match;
  while ((match = timeRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const num = match[1];
    const unit = match[2];
    const before = text.slice(lastIndex, match.index);
    result += escapeHtml(before);
    const safeLabel = escapeHtml(fullMatch);
    result += `<button type="button" class="timer-btn" data-time="${String(num)}" data-unit="${String(unit)}">${safeLabel}</button>`;
    lastIndex = match.index + fullMatch.length;
  }
  result += escapeHtml(text.slice(lastIndex));
  return result.replace(/\n/g, '<br>');
}

export function parseIngredient(text) {
  const match = text.match(/^((?:\d+(?:\s+\d+\/\d+|\.\d+)?|\d*\/\d+))\s+(.*)$/);
  if (!match) return null;

  let amountStr = match[1];
  let amount = 0;

  if (amountStr.includes(' ')) {
    const parts = amountStr.split(' ');
    const fractionParts = parts[1].split('/');
    const fraction = parseFloat(fractionParts[0]) / parseFloat(fractionParts[1]);
    amount = parseFloat(parts[0]) + fraction;
  } else if (amountStr.includes('/')) {
    const fractionParts = amountStr.split('/');
    amount = parseFloat(fractionParts[0]) / parseFloat(fractionParts[1]);
  } else {
    amount = parseFloat(amountStr);
  }

  return { amount, rest: match[2] };
}

export function formatAmount(num) {
  if (Number.isInteger(num)) return num;

  const decimal = num % 1;
  const whole = Math.floor(num);

  if (Math.abs(decimal - 0.5) < 0.01) return whole ? `${whole} 1/2` : '1/2';
  if (Math.abs(decimal - 0.25) < 0.01) return whole ? `${whole} 1/4` : '1/4';
  if (Math.abs(decimal - 0.75) < 0.01) return whole ? `${whole} 3/4` : '3/4';
  if (Math.abs(decimal - 0.33) < 0.01) return whole ? `${whole} 1/3` : '1/3';
  if (Math.abs(decimal - 0.66) < 0.01) return whole ? `${whole} 2/3` : '2/3';

  return Number(num.toFixed(2));
}



export function triggerExplosion(x, y) {
  const particles = 12;
  for (let i = 0; i < particles; i++) {
    const p = document.createElement('div');
    p.classList.add('particle');
    document.body.appendChild(p);

    const angle = (i / particles) * 2 * Math.PI;
    const velocity = 40 + Math.random() * 40;
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity;

    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty('--tx', `${tx}px`);
    p.style.setProperty('--ty', `${ty}px`);
    p.style.background = Math.random() > 0.5 ? 'var(--accent)' : 'var(--cat-dessert)';

    p.addEventListener('animationend', () => p.remove());
  }
}

let audioCtx = null;
export function playDing() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume context if suspended (common in browsers until user interaction)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    osc.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch(e) {}
}

const focusReturnStack = [];
export function rememberFocus() {
  const active = document.activeElement;
  focusReturnStack.push(active instanceof HTMLElement ? active : null);
}

export function restoreFocus() {
  const previous = focusReturnStack.pop();
  if (previous && previous.isConnected) previous.focus();
}

export function syncBodyScrollLock() {
  const hasOpenLayer =
    !document.getElementById('overlay').classList.contains('hidden') ||
    !document.getElementById('fav-sheet').classList.contains('hidden') ||
    !document.getElementById('contact-sheet').classList.contains('hidden') ||
    !document.getElementById('cart-sheet').classList.contains('hidden') ||
    !document.getElementById('cooking-mode-overlay').classList.contains('hidden') ||
    !document.getElementById('mobile-menu').classList.contains('hidden');
  document.body.style.overflow = hasOpenLayer ? 'hidden' : '';
}

export function focusFirstElement(container) {
  if (!container) return;
  const focusables = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusables.length) {
    focusables[0].focus();
  } else {
    container.focus();
  }
}

export function trapFocus(event, container) {
  if (event.key !== 'Tab' || !container || container.classList.contains('hidden')) return;
  const focusables = Array.from(container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
  if (!focusables.length) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
