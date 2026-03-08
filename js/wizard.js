// wizard.js — step navigation, progress bar, guards

import * as store from './store.js';

const TOTAL_STEPS = 6;
const STEP_NAMES = ['Wish List', 'Team Setup', 'Breakdown', 'Prioritize', 'Timeline', 'Export'];

let currentStep = 1;
const guards = {}; // stepNumber -> () => bool

export function registerGuard(step, fn) {
  guards[step] = fn;
}

export function init() {
  currentStep = store.getState().meta.currentStep || 1;
  _render();

  document.getElementById('btn-next').addEventListener('click', () => {
    if (canProceed()) goTo(currentStep + 1);
  });
  document.getElementById('btn-back').addEventListener('click', () => {
    goTo(currentStep - 1);
  });
}

export function goTo(n) {
  if (n < 1 || n > TOTAL_STEPS) return;
  // allow going back freely; going forward requires guard
  if (n > currentStep) {
    for (let s = currentStep; s < n; s++) {
      if (guards[s] && !guards[s]()) return;
    }
  }
  currentStep = n;
  store.setCurrentStep(n);
  _render();
}

export function current() { return currentStep; }

function canProceed() {
  if (guards[currentStep]) return guards[currentStep]();
  return true;
}

function _render() {
  // Show/hide step panels
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const el = document.getElementById(`step-${i}`);
    if (el) el.classList.toggle('active', i === currentStep);
  }

  // Progress tabs
  const tabs = document.querySelectorAll('.wiz-tab');
  tabs.forEach(tab => {
    const n = parseInt(tab.dataset.step, 10);
    tab.classList.toggle('done', n < currentStep);
    tab.classList.toggle('active', n === currentStep);
    tab.classList.toggle('future', n > currentStep);
  });

  // Buttons
  document.getElementById('btn-back').disabled = currentStep === 1;
  const nextBtn = document.getElementById('btn-next');
  if (currentStep === TOTAL_STEPS) {
    nextBtn.textContent = 'Finish';
    nextBtn.disabled = true;
  } else {
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = false;
  }

  // Quarter label in header
  const ql = store.getState().meta.quarterLabel;
  const qlEl = document.getElementById('quarter-label');
  if (qlEl) qlEl.textContent = ql ? `— ${ql}` : '';

  // Dispatch event so step modules can re-render if needed
  document.dispatchEvent(new CustomEvent('stepchange', { detail: { step: currentStep } }));
}

// Allow clicking tabs to navigate back
export function bindTabClicks() {
  document.querySelectorAll('.wiz-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const n = parseInt(tab.dataset.step, 10);
      if (n < currentStep) goTo(n);
    });
  });
}
