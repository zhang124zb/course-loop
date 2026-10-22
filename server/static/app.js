'use strict';

const menuButton = document.querySelector('[data-menu-toggle]');
const sidebar = document.querySelector('#sidebar');
if (menuButton && sidebar) {
  menuButton.addEventListener('click', () => {
    const expanded = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!expanded));
    menuButton.setAttribute('aria-label', expanded ? '展开导航' : '收起导航');
    sidebar.classList.toggle('is-open', !expanded);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      sidebar.classList.remove('is-open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', '展开导航');
    }
  });
}

document.querySelectorAll('form[data-submit-lock]').forEach(form => {
  form.addEventListener('submit', event => {
    if (form.dataset.submitting === 'true') {
      event.preventDefault();
      return;
    }
    if (!form.checkValidity()) return;
    form.dataset.submitting = 'true';
    form.setAttribute('aria-busy', 'true');
    const button = event.submitter || form.querySelector('button[type="submit"]');
    if (button) {
      button.dataset.originalLabel = button.textContent;
      button.textContent = button.dataset.loadingLabel || '正在处理…';
      // Keep the successful submitter enabled until the browser builds the POST.
      requestAnimationFrame(() => { button.disabled = true; });
    }
  });
});

window.addEventListener('pageshow', () => {
  document.querySelectorAll('form[data-submit-lock]').forEach(form => {
    delete form.dataset.submitting;
    form.removeAttribute('aria-busy');
    form.querySelectorAll('button[data-original-label]').forEach(button => {
      button.textContent = button.dataset.originalLabel;
      button.disabled = false;
    });
  });
});

const fillFixture = document.querySelector('[data-fill-fixture]');
if (fillFixture) {
  fillFixture.addEventListener('click', () => {
    const selected = document.querySelector('#fixture-select')?.value;
    const fixture = Array.from(document.querySelectorAll('[data-fixture-source]'))
      .find(element => element.dataset.fixtureSource === selected);
    const editor = document.querySelector('textarea[name="source"]');
    if (!fixture || !editor) return;
    editor.value = fixture.value;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.focus();
  });
}
