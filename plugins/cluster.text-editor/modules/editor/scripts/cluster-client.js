/* Cluster-v3 public Router bridge. No Host imports or direct frame access. */
(() => {
  'use strict';
  const protocol = 'cluster.plugin.v1';
  const pending = new Map();
  const handlers = new Map();
  let sequence = 0;
  const request = (method, ...args) => new Promise((resolve, reject) => {
    const requestId = 'editor-api-' + (++sequence);
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error('Host request timeout: ' + method));
    }, 12000);
    pending.set(requestId, { resolve, timer });
    parent.postMessage({ protocol, type: 'request', requestId, method, args }, '*');
  });
  window.addEventListener('message', async event => {
    if (event.source !== parent || event.data?.protocol !== protocol) return;
    const message = event.data;
    if (message.type === 'response') {
      const entry = pending.get(message.requestId);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.delete(message.requestId);
      entry.resolve(message);
    } else if (message.type === 'invoke') {
      const fn = handlers.get(message.action);
      try {
        if (!fn) throw new Error('Unregistered action: ' + message.action);
        const data = await fn(message.payload, message.trace);
        parent.postMessage({ protocol, type: 'invoke-result',
          requestId: message.requestId, ok: true, data }, '*');
      } catch (error) {
        parent.postMessage({ protocol, type: 'invoke-result',
          requestId: message.requestId, ok: false,
          error: { code: error.code || 'EDITOR_REQUEST_FAILED',
            message: String(error.message || error) } }, '*');
      }
    }
  });
  window.Cluster = Object.freeze({
    request,
    Router: Object.freeze({
      async register(action, handler, options = {}) {
        const result = await request('Router.register', action, 'runtime-callback', options);
        if (result.ok) handlers.set(action, handler);
        return result;
      },
      async unregister(action) {
        const result = await request('Router.unregister', action);
        if (result.ok) handlers.delete(action);
        return result;
      }
    })
  });
  parent.postMessage({ protocol, type: 'hello' }, '*');
})();
