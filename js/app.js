// app.js — entry point

import * as store from './store.js';
import * as wizard from './wizard.js';
import { loadFromUrl } from './utils/url-state.js';

import { init as initStep1 } from './steps/step1-wishlist.js';
import { init as initStep2 } from './steps/step2-team.js';
import { init as initStep3 } from './steps/step3-breakdown.js';
import { init as initStep4 } from './steps/step4-priority.js';
import { init as initStep5 } from './steps/step5-timeline.js';
import { init as initStep6 } from './steps/step6-export.js';

function bootstrap() {
  // Check URL state first (shareable link restore)
  const urlState = loadFromUrl();
  if (urlState) {
    store.restoreFromObject(urlState);
  } else {
    store.load();
  }

  wizard.init();
  wizard.bindTabClicks();

  initStep1();
  initStep2();
  initStep3();
  initStep4();
  initStep5();
  initStep6();

  // Trigger initial render for current step
  document.dispatchEvent(new CustomEvent('stepchange', {
    detail: { step: store.getState().meta.currentStep || 1 }
  }));
}

document.addEventListener('DOMContentLoaded', bootstrap);
