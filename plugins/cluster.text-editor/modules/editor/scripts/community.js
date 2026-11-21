(() => {
  'use strict';
  window.addEventListener('message', event => {
    if (event.source !== parent) return;
    const data = event.data;
    if (!data || !['cluster.settings.context.v1','cluster.plugin.v1'].includes(data.protocol)) return;
    if (data.protocol === 'cluster.plugin.v1' && data.type !== 'context') return;
    for (const [key, value] of Object.entries(data.palette || {})) {
      if (/^#[0-9a-fA-F]{6}$/.test(value) && /^[a-zA-Z-]+$/.test(key))
        document.documentElement.style.setProperty('--ui-' + key, value);
    }
    if (typeof data.language === 'string') document.documentElement.lang = data.language;
  });
})();
