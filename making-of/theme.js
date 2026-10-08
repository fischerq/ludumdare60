// Light/dark theme toggle shared by the making-of and event pages. Light by default; the choice is
// remembered per browser. Load in <head> (not deferred) so the page never flashes the wrong theme.
(function () {
  const KEY = 'mini-gurke-theme';
  let theme = 'light';
  try { theme = localStorage.getItem(KEY) || 'light'; } catch (e) { /* storage blocked: stay light */ }
  document.documentElement.dataset.theme = theme;
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    const paint = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      btn.textContent = dark ? '☀' : '☾';
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    };
    btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(KEY, next); } catch (e) { /* not remembered, still switches */ }
      paint();
    });
    paint();
    document.body.append(btn);
  });
})();
