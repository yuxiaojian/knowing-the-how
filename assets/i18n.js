// Tiny English/Chinese switcher shared by every page.
//
// Markup:  data-i18n="key"                 → element's content
//          data-i18n-attr="aria-label:key"  → attributes (separate pairs with ;)
//          <html data-i18n-title="key">     → document title
//          <button class="lang-toggle">     → the switch itself
// Pages register strings with I18n.add({ en: {...}, zh: {...} }) and
// re-render dynamic text in I18n.onChange(fn).
(function (global) {
  const STORAGE_KEY = 'knowing-the-how:lang';
  const dicts = { en: {}, zh: {} };
  const listeners = [];

  let lang = 'en';
  try {
    lang = localStorage.getItem(STORAGE_KEY) || '';
  } catch (e) { /* storage blocked */ }
  if (lang !== 'en' && lang !== 'zh') {
    lang = (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  function add(strings) {
    for (const l of Object.keys(strings)) Object.assign(dicts[l] || (dicts[l] = {}), strings[l]);
  }

  function t(key, vars) {
    let s = dicts[lang][key] ?? dicts.en[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
    return s;
  }

  function apply(root = document) {
    const html = document.documentElement;
    html.lang = lang === 'zh' ? 'zh-CN' : 'en';
    root.querySelectorAll('[data-i18n]').forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      for (const pair of el.dataset.i18nAttr.split(';')) {
        const [attr, key] = pair.split(':').map((s) => s.trim());
        el.setAttribute(attr, t(key));
      }
    });
    if (html.dataset.i18nTitle) document.title = t(html.dataset.i18nTitle);
    document.querySelectorAll('.lang-toggle').forEach((btn) => {
      btn.textContent = lang === 'zh' ? 'EN' : '中文';
      btn.lang = lang === 'zh' ? 'en' : 'zh-CN';
      btn.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切换到中文');
    });
  }

  function set(next) {
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* storage blocked */ }
    apply();
    listeners.forEach((fn) => fn(lang));
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('.lang-toggle')) set(lang === 'zh' ? 'en' : 'zh');
  });

  global.I18n = {
    add, t, apply, set,
    onChange: (fn) => listeners.push(fn),
    get lang() { return lang; },
    get locale() { return lang === 'zh' ? 'zh-CN' : 'en-US'; },
  };
})(window);
