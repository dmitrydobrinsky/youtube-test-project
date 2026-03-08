// modal.js — generic modal/dialog

let _overlay, _box, _resolveClose;

function _ensureDOM() {
  if (_overlay) return;
  _overlay = document.getElementById('modal-overlay');
  _box = document.getElementById('modal-box');
  document.getElementById('modal-close-btn').addEventListener('click', close);
  _overlay.addEventListener('click', e => { if (e.target === _overlay) close(); });
}

export function open({ title = '', html = '', onClose = null } = {}) {
  _ensureDOM();
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = html;
  _overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  _resolveClose = onClose;
}

export function close(result) {
  _ensureDOM();
  _overlay.classList.remove('active');
  document.body.style.overflow = '';
  if (typeof _resolveClose === 'function') _resolveClose(result);
  _resolveClose = null;
}

export function confirm(message) {
  return new Promise(resolve => {
    open({
      title: 'Confirm',
      html: `
        <p style="margin-bottom:1.5rem">${message}</p>
        <div style="display:flex;gap:1rem;justify-content:flex-end">
          <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
          <button class="btn btn-danger" id="modal-ok">Confirm</button>
        </div>`,
      onClose: r => resolve(r === true)
    });
    document.getElementById('modal-ok').addEventListener('click', () => close(true));
    document.getElementById('modal-cancel').addEventListener('click', () => close(false));
  });
}

export function prompt(title, label, defaultVal = '') {
  return new Promise(resolve => {
    open({
      title,
      html: `
        <label style="display:block;margin-bottom:.5rem">${label}</label>
        <input id="modal-input" class="form-input" value="${defaultVal}" style="width:100%;margin-bottom:1rem">
        <div style="display:flex;gap:1rem;justify-content:flex-end">
          <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="modal-ok">OK</button>
        </div>`,
      onClose: r => resolve(r)
    });
    const inp = document.getElementById('modal-input');
    inp.focus(); inp.select();
    document.getElementById('modal-ok').addEventListener('click', () => close(inp.value));
    document.getElementById('modal-cancel').addEventListener('click', () => close(null));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') close(inp.value); });
  });
}
