import * as qqntAdapter from "./renderer-qqnt-adapter.js";

// 设置页与渲染进程入口
function isDebugConfigEnabled() {
  try {
    const cfg = window.localEmote && window.localEmote.getConfig ? window.localEmote.getConfig() : null;
    return !!(cfg && cfg.debug);
  } catch (_) {
    return false;
  }
}

// --- LE main-world bridge injection (works under contextIsolation) ---
try {
  (function installLEMainWorldBridge() {
    if (window.__LE_BRIDGE_ATTEMPTED) return; // avoid duplicate
    window.__LE_BRIDGE_ATTEMPTED = true;
    const debugBridge = isDebugConfigEnabled();
    // 1) Inject a script into MAIN WORLD to expose proxy functions
    try {
      const s = document.createElement('script');
      s.id = 'le-main-bridge';
      s.textContent = `(() => {\n  try {\n    if (window.__LE_BRIDGE_INSTALLED) return;\n    window.__LE_BRIDGE_INSTALLED = true;\n    try {\n      if (${debugBridge ? "true" : "false"} && !window.__le_sel_patch) {\n        window.__le_sel_patch = true;\n        const __le_findEd = () => {\n          try {\n            const sels = ['[contenteditable=\"true\"]','div[role=\"textbox\"]','div[contenteditable=\"plaintext-only\"]','[contenteditable]','textarea','input[type=\"text\"]'];\n            for (const s of sels) {\n              const list = document.querySelectorAll(s);\n              for (const el of list) {\n                if (!el || el.offsetParent === null) continue;\n                if (el.closest('.two-col-layout__aside, .contact-top-bar, .main-search, .recent-contact, .lite-tools-vue-component .search')) continue;\n                return el;\n              }\n            }\n          } catch (_) {}\n          return null;\n        };\n        const __le_orig = Selection.prototype.getRangeAt;\n        Selection.prototype.getRangeAt = function(i) {\n          try {\n            if (this.rangeCount === 0) {\n              const ed = __le_findEd();\n              const r = document.createRange();\n              if (ed) r.selectNodeContents(ed); else r.selectNodeContents(document.body || document.documentElement);\n              r.collapse(false);\n              try { this.addRange(r); } catch (_) {}\n            }\n            return __le_orig.call(this, i || 0);\n          } catch (e) {\n            try {\n              const r = document.createRange();\n              r.selectNodeContents(document.body || document.documentElement);\n              r.collapse(false);\n              return r;\n            } catch (_) {}\n            throw e;\n          }\n        };\n      }\n    } catch (e) {}\n    const pending = new Map();\n    window.addEventListener('message', (e) => {\n      const d = e.data;\n      if (!d || d.__from !== 'le-isolated' || !d.id) return;\n      const p = pending.get(d.id);\n      if (!p) return;\n      pending.delete(d.id);\n      if (d.error) {\n        const err = new Error(d.error.message || 'LE bridge error');\n        err.name = d.error.name || err.name;\n        err.stack = d.error.stack || err.stack;\n        p.reject(err);\n      } else {\n        p.resolve(d.result);\n      }\n    }, false);\n    function send(type, payload) {\n      const id = Math.random().toString(36).slice(2);\n      return new Promise((resolve, reject) => {\n        pending.set(id, { resolve, reject });\n        window.postMessage({ __to: 'le-isolated', id, type, payload }, '*');\n      });\n    }\n    // Expose proxies in MAIN WORLD\n    window.le_sendMessage = function(peer, messages, opts) {\n      return send('sendMessage', { peer, messages, opts });\n    };\n    window.le_convertMessage = function(messages) {\n      return send('convertMessage', { messages });\n    };\n    window.derivePeer = function() {\n      return send('derivePeer', {});\n    };\n  } catch (e) {\n    console.error('[local_emotes] main-world bridge install failed', e);\n  }\n})();`;
      document.documentElement.appendChild(s);
      s.remove();
    } catch (e) {
      console.error('[local_emotes] bridge script inject failed', e);
    }

    // 2) Install ISOLATED WORLD message handler to serve MAIN WORLD requests
    if (!window.__LE_ISOLATED_BRIDGE_INSTALLED) {
      window.__LE_ISOLATED_BRIDGE_INSTALLED = true;
      window.addEventListener('message', (e) => {
        const d = e.data;
        if (!d || d.__to !== 'le-isolated' || !d.id) return;
        (async () => {
          try {
            let result;
            if (d.type === 'sendMessage') {
              const { peer, messages, opts } = d.payload || {};
              result = await le_sendMessage(peer, messages, opts);
            } else if (d.type === 'convertMessage') {
              const { messages } = d.payload || {};
              result = await le_convertMessage(messages);
            } else if (d.type === 'derivePeer') {
              result = await derivePeerAsync();
            } else {
              throw new Error('Unknown bridge type: ' + d.type);
            }
            window.postMessage({ __from: 'le-isolated', id: d.id, result }, '*');
          } catch (err) {
            window.postMessage({ __from: 'le-isolated', id: d.id, error: { message: String((err && err.message) || err), name: err && err.name, stack: err && err.stack } }, '*');
          }
        })();
      }, false);
    }
  })();
} catch (e) {
  console.error('[local_emotes] installLEMainWorldBridge error', e);
}
// --- end LE main-world bridge injection ---
// --- LE main-world service injection (isolated -> main) ---
try {
  (function installLEMainWorldService() {
    try {
      const serviceDebug = isDebugConfigEnabled();
      const s2 = document.createElement('script');
      s2.id = 'le-main-service';
      s2.textContent = `(() => {
        try {
          if (window.__LE_MAIN_SERVICE_INSTALLED) return;
          window.__LE_MAIN_SERVICE_INSTALLED = true;
          const __le_peerFrom = (c) => {
            try {
              if (!c || typeof c !== 'object') return null;
              if (c.peer && c.peer.chatType && c.peer.peerUid) {
                let ct = Number(c.peer.chatType);
                let groupCode = c.peer.groupCode || c.groupCode || (c.header && c.header.groupCode) || '';
                let peerUid = String(c.peer.peerUid);
                if (groupCode && ct === 1) ct = 2;
                if (ct === 2) {
                  if (!groupCode && peerUid) groupCode = peerUid;
                  if (groupCode) peerUid = String(groupCode);
                }
                const peer = {
                  chatType: ct,
                  peerUid,
                  guildId: c.peer.guildId || c.peer.channelId || c.guildId || ''
                };
                if (ct === 2 && groupCode) peer.groupCode = String(groupCode);
                return peer;
              }
              const chatType = c.chatType || (c.peer && c.peer.chatType) || c.type || c.scene || c.category;
              let groupCode = c.groupCode || (c.header && c.header.groupCode) || (c.peer && c.peer.groupCode);
              let peerUid =
                (c.peer && c.peer.peerUid) ||
                c.peerUid ||
                c.groupCode ||
                c.groupId ||
                c.groupUin ||
                c.groupUid ||
                c.tinyId ||
                c.uin ||
                c.uinStr ||
                (c.header && (c.header.peerUid || c.header.groupCode || c.header.uid));
              let ct = Number(chatType);
              if (groupCode && ct === 1) ct = 2;
              if (ct === 2) {
                if (!groupCode && peerUid) groupCode = peerUid;
                if (groupCode) peerUid = groupCode;
              }
              if (Number.isFinite(ct) && peerUid) {
                const peer = { chatType: ct, peerUid: String(peerUid), guildId: c.guildId || c.channelId || (c.peer && (c.peer.guildId || c.peer.channelId)) || '' };
                if (ct === 2 && groupCode) peer.groupCode = String(groupCode);
                return peer;
              }
            } catch (_) {}
            return null;
          };
          const __le_ignoreProps = new Set([
            'dep',
            '__v_raw',
            '__v_skip',
            '_value',
            '__ob__',
            'prevDep',
            'nextDep',
            'prevSub',
            'nextSub',
            'deps',
            'subs',
            '__vueParentComponent',
            'parent',
            'provides'
          ]);
          const __le_ignorePropsLocal = new Set([
            'dep',
            '__v_raw',
            '__v_skip',
            '_value',
            '__ob__',
            'prevDep',
            'nextDep',
            'prevSub',
            'nextSub',
            'deps',
            'subs',
            '__vueParentComponent',
            'parent',
            'provides',
            'appContext',
            'config',
            'globalProperties'
          ]);
          const __le_findCurAioData = (root) => {
            try {
              if (!root || typeof root !== 'object') return null;
              const q = [root];
              const visited = new WeakSet();
              let head = 0;
              while (head < q.length && head < 6000) {
                const obj = q[head++];
                if (!obj || typeof obj !== 'object') continue;
                if (visited.has(obj)) continue;
                visited.add(obj);
                try {
                  if (Object.prototype.hasOwnProperty.call(obj, 'curAioData')) {
                    return { parent: obj, value: obj.curAioData };
                  }
                } catch (_) {}
                try {
                  for (const k of Object.keys(obj)) {
                    if (__le_ignoreProps.has(k)) continue;
                    const v = obj[k];
                    if (!v || typeof v !== 'object') continue;
                    if (v.nodeType && v.nodeName) continue;
                    q.push(v);
                  }
                } catch (_) {}
              }
            } catch (_) {}
            return null;
          };
          const __le_findCurAioDataLocal = (root) => {
            try {
              if (!root || typeof root !== 'object') return null;
              const q = [root];
              const visited = new WeakSet();
              let head = 0;
              while (head < q.length && head < 3000) {
                const obj = q[head++];
                if (!obj || typeof obj !== 'object') continue;
                if (visited.has(obj)) continue;
                visited.add(obj);
                try {
                  if (Object.prototype.hasOwnProperty.call(obj, 'curAioData')) {
                    return { parent: obj, value: obj.curAioData };
                  }
                } catch (_) {}
                try {
                  for (const k of Object.keys(obj)) {
                    if (__le_ignorePropsLocal.has(k)) continue;
                    const v = obj[k];
                    if (!v || typeof v !== 'object') continue;
                    if (v.nodeType && v.nodeName) continue;
                    q.push(v);
                  }
                } catch (_) {}
              }
            } catch (_) {}
            return null;
          };
          const __le_initCurAioWatch = () => {
            try {
              if (window.__le_curAioWatched) return;
              const app = (globalThis && globalThis.app) || window.app;
              const found = __le_findCurAioData(app);
              if (!found || !found.value || !found.value.chatType) return;
              window.__le_curAioWatched = true;
              let curAioData = found.value;
              const updatePeer = () => {
                try {
                  let ct = Number(curAioData.chatType);
                  let groupCode = (curAioData && (curAioData.groupCode || (curAioData.header && curAioData.header.groupCode))) || '';
                  let peerUid = curAioData && curAioData.header && curAioData.header.uid;
                  if (groupCode && ct === 1) ct = 2;
                  if (ct === 2) {
                    if (!groupCode && peerUid) groupCode = peerUid;
                    if (groupCode) peerUid = String(groupCode);
                  }
                  const peer = { chatType: ct, peerUid: peerUid ? String(peerUid) : '', guildId: '' };
                  if (ct === 2 && groupCode) peer.groupCode = String(groupCode);
                  window.__le_curPeer = peer;
                } catch (_) {}
              };
              try {
                Object.defineProperty(found.parent, 'curAioData', {
                  enumerable: true,
                  configurable: true,
                  get() { return curAioData; },
                  set(v) { curAioData = v; updatePeer(); }
                });
              } catch (_) {}
              updatePeer();
            } catch (_) {}
          };
          try {
            if (${serviceDebug ? "true" : "false"} && !window.__le_curAioWatchTimer) {
              __le_initCurAioWatch();
              window.__le_curAioWatchTimer = setInterval(__le_initCurAioWatch, 500);
            }
          } catch (_) {}
          const __le_bfsFindPeer = (root) => {
            try {
              const q = [];
              const visited = new WeakSet();
              if (root && typeof root === 'object') q.push(root);
              let head = 0;
              while (head < q.length && head < 4000) {
                const obj = q[head++];
                if (!obj || typeof obj !== 'object') continue;
                if (visited.has(obj)) continue;
                visited.add(obj);
                try {
                  if (obj.curAioData) {
                    const p = __le_peerFrom(obj.curAioData);
                    if (p) return p;
                  }
                  if (obj.peer && obj.peer.chatType && obj.peer.peerUid) {
                    return { chatType: Number(obj.peer.chatType), peerUid: String(obj.peer.peerUid), guildId: obj.peer.guildId || obj.peer.channelId || '' };
                  }
                } catch (_) {}
                try {
                  for (const k of Object.keys(obj)) {
                    const v = obj[k];
                    if (!v || typeof v !== 'object') continue;
                    if (v.nodeType && v.nodeName) continue;
                    q.push(v);
                  }
                } catch (_) {}
              }
            } catch (_) {}
            return null;
          };
          const __le_bfsFindPeerLocal = (root) => {
            try {
              const q = [];
              const visited = new WeakSet();
              if (root && typeof root === 'object') q.push(root);
              let head = 0;
              while (head < q.length && head < 2500) {
                const obj = q[head++];
                if (!obj || typeof obj !== 'object') continue;
                if (visited.has(obj)) continue;
                visited.add(obj);
                try {
                  if (obj.curAioData) {
                    const p = __le_peerFrom(obj.curAioData);
                    if (p) return p;
                  }
                  if (obj.peer && obj.peer.chatType && obj.peer.peerUid) {
                    return { chatType: Number(obj.peer.chatType), peerUid: String(obj.peer.peerUid), guildId: obj.peer.guildId || obj.peer.channelId || '' };
                  }
                } catch (_) {}
                try {
                  for (const k of Object.keys(obj)) {
                    if (__le_ignorePropsLocal.has(k)) continue;
                    const v = obj[k];
                    if (!v || typeof v !== 'object') continue;
                    if (v.nodeType && v.nodeName) continue;
                    q.push(v);
                  }
                } catch (_) {}
              }
            } catch (_) {}
            return null;
          };
          try { if (!window.__le_findCurAioDataLocal) window.__le_findCurAioDataLocal = __le_findCurAioDataLocal; } catch (_) {}
          try { if (!window.__le_bfsFindPeerLocal) window.__le_bfsFindPeerLocal = __le_bfsFindPeerLocal; } catch (_) {}
          const __le_collectRoots = () => {
            const roots = [];
            try {
              const app = (globalThis && globalThis.app) || window.app;
              if (app) roots.push(app);
              if (app && app.__vue_app__) roots.push(app.__vue_app__);
            } catch (_) {}
            try {
              const el = document.getElementById('app') || document.querySelector('[data-v-app]');
              const va = el && el.__vue_app__;
              if (va) roots.push(va);
            } catch (_) {}
            // 新增：尝试从 #main-layout 或其他容器获取
            try {
              const els = document.querySelectorAll('.two-col-layout__main, .three-col-layout__main, .aio, .chat-input-area');
              for (const el of els) {
                if (el && el.__vue_app__) roots.push(el.__vue_app__);
              }
            } catch (_) {}
            try {
              const hook = (globalThis && globalThis.__VUE_DEVTOOLS_GLOBAL_HOOK__) || window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
              const apps = hook && hook.apps;
              if (Array.isArray(apps)) {
                for (const a of apps) if (a) roots.push(a);
              }
            } catch (_) {}
            return roots;
          };
          const __le_findEditorEl = () => {
            try {
              try {
                const now = Date.now();
                const cache = window.__le_editor_el_cache;
                if (cache && cache.el && now - cache.ts < 160) {
                  const el = cache.el;
                  if (el.isConnected && el.offsetParent !== null) return el;
                }
              } catch (_) {}
              try {
                const ae = document.activeElement;
                if (ae && (ae.isContentEditable || ae.getAttribute && (ae.getAttribute('role') === 'textbox' || ae.getAttribute('contenteditable') === 'true'))) {
                  window.__le_lastEditorEl = ae;
                  try { window.__le_editor_el_cache = { el: ae, ts: Date.now() }; } catch (_) {}
                  return ae;
                }
              } catch (_) {}
              const sels = ['[contenteditable="true"]','div[role="textbox"]','div[contenteditable="plaintext-only"]','[contenteditable]','textarea','input[type="text"]'];
              for (const s of sels) {
                const list = document.querySelectorAll(s);
                for (const el of list) {
                  if (!el || el.offsetParent === null) continue;
                  if (el.closest('.two-col-layout__aside, .contact-top-bar, .main-search, .recent-contact, .lite-tools-vue-component .search')) continue;
                  try { window.__le_lastEditorEl = el; } catch (_) {}
                  try { window.__le_editor_el_cache = { el, ts: Date.now() }; } catch (_) {}
                  return el;
                }
              }
            } catch (_) {}
            try { if (window.__le_lastEditorEl) return window.__le_lastEditorEl; } catch (_) {}
            return null;
          };
          const __le_getEditorContainer = () => {
            try {
              const el = __le_findEditorEl();
              if (!el) return null;
              const c = el.closest && el.closest('.chat-input-area, .message-input-area, .aio, .three-col-layout__main, .two-col-layout__main, .q-input-area');
              return c || el;
            } catch (_) {}
            return null;
          };
          const __le_componentInContainer = (inst, container) => {
            try {
              if (!container) return true;
              const el = (inst && inst.vnode && inst.vnode.el) || (inst && inst.subTree && inst.subTree.el) || null;
              if (!el) return true;
              if (container.contains && container.contains(el)) return true;
              return false;
            } catch (_) {}
            return true;
          };
          const __le_collectEditorRoots = () => {
            const roots = [];
            try {
              let el = __le_findEditorEl();
              let depth = 0;
              const container = __le_getEditorContainer();
              const pushInst = (inst) => {
                if (!inst) return;
                if (!__le_componentInContainer(inst, container)) return;
                try { if (inst.proxy) roots.push(inst.proxy); } catch (_) {}
                try { if (inst.ctx) roots.push(inst.ctx); } catch (_) {}
                try { roots.push(inst); } catch (_) {}
                try {
                  const st = inst.appContext && inst.appContext.config && inst.appContext.config.globalProperties && inst.appContext.config.globalProperties.$store;
                  if (st && st.state) roots.push(st.state);
                } catch (_) {}
                try {
                  const st2 = inst.appContext && inst.appContext.app && inst.appContext.app.config && inst.appContext.app.config.globalProperties && inst.appContext.app.config.globalProperties.$store;
                  if (st2 && st2.state) roots.push(st2.state);
                } catch (_) {}
              };
              const addFromEl = (node) => {
                if (!node) return;
                if (container && node !== container && container.contains && !container.contains(node)) return;
                try { pushInst(node.__vueParentComponent || node.__vue__ || node.__vue_app__ || null); } catch (_) {}
                try {
                  const arr = node.__VUE__;
                  if (Array.isArray(arr)) {
                    for (const inst of arr) pushInst(inst);
                  }
                } catch (_) {}
              };
              while (el && depth < 20) {
                addFromEl(el);
                const wrap = el.closest && el.closest('.chat-input-area, .message-input-area, .aio, .three-col-layout__main, .two-col-layout__main');
                addFromEl(wrap);
                el = el.parentElement;
                depth++;
              }
              try {
                const extras = document.querySelectorAll('.chat-input-area, .message-input-area, .aio, .three-col-layout__main, .two-col-layout__main');
                for (const ex of extras) addFromEl(ex);
              } catch (_) {}
            } catch (_) {}
            return roots;
          };
          const __le_findPeerFromEditor = () => {
            try {
              const roots = __le_collectEditorRoots();
              for (const r of roots) {
                try {
                  const found = __le_findCurAioDataLocal(r);
                  if (found && found.value) {
                    const p = __le_peerFrom(found.value);
                    if (p) return p;
                  }
                } catch (_) {}
                try {
                  const p2 = __le_bfsFindPeerLocal(r);
                  if (p2) return p2;
                } catch (_) {}
              }
              for (const r of roots) {
                try {
                  const found = __le_findCurAioData(r);
                  if (found && found.value) {
                    const p = __le_peerFrom(found.value);
                    if (p) return p;
                  }
                } catch (_) {}
                try {
                  const p2 = __le_bfsFindPeer(r);
                  if (p2) return p2;
                } catch (_) {}
              }
            } catch (_) {}
            return null;
          };
          const __le_refreshPeerCache = () => {
            try {
              let peer = null;
              try {
                const curPeer = window.__le_curPeer;
                if (curPeer && curPeer.chatType && curPeer.peerUid) peer = curPeer;
              } catch (_) {}
              const roots = __le_collectRoots();
              for (const root of roots) {
                try {
                  const store = root && root.config && root.config.globalProperties && root.config.globalProperties.$store;
                  const st = store && store.state;
                  // 扩充 Store 路径探测
                  const candidates = [
                    st && st.common_Aio && st.common_Aio.curAioData,
                    st && st.aio_chatMsgArea && st.aio_chatMsgArea.curAioData,
                    st && st.chat && st.chat.chatInfo,
                    st && st.aio && st.aio.curAioData,
                    st && st.common && st.common.curPeer, // 新增
                    st && st.msg && st.msg.currentPeer,   // 新增
                  ];
                  for (const it of candidates) { if (it) { peer = __le_peerFrom(it); if (peer) break; } }
                } catch (_) {}
                if (peer) break;
                peer = __le_bfsFindPeer(root);
                if (peer) break;
              }
              if (!peer) {
                try {
                  peer = __le_bfsFindPeer(globalThis);
                } catch (_) {}
              }
              if (peer && peer.chatType && peer.peerUid) {
                window.__le_peer_cache = peer;
              }
            } catch (_) {}
          };
          try {
            if (${serviceDebug ? "true" : "false"} && !window.__le_peer_cache_timer) {
              __le_refreshPeerCache();
              window.__le_peer_cache_timer = setInterval(__le_refreshPeerCache, 1200);
            }
          } catch (_) {}
          window.addEventListener('message', (e) => {
            const d = e.data;
            if (!d || d.__to !== 'le-main' || !d.id) return;
            (async () => {
              try {
                let result;
                if (d.type === 'sendMessage') {
                  const { peer, messages } = d.payload || {};
                  const lt = (globalThis && globalThis.lite_tools) || window.lite_tools;
                  if (!lt || typeof lt.nativeCall !== 'function') throw new Error('lite_tools.nativeCall missing');
                  const arr = Array.isArray(messages) ? messages : (messages ? [messages] : []);
                  const elems = (typeof window.le_convertMessage === 'function') ? (await window.le_convertMessage(arr)) : arr;
                  const converted = (Array.isArray(elems) ? elems : [elems]).filter(Boolean);
                  if (!peer || !converted.length) throw new Error('sendMessage: peer/elements missing');
                  result = await lt.nativeCall(
                    { eventName: 'ntApi', type: 'request' },
                    {
                      cmdName: 'nodeIKernelMsgService/sendMsg',
                      cmdType: 'invoke',
                      payload: [
                        {
                          msgId: '0',
                          peer,
                          msgElements: converted,
                          msgAttributeInfos: new Map(),
                        },
                        null,
                      ],
                    }
                  );
                } else if (d.type === 'nativeCall') {
                  const { header, detail, wantRet } = d.payload || {};
                  const lt = (globalThis && globalThis.lite_tools) || window.lite_tools;
                  if (!lt || typeof lt.nativeCall !== 'function') throw new Error('lite_tools.nativeCall missing');
                  result = await lt.nativeCall(header, detail, wantRet);
                } else if (d.type === 'getPeer') {
                  let peer = null;
                  const getHint = () => {
                    try {
                  const app = (globalThis && globalThis.app) || window.app;
                  const c = app && (app.curAioData || app.mainAio);
                  if (c && c.chatType) {
                        const groupCode = c.groupCode || (c.header && c.header.groupCode) || '';
                        let chatType = Number(c.chatType);
                        if (groupCode && chatType === 1) chatType = 2;
                        return { chatType, groupCode };
                      }
                    } catch (_) {}
                    return null;
                  };
                  const matchHint = (p, h) => {
                    if (!p || !p.chatType || !p.peerUid) return false;
                    if (!h || !h.chatType) return true;
                    const ct = Number(p.chatType);
                    const ht = Number(h.chatType);
                    if (ct !== ht) {
                      if (!h.groupCode) return true;
                      return false;
                    }
                    if (ct === 2 && h.groupCode) {
                      return String(p.groupCode || p.peerUid) === String(h.groupCode);
                    }
                    return true;
                  };
                  const hint = getHint();
                  if (!peer) {
                    try {
                      const ep = __le_findPeerFromEditor();
                      if (ep && matchHint(ep, hint)) peer = ep;
                    } catch (_) {}
                  }
                  try {
                    const curPeer = window.__le_curPeer;
                    if (curPeer && matchHint(curPeer, hint)) peer = curPeer;
                  } catch (_) {}
                  if (!peer) {
                    try {
                      const lt = (globalThis && globalThis.lite_tools) || window.lite_tools;
                      const p0 = lt && typeof lt.getPeer === 'function' ? lt.getPeer() : null;
                      if (p0 && matchHint(p0, hint)) peer = p0;
                    } catch (_) {}
                  }
                  if (!peer) {
                    try {
                      const app = (globalThis && globalThis.app) || window.app;
                      let c = app && (app.curAioData || app.mainAio);
                      if (!c) {
                        const found = __le_findCurAioData(app);
                        if (found && found.value) c = found.value;
                      }
                      if (!c) {
                        const roots = __le_collectRoots();
                        for (const root of roots) {
                          try {
                            const store = root && root.config && root.config.globalProperties && root.config.globalProperties.$store;
                            const st = store && store.state;
                            const candidates = [
                              st && st.common_Aio && st.common_Aio.curAioData,
                              st && st.aio_chatMsgArea && st.aio_chatMsgArea.curAioData,
                              st && st.chat && st.chat.chatInfo,
                              st && st.aio && st.aio.curAioData
                            ];
                            for (const it of candidates) { if (it) { c = it; break; } }
                            if (c) break;
                          } catch (_) {}
                        }
                      }
                      peer = __le_peerFrom(c);
                      if (!peer) {
                        const roots = __le_collectRoots();
                        for (const r of roots) {
                          peer = __le_bfsFindPeer(r);
                          if (peer) break;
                        }
                      }
                    } catch (_) {}
                  }
                  if (!peer) {
                    try {
                      const pc = window.__le_peer_cache || null;
                      if (pc && matchHint(pc, hint)) peer = pc;
                    } catch (_) {}
                  }
                  if (!peer && typeof window.derivePeer === 'function') {
                    try {
                      const p2 = await window.derivePeer();
                      if (p2 && matchHint(p2, hint)) peer = p2;
                    } catch (_) {}
                  }
                  if (peer && peer.chatType && peer.peerUid) {
                    try { window.__le_lastPeer = peer; } catch (_) {}
                  }
                  result = peer;
                } else {
                  throw new Error('Unknown main request type: ' + d.type);
                }
                window.postMessage({ __from: 'le-main', id: d.id, result }, '*');
              } catch (err) {
                window.postMessage({ __from: 'le-main', id: d.id, error: { message: String((err && err.message) || err), name: err && err.name, stack: err && err.stack } }, '*');
              }
            })();
          }, false);
        } catch (e) {
          console.error('[local_emotes] main-world service install failed', e);
        }
      })();`;
      document.documentElement.appendChild(s2);
      s2.remove();
    } catch (e) {
      console.error('[local_emotes] service script inject failed', e);
    }
      // define leMainRequest in ISOLATED world
      if (!window.leMainRequest) {
        const pending = new Map();
        window.addEventListener('message', (e) => {
          const d = e.data;
          if (!d || d.__from !== 'le-main' || !d.id) return;
          const p = pending.get(d.id);
          if (!p) return;
          pending.delete(d.id);
          if (d.error) {
            const err = new Error(d.error.message || 'leMain error');
            err.name = d.error.name || err.name;
            err.stack = d.error.stack || err.stack;
            p.reject(err);
          } else {
            p.resolve(d.result);
          }
        }, false);
        window.leMainRequest = function(type, payload) {
          const id = Math.random().toString(36).slice(2);
          return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject });
            window.postMessage({ __to: 'le-main', id, type, payload }, '*');
          });
        };
        console.log('[local_emotes] Service Injection Ready: window.leMainRequest is available.');
      }
    })();
  } catch (e) { console.error('[local_emotes] installLEMainWorldService error', e); }
  // --- end LE main-world service injection ---

// —— 样式注入（一次） ——
function injectLEStylesOnce() {
  if (document.getElementById("le-styles")) return;
  const style = document.createElement("style");
  style.id = "le-styles";
  style.textContent = `
  /* 主题变量（亮/暗） */
  :root {
    --le-bg: rgba(255,255,255,.78);
    --le-bg-top: rgba(255,255,255,.92);
    --le-bg-bottom: rgba(255,255,255,.7);
    --le-fg: #111827;
    --le-muted: #6b7280;
    --le-border: rgba(0,0,0,.08);
    --le-hover-bg: rgba(0,0,0,.05);
    --le-active-bg: rgba(0,0,0,.08);
    --le-header-bg: rgba(255,255,255,.6);
    --le-input-bg: rgba(255,255,255,.72);
    --le-divider: rgba(0,0,0,.06);
    --le-icon: #4b5563;
    --le-icon-hover: #111827;
    --le-primary: #2563eb;
    --le-focus: rgba(37,99,235,.25);
    --le-image-border: rgba(0,0,0,.08);
    --le-blur: 14px;
    --le-glow: rgba(255,255,255,.4);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --le-bg: rgba(17,24,39,.72);
      --le-bg-top: rgba(31,41,55,.85);
      --le-bg-bottom: rgba(17,24,39,.66);
      --le-fg: #e5e7eb;
      --le-muted: #9ca3af;
      --le-border: rgba(255,255,255,.08);
      --le-hover-bg: rgba(255,255,255,.06);
      --le-active-bg: rgba(255,255,255,.10);
      --le-header-bg: rgba(17,24,39,.55);
      --le-input-bg: rgba(17,24,39,.62);
      --le-divider: rgba(255,255,255,.06);
      --le-icon: #cfd4dc;
      --le-icon-hover: #fff;
      --le-primary: #60a5fa;
      --le-focus: rgba(96,165,250,.35);
      --le-image-border: rgba(255,255,255,.10);
      --le-blur: 16px;
      --le-glow: rgba(255,255,255,.12);
    }
  }

  /* 工具栏按钮 */
  #local-emote-toolbar-btn {
    color: var(--le-icon) !important;
    border-radius: 6px !important;
    background: transparent !important;
    transition: background-color .15s ease, color .15s ease, transform .05s ease !important;
  }
  #local-emote-toolbar-btn:hover {
    background: var(--le-hover-bg) !important;
    color: var(--le-icon-hover) !important;
  }
  #local-emote-toolbar-btn:active {
    transform: scale(.96);
    background: var(--le-active-bg) !important;
  }

  /* 悬浮面板整体 */
  #local-emote-overlay.le-overlay {
    background: linear-gradient(180deg, var(--le-bg-top), var(--le-bg-bottom)) !important;
    color: var(--le-fg) !important;
    border: 1px solid var(--le-border) !important;
    box-shadow: 0 20px 48px rgba(0,0,0,.25), inset 0 0 0 1px var(--le-glow) !important;
    border-radius: 10px !important;
    overflow: hidden !important;
    backdrop-filter: blur(var(--le-blur)) saturate(130%) !important;
    -webkit-backdrop-filter: blur(var(--le-blur)) saturate(130%) !important;
  }
  #local-emote-overlay .le-header {
    display: flex; align-items: center; gap: 8px; padding: 10px;
    border-bottom: 1px solid var(--le-divider);
    background: var(--le-header-bg);
  }
  #local-emote-overlay .le-select,
  #local-emote-overlay .le-input,
  #local-emote-overlay .le-btn {
    height: 28px; border-radius: 6px; border: 1px solid var(--le-border);
    background: var(--le-input-bg); color: var(--le-fg);
    font-size: 12px; line-height: 28px; padding: 0 8px; outline: none;
    transition: border-color .15s, box-shadow .15s, background-color .15s, color .15s;
  }
  #local-emote-overlay .le-select { flex: 1; min-width: 120px; }
  #local-emote-overlay .le-input { width: 40%; }
  #local-emote-overlay .le-btn:hover { background: var(--le-hover-bg); }
  #local-emote-overlay .le-select:focus,
  #local-emote-overlay .le-input:focus,
  #local-emote-overlay .le-btn:focus {
    border-color: var(--le-primary);
    box-shadow: 0 0 0 3px var(--le-focus);
  }

  /* 网格与卡片 */
  #local-emote-overlay .le-grid {
    display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px;
    padding: 10px; overflow: auto; max-height: calc(70vh - 56px);
  }
  @media (max-width: 600px) {
    #local-emote-overlay .le-grid { grid-template-columns: repeat(4, 1fr); }
  }
  #local-emote-overlay .le-card {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 6px; border-radius: 8px; cursor: pointer;
    transition: background-color .15s, box-shadow .15s;
  }
  #local-emote-overlay .le-card:hover { background: var(--le-hover-bg); }
  #local-emote-overlay .le-img {
    width: 64px; height: 64px; object-fit: contain;
    background: var(--le-input-bg); border: 1px solid var(--le-image-border); border-radius: 8px;
  }
  #local-emote-overlay .le-name {
    font-size: 12px; color: var(--le-muted);
    max-width: 100%; overflow: hidden; text-overflow: ellipsis;
  }

  #local-emote-hover-preview {
    position: fixed;
    display: none;
    z-index: 10000;
    padding: 6px;
    border-radius: 10px;
    border: 1px solid var(--le-border);
    background: linear-gradient(180deg, var(--le-bg-top), var(--le-bg-bottom));
    box-shadow: 0 18px 40px rgba(0,0,0,.24), inset 0 0 0 1px var(--le-glow);
    pointer-events: none;
    backdrop-filter: blur(var(--le-blur)) saturate(130%);
    -webkit-backdrop-filter: blur(var(--le-blur)) saturate(130%);
  }
  #local-emote-hover-preview img {
    width: 160px;
    height: 160px;
    object-fit: contain;
    display: block;
    border-radius: 8px;
    background: var(--le-input-bg);
    border: 1px solid var(--le-image-border);
  }

  /* 滚动条 */
  #local-emote-overlay .le-grid::-webkit-scrollbar { width: 8px; height: 8px; }
  #local-emote-overlay .le-grid::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,.25); border-radius: 8px; }
  #local-emote-overlay .le-search-row {
    display: flex; align-items: center; gap: 8px; padding: 10px 10px 0;
  }
  #local-emote-overlay .le-search {
    width: 100%; height: 30px;
  }
  #local-emote-overlay .le-empty {
    grid-column: 1 / -1;
    padding: 18px 12px;
    color: var(--le-muted);
    text-align: center;
    border: 1px dashed var(--le-border);
    border-radius: 10px;
    background: var(--le-input-bg);
  }
  @media (prefers-color-scheme: dark) {
    #local-emote-overlay .le-grid::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,.25); }
  }

  /* 置顶/Pin 按钮与置顶态 */
  #local-emote-overlay .le-card { position: relative; }
  #local-emote-overlay .le-card.pinned { box-shadow: inset 0 0 0 2px var(--le-primary); }
  #local-emote-overlay .le-pin-btn {
    position: absolute; top: 6px; right: 6px;
    width: 20px; height: 20px; border: 1px solid var(--le-border);
    border-radius: 6px; background: var(--le-input-bg); color: var(--le-muted);
    display: inline-flex; align-items: center; justify-content: center;
    cursor: pointer; padding: 0;
    transition: background-color .15s, color .15s, border-color .15s;
  }
  #local-emote-overlay .le-pin-btn:hover { background: var(--le-hover-bg); color: var(--le-icon-hover); border-color: var(--le-primary); }
  #local-emote-overlay .le-pin-btn svg { width: 14px; height: 14px; }
  #local-emote-overlay .le-pin-btn.active { color: var(--le-primary); }

  /* 键盘导航高亮态（主网格） */
  #local-emote-overlay .le-card.active { box-shadow: inset 0 0 0 2px var(--le-primary); background: var(--le-hover-bg); }

  /* QQNT 卡片布局 */
  #local-emote-overlay .le-qqnt-card { display: flex; flex-direction: column; width: 560px; height: 420px; }
  /* 侧栏样式仍保留但不再使用 */
  #local-emote-overlay .le-qqnt-sidebar { width: 0; padding: 0; border-right: none; display: none; }
  /* 主内容容器与滚动区、标题 */
  #local-emote-overlay .le-qqnt-content { flex: 1 1 auto; display: flex; flex-direction: column; width: 100%; height: 100%; overflow: hidden; }
  #local-emote-overlay .le-scroll { flex: 1 1 auto; overflow: auto; padding: 8px 10px 10px; }
  #local-emote-overlay .le-section-title { font-size: 16px; font-weight: 600; padding: 6px 6px 4px; color: var(--le-fg); opacity: .95; }

  /* 底部表情包选择栏（圆形封面） */
  #local-emote-overlay .le-packs-bar { flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-top: 1px solid var(--le-divider); overflow: auto hidden; background: var(--le-header-bg); }
  #local-emote-overlay .le-packs-bar::-webkit-scrollbar { height: 8px; }
  #local-emote-overlay .le-pack { position: relative; width: 36px; height: 36px; border-radius: 999px; background: var(--le-input-bg); border: 1px solid var(--le-border); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: border-color .15s, background-color .15s, box-shadow .15s; }
  #local-emote-overlay .le-pack:hover { background: var(--le-hover-bg); }
  #local-emote-overlay .le-pack.active { box-shadow: inset 0 0 0 2px var(--le-primary); }
  #local-emote-overlay .le-pack img { width: 28px; height: 28px; object-fit: cover; border-radius: 999px; }
  #local-emote-overlay .le-pack .le-pack-badge { position: absolute; right: 3px; bottom: 3px; width: 6px; height: 6px; border-radius: 999px; background: var(--le-primary); opacity: .85; }

  /* 主内容占据剩余空间，底部栏固定 */
  #local-emote-overlay .le-qqnt-content .le-grid { flex: 0 0 auto; max-height: none; }
  `;
  document.head.appendChild(style);
}

// 额外的动效样式（仅一次）
function injectLEAnimStylesOnce() {
  if (document.getElementById('le-styles-anim')) return;
  const s = document.createElement('style');
  s.id = 'le-styles-anim';
  s.textContent = `
  @keyframes le-pulse { from { transform: scale(.6); opacity: .8; } to { transform: scale(2); opacity: 0; } }
  .le-ping { position: absolute; width: 8px; height: 8px; border-radius: 999px; background: var(--le-primary); opacity: .66; animation: le-pulse .8s ease-out; }
  `;
  document.head.appendChild(s);
}

// 在模块加载时确保样式注入一次
try { injectLEStylesOnce(); } catch (_) {}

// === 插件运行所需的全局与辅助函数 ===
let overlayInstance = null;
let toolbarBtnRef = null;
let injected = false;
const OBSERVER_INTERVAL = 1500;

function parseHotkeyString(str) {
  const parts = String(str || '').split('+').map(s => s.trim().toLowerCase()).filter(Boolean);
  const hk = { ctrl: false, alt: false, shift: false, meta: false, key: '' };
  for (const p of parts) {
    if (p === 'ctrl' || p === 'control') hk.ctrl = true;
    else if (p === 'alt') hk.alt = true;
    else if (p === 'shift') hk.shift = true;
    else if (p === 'meta' || p === 'cmd' || p === 'win' || p === 'super') hk.meta = true;
    else hk.key = p;
  }
  try { dbg('parseHotkeyString:', str, '=>', hk); } catch (_) {}
  return hk;
}
function matchHotkey(e, hk) {
  if (!hk) return false;
  const key = (e.key || '').toLowerCase();
  const mainOk = hk.key ? (key === hk.key || (hk.key.length === 1 && key === hk.key)) : true;
  const ok = (!!hk.ctrl === !!e.ctrlKey) && (!!hk.alt === !!e.altKey) && (!!hk.shift === !!e.shiftKey) && (!!hk.meta === !!e.metaKey) && mainOk;
  try { dbg('matchHotkey:', { key, ctrl: !!e.ctrlKey, alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey }, 'against', hk, '=>', ok); } catch (_) {}
  return ok;
}
function onGlobalKeydown(e) {
  try {
    try { if (typeof ensureLESendMsgDebugHookInstalled === 'function') ensureLESendMsgDebugHookInstalled(); } catch (_) {}
    // 忽略脚本派发的键盘事件，避免触发热键造成“回车->打开面板->再次点击卡片”的循环
    if (e && e.isTrusted === false) return;
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    const isEditable = (e.target && (e.target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select'));
    dbg('onGlobalKeydown:', e.key, 'target=', tag, 'editable=', isEditable);
    // 调试热键：Alt+Shift+S 触发扫描（允许在编辑框内使用）
    try {
      const cfg2 = window.localEmote && window.localEmote.getConfig ? window.localEmote.getConfig() : null;
      if (cfg2 && cfg2.debug && (e.key === 'S' || e.key === 's') && e.altKey && e.shiftKey) {
        e.preventDefault(); e.stopPropagation();
        if (typeof scanStoreForMsgElements === 'function') {
          const res = scanStoreForMsgElements(8);
          dbg('debug hotkey: scanStore results=', res && res.length);
        } else {
          dbg('debug hotkey: scanStore function missing');
        }
        // 新增：桥接与主世界服务自检
        try {
          const hasLeMainRequest = (typeof window.leMainRequest === 'function');
          const hasIsolatedLeSend = (typeof window.le_sendMessage === 'function');
          const hasLt = !!((globalThis && globalThis.lite_tools) || window.lite_tools);
          dbg('debug hotkey: hasLeMainRequest=', hasLeMainRequest, 'hasIsolatedLeSend=', hasIsolatedLeSend, 'hasLt=', hasLt);
          if (hasLeMainRequest) {
            const timer = setTimeout(() => dbg('debug hotkey: leMainRequest(getPeer) timeout (no main service?)'), 2000);
            window.leMainRequest('getPeer').then((peer) => {
              try { dbg('debug hotkey: leMainRequest(getPeer) ->', peer); } catch (_) {}
            }).catch((err) => {
              try { dbg('debug hotkey: leMainRequest(getPeer) error', err && err.message); } catch (_) {}
            }).finally(() => clearTimeout(timer));
          }
        } catch (_) {}
        return;
      }
    } catch (_) {}
    if (isEditable && e.key !== 'Escape') return;
    const cfg = window.localEmote.getConfig();
    const hk = parseHotkeyString(cfg.hotkey || 'Alt+E');
    if (matchHotkey(e, hk)) {
      dbg('onGlobalKeydown: hotkey matched');
      e.preventDefault(); e.stopPropagation();
      if (!overlayInstance) {
        try { dbg('onGlobalKeydown: injectButton on demand'); injectButton(); } catch (_) {}
      }
      if (!overlayInstance || !toolbarBtnRef) { dbg('onGlobalKeydown: overlay or button not ready'); return; }
      const rect = toolbarBtnRef.getBoundingClientRect();
      const ov = overlayInstance.el;
      if (ov.style.display === 'none' || !ov.style.display) { dbg('onGlobalKeydown: show overlay'); overlayInstance.show(rect); } else { dbg('onGlobalKeydown: hide overlay'); overlayInstance.hide(); }
    }
  } catch (_) {}
}

function findToolbarContainer() {
  const selectors = [
    'div[role="toolbar"]',
    'div.toolbar',
    '[class*="tool"][class*="bar"]',
    '[aria-label="工具栏"]',
    'footer [role="toolbar"]',
    'main [role="toolbar"]'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  const input = document.querySelector('[contenteditable="true"], textarea, input[type="text"]');
  if (input) {
    let p = input.parentElement;
    for (let i = 0; p && i < 5; i++, p = p.parentElement) {
      const toolbar = p.querySelector('div[role="toolbar"], [class*="tool"][class*="bar"]');
      if (toolbar) return toolbar;
    }
  }
  return document.body;
}

// 已移除：findEmojiButton（与 deepl_plugin 对齐，图标注入逻辑见 injectButton -> .chat-func-bar 左侧）
function createIconSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18'); svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8');
  const c = document.createElementNS(svg.namespaceURI, 'circle'); c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '9');
  const e1 = document.createElementNS(svg.namespaceURI, 'circle'); e1.setAttribute('cx', '9'); e1.setAttribute('cy', '10'); e1.setAttribute('r', '1.2');
  const e2 = document.createElementNS(svg.namespaceURI, 'circle'); e2.setAttribute('cx', '15'); e2.setAttribute('cy', '10'); e2.setAttribute('r', '1.2');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', 'M8 14c1.2 1.5 2.7 2.2 4 2.2s2.8-.7 4-2.2');
  path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(c); svg.appendChild(e1); svg.appendChild(e2); svg.appendChild(path);
  return svg;
}
function createPinSvg(active) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '14'); svg.setAttribute('height', '14');
  svg.setAttribute('fill', active ? 'currentColor' : 'none');
  svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', 'M12 2l4 4-3 3 5 5-2 2-5-5-3 3-4-4 8-8z');
  path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  return svg;
}
function createFolderSvg() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '16'); s.setAttribute('height', '16'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
  const p = document.createElementNS(s.namespaceURI, 'path');
  p.setAttribute('d', 'M3 7h6l2 3h10v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7z'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
  s.appendChild(p); return s;
}
function createImportSvg() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '16'); s.setAttribute('height', '16'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
  const p1 = document.createElementNS(s.namespaceURI, 'path'); p1.setAttribute('d', 'M12 3v12'); p1.setAttribute('stroke-linecap', 'round');
  const p2 = document.createElementNS(s.namespaceURI, 'path'); p2.setAttribute('d', 'M8 11l4 4 4-4'); p2.setAttribute('stroke-linecap', 'round'); p2.setAttribute('stroke-linejoin', 'round');
  const p3 = document.createElementNS(s.namespaceURI, 'rect'); p3.setAttribute('x','4'); p3.setAttribute('y','17'); p3.setAttribute('width','16'); p3.setAttribute('height','4');
  s.appendChild(p1); s.appendChild(p2); s.appendChild(p3); return s;
}
function createTrashSvg() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '16'); s.setAttribute('height', '16'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
  const p = document.createElementNS(s.namespaceURI, 'path'); p.setAttribute('d', 'M3 6h18M8 6V4h8v2m-9 0l1 14h8l1-14'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
  s.appendChild(p); return s;
}

// —— 发送插入相关 ——
function isVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return !!(el.offsetParent !== null || rect.width || rect.height);
}
function getEditorEl() {
  dbg('getEditorEl: start');
  try {
    const now = Date.now();
    const cache = window.__le_editor_cache;
    if (cache && cache.el && now - cache.ts < 160) {
      const el = cache.el;
      if (el.isConnected && isVisible(el)) return el;
    }
  } catch (_) {}
  const selectors = [
    '[contenteditable="true"]',
    'div[role="textbox"]',
    'div[contenteditable="plaintext-only"]',
    '[contenteditable]',
    'textarea',
    'input[type="text"]',
    'input'
  ];
  const blacklistAncestors = '.two-col-layout__aside, .contact-top-bar, .main-search, .recent-contact, .lite-tools-vue-component .search';
  const preferAncestors = '.two-col-layout__main, .message-input-area, .chat-input-area, .msg-input, [class*="message"], [class*="chat"], [class*="input-area"]';

  const candidates = [];
  for (const sel of selectors) {
    const found = Array.from(document.querySelectorAll(sel));
    for (const el of found) {
      if (!el || !isVisible(el)) continue;
      // 排除侧边栏/搜索等输入框
      if (el.closest(blacklistAncestors)) continue;
      const tag = (el.tagName || '').toLowerCase();
      let score = 0;
      if (el.closest(preferAncestors)) score += 8;
      if (el.isContentEditable) score += 5;
      if (tag === 'div') score += 1;
      if (tag === 'textarea') score += 2;
      if (tag === 'input') score -= 2; // 避免误选搜索输入
      // 距离窗口底部越近越可能是聊天输入框
      try {
        const rect = el.getBoundingClientRect();
        const distBottom = Math.max(0, window.innerHeight - rect.bottom);
        score += Math.max(0, 6 - Math.min(6, Math.floor(distBottom / 50)));
      } catch (_) {}
      candidates.push({ el, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length > 0) {
    const picked = candidates[0];
    const cls = (picked.el.className && typeof picked.el.className === 'string') ? picked.el.className : '';
    dbg('getEditorEl: picked', (picked.el.tagName || '').toLowerCase(), cls, 'score=', picked.score);
    try { window.__le_editor_cache = { el: picked.el, ts: Date.now() }; } catch (_) {}
    return picked.el;
  }
  // 兜底：旧逻辑
  try {
    const all = Array.from(document.querySelectorAll('[contenteditable], div[role="textbox"]')).filter(el => isVisible(el) && !el.closest(blacklistAncestors));
    const editable = all.find(el => el.isContentEditable) || all[0] || null;
    if (editable) { dbg('getEditorEl: fallback isContentEditable'); return editable; }
  } catch (_) {}
  dbg('getEditorEl: not found');
  return null;
}
function insertImageAtCursor(editable, url) {
  try {
    if (!editable) return false;
    const tag = (editable.tagName || '').toLowerCase();
    dbg('insertImageAtCursor: begin', 'tag=', tag, 'url=', url);
    if (tag === 'textarea' || tag === 'input') {
      // 纯文本编辑器兜底：插入文件名
      const val = editable.value || '';
      const name = (url.split('/')?.pop() || '图片');
      const ins = `[图片 ${decodeURIComponent(name)}]`;
      const start = editable.selectionStart || val.length;
      const end = editable.selectionEnd || val.length;
      editable.value = val.slice(0, start) + ins + val.slice(end);
      try { editable.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
      dbg('insertImageAtCursor: inserted text fallback');
      return true;
    }
    // contenteditable：在光标处插入 <img>
    editable.focus();
    const img = document.createElement('img');
    img.src = url; img.alt = 'emote'; img.style.maxWidth = '128px'; img.style.maxHeight = '128px';
    let sel = null; let range = null;
    try {
      sel = window.getSelection();
      if (sel) {
        let needNewRange = sel.rangeCount === 0;
        if (!needNewRange) {
          try {
            range = sel.getRangeAt(0);
            if (range && !editable.contains(range.startContainer)) needNewRange = true;
          } catch (_) {
            needNewRange = true;
          }
        }
        if (needNewRange) {
          range = document.createRange();
          range.selectNodeContents(editable);
          range.collapse(false);
          try { sel.removeAllRanges(); sel.addRange(range); } catch (_) {}
        } else if (range) {
          range.collapse(false);
        }
      }
    } catch (e) { dbg('insertImageAtCursor: selection error', e && e.message); }

    try {
      if (range) {
        range.insertNode(img);
        // 将光标移动到图片之后
        range.setStartAfter(img); range.setEndAfter(img);
        if (sel) { sel.removeAllRanges(); sel.addRange(range); }
        dbg('insertImageAtCursor: inserted into contenteditable with selection');
        try {
          editable.dispatchEvent(new InputEvent('input', { bubbles: true }));
        } catch (_) { try { editable.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {} }
        try { editable.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
        return true;
      } else {
        editable.appendChild(img);
        dbg('insertImageAtCursor: appended img to editable');
        return true;
      }
    } catch (e) {
      dbg('insertImageAtCursor: range insert error', e && e.message);
      try { editable.appendChild(img); dbg('insertImageAtCursor: fallback append'); return true; } catch (_) {}
    }
    try {
      if (document.execCommand) {
        const ok = document.execCommand('insertImage', false, url);
        if (ok) { dbg('insertImageAtCursor: execCommand fallback ok'); return true; }
      }
    } catch (_) {}
    return false;
  } catch (e) { dbg('insertImageAtCursor: error', e && e.message); return false; }
}
function ensureSelectionAtEditorEnd(editable) {
  try {
    if (!editable) return false;
    const tag = (editable.tagName || '').toLowerCase();
    try { editable.focus(); } catch (_) {}
    if (tag === 'textarea' || tag === 'input') return true;
    if (!editable.isContentEditable) return false;
    let sel = null; let range = null;
    try {
      sel = window.getSelection();
      if (sel) {
        let needNewRange = sel.rangeCount === 0;
        if (!needNewRange) {
          try {
            range = sel.getRangeAt(0);
            if (range && !editable.contains(range.startContainer)) needNewRange = true;
          } catch (_) {
            needNewRange = true;
          }
        }
        if (needNewRange) {
          range = document.createRange();
          range.selectNodeContents(editable);
          range.collapse(false);
          try { sel.removeAllRanges(); sel.addRange(range); } catch (_) {}
        } else if (range) {
          range.collapse(false);
        }
      }
    } catch (_) {}
    return true;
  } catch (_) { return false; }
}
function installGlobalSelectionGuard() {
  try {
    if (window.__le_global_selection_guard_installed) return;
    window.__le_global_selection_guard_installed = true;
    const guard = (e) => {
      try {
        const t = e && e.target;
        if (!t || !t.closest) return;
        if (!t.closest('#local-emote-overlay') && !t.closest('#local-emote-toolbar-btn')) return;
        ensureSelectionAtEditorEnd(getEditorEl());
      } catch (_) {}
    };
    document.addEventListener('pointerdown', guard, true);
    document.addEventListener('mousedown', guard, true);
  } catch (_) {}
}
function getRect(target) {
  if (!target) return null;
  if (target.getBoundingClientRect) return target.getBoundingClientRect();
  const r = target;
  if (typeof r.left === 'number') return r;
  return null;
}
function animateEmoteFlight(fromEl, toTarget) {
  try {
    dbg('animateEmoteFlight: start');
    const srcRect = fromEl.getBoundingClientRect();
    const dstRect = getRect(toTarget) || { left: window.innerWidth - 40, top: window.innerHeight - 40, width: 24, height: 24, right: window.innerWidth - 16, bottom: window.innerHeight - 16 };
    const clone = fromEl.cloneNode(true);
    clone.classList.add('le-fly');
    clone.style.left = srcRect.left + 'px';
    clone.style.top = srcRect.top + 'px';
    clone.style.width = srcRect.width + 'px';
    clone.style.height = srcRect.height + 'px';
    clone.style.transform = 'translate(0,0) scale(1)';
    clone.style.opacity = '1';
    document.body.appendChild(clone);
    // 计算位移与缩放
    const srcCx = srcRect.left + srcRect.width / 2;
    const srcCy = srcRect.top + srcRect.height / 2;
    const dstCx = dstRect.left + (dstRect.width || 24) / 2;
    const dstCy = dstRect.top + (dstRect.height || 24) / 2;
    const dx = dstCx - srcCx;
    const dy = dstCy - srcCy;
    const scale = Math.max(24 / Math.max(1, srcRect.width), 0.35);
    dbg('animateEmoteFlight: dx=', dx, 'dy=', dy, 'scale=', scale);
    // 强制一次回流确保初始样式生效
    void clone.offsetWidth;
    requestAnimationFrame(() => {
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      clone.style.opacity = '0.15';
    });
    return new Promise((resolve) => {
      const done = () => { try { clone.remove(); } catch (_) {} resolve(); };
      clone.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 600);
    });
  } catch (_) { return Promise.resolve(); }
}
function pressEnterToSend(editable) {
  try {
    if (!editable) return false;
    try { editable.focus(); } catch (_) {}
    const sendCombos = [
      { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true },
      { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, ctrlKey: true },
      { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, metaKey: true },
      // 兼容常见发送热键：Alt+S
      { key: 's', code: 'KeyS', keyCode: 83, which: 83, bubbles: true, cancelable: true, altKey: true },
      { key: 'S', code: 'KeyS', keyCode: 83, which: 83, bubbles: true, cancelable: true, altKey: true, shiftKey: true }
    ];
    let any = false;
    for (const opts of sendCombos) {
      try { editable.dispatchEvent(new KeyboardEvent('keydown', opts)); any = true; } catch (_) {}
      try { editable.dispatchEvent(new KeyboardEvent('keypress', opts)); } catch (_) {}
      try { editable.dispatchEvent(new KeyboardEvent('keyup', opts)); } catch (_) {}
      // 再向 document 冒泡一遍，兼容部分编辑器在宿主监听回车/热键的情况
      try { document.dispatchEvent(new KeyboardEvent('keydown', opts)); } catch (_) {}
      try { document.dispatchEvent(new KeyboardEvent('keypress', opts)); } catch (_) {}
      try { document.dispatchEvent(new KeyboardEvent('keyup', opts)); } catch (_) {}
    }
    dbg('pressEnterToSend: dispatched combos, any=', any);
    return any;
  } catch (_) { return false; }
}
function initCurAioWatchIsolated() {
  try {
    if (window.__le_curAioWatchInstalled) return;
    window.__le_curAioWatchInstalled = true;
    const ignoreProps = new Set([
      'dep',
      '__v_raw',
      '__v_skip',
      '_value',
      '__ob__',
      'prevDep',
      'nextDep',
      'prevSub',
      'nextSub',
      'deps',
      'subs',
      '__vueParentComponent',
      'parent',
      'provides'
    ]);
    const findCurAio = (root) => {
      try {
        if (!root || typeof root !== 'object') return null;
        const q = [root];
        const visited = new WeakSet();
        let head = 0;
        while (head < q.length && head < 6000) {
          const obj = q[head++];
          if (!obj || typeof obj !== 'object') continue;
          if (visited.has(obj)) continue;
          visited.add(obj);
          try {
            if (Object.prototype.hasOwnProperty.call(obj, 'curAioData')) return { parent: obj, value: obj.curAioData };
          } catch (_) {}
          try {
            for (const k of Object.keys(obj)) {
              if (ignoreProps.has(k)) continue;
              const v = obj[k];
              if (!v || typeof v !== 'object') continue;
              if (v.nodeType && v.nodeName) continue;
              q.push(v);
            }
          } catch (_) {}
        }
      } catch (_) {}
      return null;
    };
    const tryInit = () => {
      try {
        const app = window.app;
        const found = findCurAio(app);
        if (!found || !found.value || !found.value.chatType) return;
        let curAioData = found.value;
        const updatePeer = () => {
          try {
            let ct = Number(curAioData.chatType);
            let groupCode = (curAioData && (curAioData.groupCode || (curAioData.header && curAioData.header.groupCode))) || '';
            let peerUid = curAioData && curAioData.header && curAioData.header.uid;
            if (groupCode && ct === 1) ct = 2;
            if (ct === 2) {
              if (!groupCode && peerUid) groupCode = peerUid;
              if (groupCode) peerUid = String(groupCode);
            }
            const peer = { chatType: ct, peerUid: peerUid ? String(peerUid) : '', guildId: '' };
            if (ct === 2 && groupCode) peer.groupCode = String(groupCode);
            window.__le_curPeer = peer;
          } catch (_) {}
        };
        try {
          Object.defineProperty(found.parent, 'curAioData', {
            enumerable: true,
            configurable: true,
            get() { return curAioData; },
            set(v) { curAioData = v; updatePeer(); }
          });
        } catch (_) {}
        updatePeer();
        if (window.__le_curAioWatchTimer) { clearInterval(window.__le_curAioWatchTimer); window.__le_curAioWatchTimer = null; }
      } catch (_) {}
    };
    tryInit();
    if (!window.__le_curAioWatchTimer) window.__le_curAioWatchTimer = setInterval(tryInit, 500);
  } catch (_) {}
}
try { initCurAioWatchIsolated(); } catch (_) {}
const __le_ignorePropsIso = new Set([
  'dep',
  '__v_raw',
  '__v_skip',
  '_value',
  '__ob__',
  'prevDep',
  'nextDep',
  'prevSub',
  'nextSub',
  'deps',
  'subs',
  '__vueParentComponent',
  'parent',
  'provides'
]);
const __le_ignorePropsIsoLocal = new Set([
  'dep',
  '__v_raw',
  '__v_skip',
  '_value',
  '__ob__',
  'prevDep',
  'nextDep',
  'prevSub',
  'nextSub',
  'deps',
  'subs',
  '__vueParentComponent',
  'parent',
  'provides',
  'appContext',
  'config',
  'globalProperties'
]);
function __le_peerFromIso(c) {
  try {
    if (!c || typeof c !== 'object') return null;
    if (c.peer && c.peer.chatType && c.peer.peerUid) {
      let ct = Number(c.peer.chatType);
      let groupCode = c.peer.groupCode || c.groupCode || (c.header && c.header.groupCode) || '';
      let peerUid = String(c.peer.peerUid);
      if (groupCode && ct === 1) ct = 2;
      if (ct === 2) {
        if (!groupCode && peerUid) groupCode = peerUid;
        if (groupCode) peerUid = String(groupCode);
      }
      const peer = {
        chatType: ct,
        peerUid,
        guildId: c.peer.guildId || c.peer.channelId || c.guildId || ''
      };
      if (ct === 2 && groupCode) peer.groupCode = String(groupCode);
      return peer;
    }
    const chatType = c.chatType || (c.peer && c.peer.chatType) || c.type || c.scene || c.category;
    let groupCode = c.groupCode || (c.header && c.header.groupCode) || (c.peer && c.peer.groupCode);
    let peerUid =
      (c.peer && c.peer.peerUid) ||
      c.peerUid ||
      c.groupCode ||
      c.groupId ||
      c.groupUin ||
      c.groupUid ||
      c.tinyId ||
      c.uin ||
      c.uinStr ||
      (c.header && (c.header.peerUid || c.header.groupCode || c.header.uid));
    let ct = Number(chatType);
    if (groupCode && ct === 1) ct = 2;
    if (ct === 2) {
      if (!groupCode && peerUid) groupCode = peerUid;
      if (groupCode) peerUid = groupCode;
    }
    if (Number.isFinite(ct) && peerUid) {
      const peer = { chatType: ct, peerUid: String(peerUid), guildId: c.guildId || c.channelId || (c.peer && (c.peer.guildId || c.peer.channelId)) || '' };
      if (ct === 2 && groupCode) peer.groupCode = String(groupCode);
      return peer;
    }
  } catch (_) {}
  return null;
}
function __le_findCurAioDataIso(root) {
  try {
    if (!root || typeof root !== 'object') return null;
    const q = [root];
    const visited = new WeakSet();
    let head = 0;
    while (head < q.length && head < 6000) {
      const obj = q[head++];
      if (!obj || typeof obj !== 'object') continue;
      if (visited.has(obj)) continue;
      visited.add(obj);
      try {
        if (Object.prototype.hasOwnProperty.call(obj, 'curAioData')) {
          return { parent: obj, value: obj.curAioData };
        }
      } catch (_) {}
      try {
        for (const k of Object.keys(obj)) {
          if (__le_ignorePropsIso.has(k)) continue;
          const v = obj[k];
          if (!v || typeof v !== 'object') continue;
          if (v.nodeType && v.nodeName) continue;
          q.push(v);
        }
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}
function __le_findCurAioDataIsoLocal(root) {
  try {
    if (!root || typeof root !== 'object') return null;
    const q = [root];
    const visited = new WeakSet();
    let head = 0;
    while (head < q.length && head < 3000) {
      const obj = q[head++];
      if (!obj || typeof obj !== 'object') continue;
      if (visited.has(obj)) continue;
      visited.add(obj);
      try {
        if (Object.prototype.hasOwnProperty.call(obj, 'curAioData')) {
          return { parent: obj, value: obj.curAioData };
        }
      } catch (_) {}
      try {
        for (const k of Object.keys(obj)) {
          if (__le_ignorePropsIsoLocal.has(k)) continue;
          const v = obj[k];
          if (!v || typeof v !== 'object') continue;
          if (v.nodeType && v.nodeName) continue;
          q.push(v);
        }
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}
function __le_bfsFindPeerIso(root) {
  try {
    const q = [];
    const visited = new WeakSet();
    if (root && typeof root === 'object') q.push(root);
    let head = 0;
    while (head < q.length && head < 4000) {
      const obj = q[head++];
      if (!obj || typeof obj !== 'object') continue;
      if (visited.has(obj)) continue;
      visited.add(obj);
      try {
        if (obj.curAioData) {
          const p = __le_peerFromIso(obj.curAioData);
          if (p) return p;
        }
        if (obj.peer && obj.peer.chatType && obj.peer.peerUid) {
          const p2 = __le_peerFromIso(obj);
          if (p2) return p2;
        }
      } catch (_) {}
      try {
        for (const k of Object.keys(obj)) {
          if (__le_ignorePropsIso.has(k)) continue;
          const v = obj[k];
          if (!v || typeof v !== 'object') continue;
          if (v.nodeType && v.nodeName) continue;
          q.push(v);
        }
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}
function __le_bfsFindPeerIsoLocal(root) {
  try {
    const q = [];
    const visited = new WeakSet();
    if (root && typeof root === 'object') q.push(root);
    let head = 0;
    while (head < q.length && head < 2500) {
      const obj = q[head++];
      if (!obj || typeof obj !== 'object') continue;
      if (visited.has(obj)) continue;
      visited.add(obj);
      try {
        if (obj.curAioData) {
          const p = __le_peerFromIso(obj.curAioData);
          if (p) return p;
        }
        if (obj.peer && obj.peer.chatType && obj.peer.peerUid) {
          const p2 = __le_peerFromIso(obj);
          if (p2) return p2;
        }
      } catch (_) {}
      try {
        for (const k of Object.keys(obj)) {
          if (__le_ignorePropsIsoLocal.has(k)) continue;
          const v = obj[k];
          if (!v || typeof v !== 'object') continue;
          if (v.nodeType && v.nodeName) continue;
          q.push(v);
        }
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}
try { if (!window.__le_findCurAioData) window.__le_findCurAioData = __le_findCurAioDataIso; } catch (_) {}
try { if (!window.__le_bfsFindPeer) window.__le_bfsFindPeer = __le_bfsFindPeerIso; } catch (_) {}
function findSendButton(container) {
  if (!container) return null;
  dbg('findSendButton: start');
  // 1) 直接命中：常见的 aria/title/data-tooltip 文案与类名
  const sels = [
    'button[aria-label*="发送"], [role="button"][aria-label*="发送"]',
    'button[title*="发送"], [role="button"][title*="发送"]',
    'button[data-tooltip*="发送"], button[data-title*="发送"]',
    'button[aria-label*="Send"], [role="button"][aria-label*="Send"]',
    'button[title*="Send"], [role="button"][title*="Send"]',
    // 非 button 元素作为按钮
    '[aria-label*="发送"]', '[title*="发送"]', '[data-tooltip*="发送"]',
    '[aria-label*="Send"]', '[title*="Send"]', '[data-tooltip*="Send"]',
    // 常见类名/属性
    '[class*="send" i]', '[data-action*="send" i]', '[data-name*="send" i]', '[data-testid*="send" i]'
  ];
  for (const s of sels) {
    const b = container.querySelector(s);
    if (b && isVisible(b)) { dbg('findSendButton: found by', s); return b; }
  }
  // 2) 启发式查找
  try {
    const cand = Array.from(container.querySelectorAll('[class*="send" i], [data-action*="send" i], [data-name*="send" i], [data-testid*="send" i], button, [role="button"], [tabindex]'))
      .filter(el => isVisible(el));
    // 文案强匹配
    const strong = cand.find(el => {
      const t = (el.textContent || '').trim().toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const title = (el.getAttribute('title') || '').toLowerCase();
      const tooltip = (el.getAttribute('data-tooltip') || '').toLowerCase();
      return t.includes('发送') || aria.includes('发送') || title.includes('发送') || tooltip.includes('发送') ||
             t.includes('send') || aria.includes('send') || title.includes('send') || tooltip.includes('send');
    });
    if (strong) { dbg('findSendButton: found by heuristic strong'); return strong; }
    // 位置启发：容器右下角的可点击元素
    let best = null; let bestScore = -1;
    const cRect = (container.getBoundingClientRect && container.getBoundingClientRect()) || { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    for (const el of cand) {
      try {
        const r = el.getBoundingClientRect();
        if (!r || r.width === 0 || r.height === 0) continue;
        const txt = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '')).toLowerCase();
        if (/(emoji|表情|image|图片|file|文件|gif|截图|record|录音)/i.test(txt)) continue;
        let score = 0;
        score += Math.max(0, r.right - cRect.left);
        score += Math.max(0, cRect.bottom - r.bottom) * 0.5;
        if (r.width >= 20 && r.width <= 160) score += 80;
        if (r.height >= 20 && r.height <= 160) score += 80;
        if (el.querySelector('svg')) score += 20;
        if (score > bestScore) { bestScore = score; best = el; }
      } catch (_) {}
    }
    if (best) { dbg('findSendButton: found by heuristic position'); return best; }
  } catch (_) {}
  // 3) 兜底：遍历所有可点击元素
  try {
    const btns = Array.from(container.querySelectorAll('button,[role="button"],[tabindex]'));
    for (const b of btns) {
      const text = (b.textContent || '').trim();
      if (!isVisible(b)) continue;
      if (text.includes('发送') || text.toLowerCase().includes('send')) { dbg('findSendButton: found by text', text.slice(0, 16)); return b; }
    }
  } catch (_) {}
  dbg('findSendButton: not found');
  return null;
}
// 从 lite_tools 或全局 Vue store 等来源推断当前会话 peer（优先 lite_tools.getPeer）
function derivePeer() {
  const buildPeerFromCur = (c) => {
    try {
      if (!c) return null;
      if (c.peer && c.peer.chatType && c.peer.peerUid) {
        const peer = Object.assign({}, c.peer);
        if (peer.chatType === 2 || Number(peer.chatType) === 2) {
          const groupCode = peer.groupCode || c.groupCode || (c.header && c.header.groupCode);
          if (groupCode) peer.groupCode = groupCode;
        }
        return peer;
      }
      const chatType = c.chatType || (c.peer && c.peer.chatType);
      let groupCode = c.groupCode || (c.header && c.header.groupCode) || (c.peer && c.peer.groupCode);
      let peerUid = (c.header && (c.header.uid || c.header.peerUid)) || (c.peer && c.peer.peerUid) || c.peerUid || c.groupCode;
      let ct = Number(chatType);
      if (groupCode && ct === 1) ct = 2;
      if (ct === 2) {
        if (!groupCode && peerUid) groupCode = peerUid;
        if (groupCode) peerUid = groupCode;
      }
      if (Number.isFinite(ct) && peerUid) {
        const peer = { chatType: ct, peerUid: String(peerUid), guildId: c.guildId || '' };
        if (ct === 2 && groupCode) peer.groupCode = String(groupCode);
        return peer;
      }
    } catch (_) {}
    return null;
  };
  const findCurAio = (root) => {
    try {
      if (typeof window.__le_findCurAioData === 'function') return window.__le_findCurAioData(root);
    } catch (_) {}
    return __le_findCurAioDataIso(root);
  };
  const findCurAioLocal = (root) => {
    try {
      if (typeof window.__le_findCurAioDataLocal === 'function') return window.__le_findCurAioDataLocal(root);
    } catch (_) {}
    return __le_findCurAioDataIsoLocal(root);
  };
  const bfsFindPeer = (root) => {
    try {
      if (typeof window.__le_bfsFindPeer === 'function') return window.__le_bfsFindPeer(root);
    } catch (_) {}
    return __le_bfsFindPeerIso(root);
  };
  const bfsFindPeerLocal = (root) => {
    try {
      if (typeof window.__le_bfsFindPeerLocal === 'function') return window.__le_bfsFindPeerLocal(root);
    } catch (_) {}
    return __le_bfsFindPeerIsoLocal(root);
  };
  const findPeerFromEditor = () => {
    try {
      let el = (getEditorEl && getEditorEl()) || document.activeElement || null;
      let depth = 0;
      const getEditorContainer = () => {
        try {
          const ed = (getEditorEl && getEditorEl()) || el || null;
          if (!ed) return null;
          const c = ed.closest && ed.closest('.chat-input-area, .message-input-area, .aio, .three-col-layout__main, .two-col-layout__main, .q-input-area');
          return c || ed;
        } catch (_) {}
        return null;
      };
      const container = getEditorContainer();
      const componentInContainer = (inst) => {
        try {
          if (!container) return true;
          const eln = (inst && inst.vnode && inst.vnode.el) || (inst && inst.subTree && inst.subTree.el) || null;
          if (!eln) return true;
          if (container.contains && container.contains(eln)) return true;
          return false;
        } catch (_) {}
        return true;
      };
      const pushInst = (inst, roots) => {
        if (!inst) return;
        if (!componentInContainer(inst)) return;
        try { if (inst.proxy) roots.push(inst.proxy); } catch (_) {}
        try { if (inst.ctx) roots.push(inst.ctx); } catch (_) {}
        try { roots.push(inst); } catch (_) {}
        try {
          const st = inst.appContext && inst.appContext.config && inst.appContext.config.globalProperties && inst.appContext.config.globalProperties.$store;
          if (st && st.state) roots.push(st.state);
        } catch (_) {}
        try {
          const st2 = inst.appContext && inst.appContext.app && inst.appContext.app.config && inst.appContext.app.config.globalProperties && inst.appContext.app.config.globalProperties.$store;
          if (st2 && st2.state) roots.push(st2.state);
        } catch (_) {}
      };
      const addFromEl = (node, roots) => {
        if (!node) return;
        if (container && node !== container && container.contains && !container.contains(node)) return;
        try { pushInst(node.__vueParentComponent || node.__vue__ || node.__vue_app__ || null, roots); } catch (_) {}
        try {
          const arr = node.__VUE__;
          if (Array.isArray(arr)) {
            for (const inst of arr) pushInst(inst, roots);
          }
        } catch (_) {}
      };
      while (el && depth < 20) {
        const roots = [];
        addFromEl(el, roots);
        try {
          const wrap = el.closest && el.closest('.chat-input-area, .message-input-area, .aio, .three-col-layout__main, .two-col-layout__main');
          addFromEl(wrap, roots);
        } catch (_) {}
        for (const r of roots) {
          try {
            const found = findCurAioLocal(r);
            if (found && found.value) {
              const p = buildPeerFromCur(found.value);
              if (p) return p;
            }
          } catch (_) {}
          try {
            const p2 = bfsFindPeerLocal(r);
            if (p2) return p2;
          } catch (_) {}
        }
        el = el.parentElement;
        depth++;
      }
      try {
        const extras = document.querySelectorAll('.chat-input-area, .message-input-area, .aio, .three-col-layout__main, .two-col-layout__main');
        for (const ex of extras) {
          const roots = [];
          addFromEl(ex, roots);
          for (const r of roots) {
            try {
              const found = findCurAioLocal(r);
              if (found && found.value) {
                const p = buildPeerFromCur(found.value);
                if (p) return p;
              }
            } catch (_) {}
            try {
              const p2 = bfsFindPeerLocal(r);
              if (p2) return p2;
            } catch (_) {}
          }
        }
      } catch (_) {}
      try {
        const extras = document.querySelectorAll('.chat-input-area, .message-input-area, .aio, .three-col-layout__main, .two-col-layout__main');
        for (const ex of extras) {
          const roots = [];
          addFromEl(ex, roots);
          for (const r of roots) {
            try {
              const found = findCurAio(r);
              if (found && found.value) {
                const p = buildPeerFromCur(found.value);
                if (p) return p;
              }
            } catch (_) {}
            try {
              const p2 = bfsFindPeer(r);
              if (p2) return p2;
            } catch (_) {}
          }
        }
      } catch (_) {}
    } catch (_) {}
    return null;
  };
  const getHint = () => {
    try {
      const app = window.app;
      const c = app && (app.curAioData || app.mainAio);
      if (c && c.chatType) return { chatType: Number(c.chatType), groupCode: c.groupCode || (c.header && c.header.groupCode) || '' };
    } catch (_) {}
    try {
      const root = window.app && window.app.__vue_app__;
      const store = root && root.config && root.config.globalProperties && root.config.globalProperties.$store;
      const st = store && store.state;
      const candidates = [
        st && st.common_Aio && st.common_Aio.curAioData,
        st && st.aio_chatMsgArea && st.aio_chatMsgArea.curAioData,
        st && st.chat && st.chat.chatInfo,
        st && st.aio && st.aio.curAioData,
        st && st.common && st.common.curPeer,
        st && st.msg && st.msg.currentPeer,
      ];
      for (const c of candidates) {
        if (c && c.chatType) {
          const groupCode = c.groupCode || (c.header && c.header.groupCode) || '';
          let chatType = Number(c.chatType);
          if (groupCode && chatType === 1) chatType = 2;
          return { chatType, groupCode };
        }
      }
    } catch (_) {}
    return null;
  };
  const matchHint = (p, h) => {
    if (!p || !p.chatType || !p.peerUid) return false;
    if (!h || !h.chatType) return true;
    const ct = Number(p.chatType);
    const ht = Number(h.chatType);
    if (ct !== ht) {
      if (!h.groupCode) return true;
      return false;
    }
    if (ct === 2 && h.groupCode) return String(p.groupCode || p.peerUid) === String(h.groupCode);
    return true;
  };
  const hint = getHint();
  try {
    const ep = findPeerFromEditor();
    if (ep && matchHint(ep, hint)) return ep;
  } catch (_) {}
  try {
    const cp = window.__le_curPeer;
    if (cp && matchHint(cp, hint)) return cp;
  } catch (_) {}
  // 0) 最近缓存
  try {
    const lp = window.__le_lastPeer;
    if (lp && matchHint(lp, hint)) return lp;
  } catch (_) {}
  // 1) lite_tools.getPeer（若可用）
  try {
    if (window.lite_tools && typeof window.lite_tools.getPeer === 'function') {
      const p = window.lite_tools.getPeer();
      if (p && matchHint(p, hint)) return p;
    }
  } catch (_) {}
  // 2) window.app.curAioData / mainAio
  try {
    if (window.app) {
      const c = window.app.curAioData || window.app.mainAio;
      if (c) {
        if (c.peer && c.peer.chatType && c.peer.peerUid) {
          const peer = Object.assign({}, c.peer);
          if (peer.chatType === 2 || Number(peer.chatType) === 2) {
            const groupCode = peer.groupCode || c.groupCode || (c.header && c.header.groupCode);
            if (groupCode) peer.groupCode = groupCode;
          }
          return peer;
        }
        const chatType = c.chatType || (c.peer && c.peer.chatType);
        let groupCode = c.groupCode || (c.header && c.header.groupCode) || (c.peer && c.peer.groupCode);
        let peerUid = (c.header && (c.header.uid || c.header.peerUid)) || (c.peer && c.peer.peerUid) || c.peerUid || c.groupCode;
        let ct = Number(chatType);
        if (groupCode && ct === 1) ct = 2;
        if (ct === 2) {
          if (!groupCode && peerUid) groupCode = peerUid;
          if (groupCode) peerUid = groupCode;
        }
        if (Number.isFinite(ct) && peerUid) {
          const peer = { chatType: ct, peerUid: String(peerUid), guildId: c.guildId || '' };
          if (ct === 2 && groupCode) peer.groupCode = String(groupCode);
          return peer;
        }
      }
    }
  } catch (_) {}
  // 3) Vuex store 常见路径 (适配更多 store 结构)
  try {
    const root = window.app && window.app.__vue_app__;
    const store = root && root.config && root.config.globalProperties && root.config.globalProperties.$store;
    const st = store && store.state;
    if (st) {
      const candidates = [
        st.common_Aio && st.common_Aio.curAioData,
        st.aio_chatMsgArea && st.aio_chatMsgArea.curAioData,
        st.chat && st.chat.chatInfo, // 新增：部分版本可能的路径
        st.aio && st.aio.curAioData, // 新增
        st.common && st.common.curPeer, // 新增
        st.msg && st.msg.currentPeer,   // 新增
      ];
      for (const c of candidates) {
        if (!c) continue;
        if (c.peer && c.peer.chatType && c.peer.peerUid) {
          const peer = Object.assign({}, c.peer);
          if (peer.chatType === 2 || Number(peer.chatType) === 2) {
            const groupCode = peer.groupCode || c.groupCode || (c.header && c.header.groupCode);
            if (groupCode) peer.groupCode = groupCode;
          }
          return peer;
        }
        const chatType = c.chatType || (c.peer && c.peer.chatType);
        let groupCode = c.groupCode || (c.header && c.header.groupCode) || (c.peer && c.peer.groupCode);
        let peerUid = (c.header && (c.header.uid || c.header.peerUid)) || (c.peer && c.peer.peerUid) || c.peerUid || c.groupCode;
        let ct = Number(chatType);
        if (groupCode && ct === 1) ct = 2;
        if (ct === 2) {
          if (!groupCode && peerUid) groupCode = peerUid;
          if (groupCode) peerUid = groupCode;
        }
        if (Number.isFinite(ct) && peerUid) {
          const peer = { chatType: ct, peerUid: String(peerUid), guildId: c.guildId || '' };
          if (ct === 2 && groupCode) peer.groupCode = String(groupCode);
          return peer;
        }
      }
    }
  } catch (_) {}
  // 4) 最近一次 sendMsg 捕获
  try {
    const ls = window.__le_lastSendMsg && window.__le_lastSendMsg.peer;
    if (ls && ls.chatType && ls.peerUid) {
      try { window.__le_lastPeer = ls; } catch (_) {}
      return ls;
    }
  } catch (_) {}
  // 5) 深度扫描 store 中的消息元素
  try {
    const arr = (typeof scanStoreForMsgElements === 'function') ? scanStoreForMsgElements(5) : [];
    for (const r of arr) {
      const p1 = r && r.peer;
      if (p1 && p1.chatType && p1.peerUid) { try { window.__le_lastPeer = p1; } catch (_) {} return p1; }
      const parent = r && r.parent;
      if (parent && typeof parent === 'object') {
        const cands = [parent.peer, parent.contact, parent.talker, parent.chat, parent.session, parent.target].filter(Boolean);
        for (const c of cands) {
          if (c && c.chatType && c.peerUid) { try { window.__le_lastPeer = c; } catch (_) {} return c; }
        }
        const chatType = parent.chatType || (parent.peer && parent.peer.chatType);
        let groupCode = parent.groupCode || (parent.header && parent.header.groupCode) || (parent.peer && parent.peer.groupCode);
        let peerUid = (parent.header && (parent.header.uid || parent.header.peerUid)) || (parent.peer && parent.peer.peerUid) || parent.peerUid || parent.groupCode;
        let ct = Number(chatType);
        if (groupCode && ct === 1) ct = 2;
        if (ct === 2) {
          if (!groupCode && peerUid) groupCode = peerUid;
          if (groupCode) peerUid = groupCode;
        }
        if (Number.isFinite(ct) && peerUid) {
          const pp = { chatType: ct, peerUid: String(peerUid) };
          if (ct === 2 && groupCode) pp.groupCode = String(groupCode);
          try { window.__le_lastPeer = pp; } catch (_) {}
          return pp;
        }
      }
    }
  } catch (_) {}
  return null;
}
try { window.derivePeer = derivePeer; } catch (_) {}
async function derivePeerAsync() {
  try {
    if (typeof window.leMainRequest === 'function') {
      const p = await window.leMainRequest('getPeer');
      if (p && p.chatType && p.peerUid) {
        try { window.__le_lastPeer = p; } catch (_) {}
        return p;
      }
    }
  } catch (_) {}
  try {
    const p2 = derivePeer();
    if (p2 && p2.chatType && p2.peerUid) return p2;
  } catch (_) {}
  return null;
}
try { window.derivePeerAsync = derivePeerAsync; } catch (_) {}
function tryInsertImageToEditor(absPath) {
  try {
    const editor = getEditorEl();
    if (!editor) return false;
    // CKEditor 兼容性：跳过直接 DOM 插入，优先使用剪贴板粘贴（sendEmote）以便在输入框内可见
    try {
      const cls = (editor.className && typeof editor.className === 'string') ? editor.className : '';
      if (cls.includes('ck-editor__editable') || cls.includes('ck-content')) {
        dbg('tryInsertImageToEditor: detect CKEditor, skip DOM insert');
        return false;
      }
    } catch (_) {}
    const url = (window.localEmote && window.localEmote.toLocalUrl) ? window.localEmote.toLocalUrl(absPath) : absPath;
    if (!url) return false;
    return insertImageAtCursor(editor, url);
  } catch (_) { return false; }
}
try { window.__localEmoteInsertImage = tryInsertImageToEditor; } catch (_) {}
function dbg(...args) {
  try {
    const cfg = window.localEmote && window.localEmote.getConfig ? window.localEmote.getConfig() : null;
    if (cfg && cfg.debug) console.debug('[local_emotes]', ...args);
  } catch (_) {}
}
(function setupLESendMsgDebugHook() {
  try {
    const cfg = window.localEmote && window.localEmote.getConfig ? window.localEmote.getConfig() : null;
    if (!cfg || !cfg.debug) return;
    const lt = window.lite_tools;
    if (!lt || typeof lt.nativeCall !== 'function') return;
    if (lt.__le_sendmsg_hooked) return;
    const orig = lt.nativeCall.bind(lt);
    lt.nativeCall = async function(...args) {
      try {
        // 捕获所有 nativeCall 以便排查
        try {
          window.__le_nativeCalls = window.__le_nativeCalls || [];
          const d0 = (args && args[1]) || null;
          window.__le_nativeCalls.push(d0);
          if (window.__le_nativeCalls.length > 100) window.__le_nativeCalls.shift();
          try { window.__le_lastSendNative = d0; } catch (_) {}
        } catch (_) {}
        const detail = args && args[1];
        if (detail && detail.cmdName === 'nodeIKernelMsgService/sendMsg') {
          try {
            const payload = detail && detail.payload ? detail.payload[0] : null;
            const peer = payload && payload.peer;
            const elems = payload && payload.msgElements ? payload.msgElements : [];
            const brief = (elems || []).map((e) => {
              const t = e && e.elementType;
              const elementKeys = e ? Object.keys(e).filter(k => /Element$/.test(k)) : [];
              const which = elementKeys.find(Boolean);
              const inner = which && e[which] ? Object.keys(e[which]) : [];
              return { elementType: t, elementKeys, innerKeys: inner };
            });
            dbg('sendMsg payload peer=', peer);
            dbg('sendMsg payload elements brief=', brief);
            try { window.__le_lastSendMsg = { peer, brief, msgElements: elems, payload }; } catch (_) {}
          } catch (err) { dbg('sendMsg debug parse error', err && err.message); }
        }
      } catch (_) {}
      return orig(...args);
    };
    lt.__le_sendmsg_hooked = true;
    dbg('sendMsg debug hook installed');
  } catch (_) {}
})();

// 运行时按需安装（当用户动态开启 debug 后仍可捕捉 sendMsg）
function ensureLESendMsgDebugHookInstalled() {
  try {
    const cfg = window.localEmote && window.localEmote.getConfig ? window.localEmote.getConfig() : null;
    if (!cfg || !cfg.debug) return;
    const lt = window.lite_tools;
    if (!lt || typeof lt.nativeCall !== 'function') return;
    if (lt.__le_sendmsg_hooked || window.__le_sendmsg_hooked) return;
    const orig = lt.nativeCall.bind(lt);
    const wrapper = async function(...args) {
      try {
        // 捕获所有 nativeCall 以便排查
        try {
          window.__le_nativeCalls = window.__le_nativeCalls || [];
          const d0 = (args && args[1]) || null;
          window.__le_nativeCalls.push(d0);
          if (window.__le_nativeCalls.length > 100) window.__le_nativeCalls.shift();
          try { window.__le_lastSendNative = d0; } catch (_) {}
        } catch (_) {}
        const detail = args && args[1];
        if (detail && detail.cmdName === 'nodeIKernelMsgService/sendMsg') {
          try {
            const payload = detail && detail.payload ? detail.payload[0] : null;
            const peer = payload && payload.peer;
            const elems = payload && payload.msgElements ? payload.msgElements : [];
            const brief = (elems || []).map((e) => {
              const t = e && e.elementType;
              const elementKeys = e ? Object.keys(e).filter(k => /Element$/.test(k)) : [];
              const which = elementKeys.find(Boolean);
              const inner = which && e[which] ? Object.keys(e[which]) : [];
              return { elementType: t, elementKeys, innerKeys: inner };
            });
            dbg('sendMsg payload peer=', peer);
            dbg('sendMsg payload elements brief=', brief);
            try { window.__le_lastSendMsg = { peer, brief, msgElements: elems, payload }; } catch (_) {}
          } catch (err) { dbg('sendMsg debug parse error', err && err.message); }
        }
      } catch (_) {}
      return orig(...args);
    };
    let done = false;
    // 1) 直接赋值尝试
    try { lt.nativeCall = wrapper; done = (lt.nativeCall === wrapper); } catch (_) {}
    // 2) defineProperty 尝试
    if (!done) {
      let desc = null; try { desc = Object.getOwnPropertyDescriptor(lt, 'nativeCall'); } catch (_) {}
      if (desc && (desc.configurable || desc.writable)) {
        try { Object.defineProperty(lt, 'nativeCall', { configurable: true, enumerable: true, writable: true, value: wrapper }); done = (lt.nativeCall === wrapper); } catch (_) {}
      }
    }
    // 3) Proxy 包裹回退
    if (!done && window && window.lite_tools === lt) {
      try {
        const proxy = new Proxy(lt, { get(t, p, r) { if (p === 'nativeCall') return wrapper; return Reflect.get(t, p, r); } });
        try { window.lite_tools = proxy; } catch (_) {}
        done = (window.lite_tools && window.lite_tools.nativeCall === wrapper);
      } catch (_) {}
    }
    if (done) {
      try { lt.__le_sendmsg_hooked = true; } catch (_) {}
      try { window.__le_sendmsg_hooked = true; } catch (_) {}
      dbg('sendMsg debug hook installed (lazy/robust)');
    } else {
      // 常见情况：lite_tools 的 nativeCall 被冻结或只读，这不是错误，仅意味着无法注入调试钩子
      // dbg('sendMsg debug hook install failed (lazy): nativeCall is non-writable');
    }
  } catch (_) {}
}
try { window.__le_installSendMsgHook = ensureLESendMsgDebugHookInstalled; } catch (_) {}

// 官方消息元素转换与发送
async function le_convertMessage(message) {
try { window.le_convertMessage = le_convertMessage; } catch (_) {}
  const lt = (globalThis && globalThis.lite_tools) || window.lite_tools;
  switch ((message && message.type) || '') {
    case 'text':
      return {
        elementType: 1,
        elementId: '',
        textElement: {
          content: message.content || '',
          atType: 0,
          atUid: '',
          atTinyId: '',
          atNtUid: '',
        },
      };
    case 'marketFace': {
      const { emojiPackageId, emojiId, key, faceName } = message;
      if (!emojiPackageId || !emojiId) return null;
      return {
        elementType: 6,
        elementId: '',
        marketFaceElement: {
          itemType: 6,
          faceInfo: 1,
          emojiPackageId: String(emojiPackageId),
          emojiId: String(emojiId),
          key: key || '',
          faceName: faceName || '[表情]'
        }
      };
    }
    case 'image': {
      const path = message.path;
      if (!lt || !path) return null;
      try {
        // 预取文件类型用于判断 GIF 特殊分支
        var primFileType = await lt.nativeCall(
          { type: 'request', eventName: 'FileApi' },
          { cmdName: 'getFileType', cmdType: 'invoke', payload: [path] },
          true
        );
      } catch (_) {}
      const isGif = !!(primFileType && primFileType.ext === 'gif') || /\.gif$/i.test(String(path || ''));
      let copyFile = null;
      try {
        // elementSubType: 1 (常规/GIF), 5 (可能已废弃)
        // 统一使用 1 以确保兼容性，picType=2000 会处理显示逻辑
        copyFile = await lt.nativeCall(
          { type: 'request', eventName: 'ntApi' },
          { cmdName: 'nodeIKernelMsgService/copyFileWithDelExifInfo', cmdType: 'invoke', payload: [ { sourcePath: path, elementSubType: 1 }, null ] },
          true
        );
      } catch (e) { dbg('copyFileWithDelExifInfo failed', e && e.message); }
      const newPath = (copyFile && copyFile.newPath) || path;
      let fileType;
      try {
        fileType = await lt.nativeCall(
          { type: 'request', eventName: 'FileApi' },
          { cmdName: 'getFileType', cmdType: 'invoke', payload: [newPath] },
          true
        );
      } catch (_) {
        try {
          fileType = await lt.nativeCall(
            { type: 'request', eventName: 'FileApi' },
            { cmdName: 'getFileType', cmdType: 'invoke', payload: [path] },
            true
          );
        } catch (e2) { dbg('fileType fallback failed', e2 && e2.message); }
      }
      let imageSize;
      try {
        imageSize = await lt.nativeCall(
          { type: 'request', eventName: 'FileApi' },
          { cmdName: 'getImageSizeFromPath', cmdType: 'invoke', payload: [newPath] },
          true
        );
      } catch (_) {
        try {
          imageSize = await lt.nativeCall(
            { type: 'request', eventName: 'FileApi' },
            { cmdName: 'getImageSize', cmdType: 'invoke', payload: [newPath] },
            true
          );
        } catch (e2) { dbg('imageSize fallback failed', e2 && e2.message); }
      }
      if (!imageSize || !Number.isFinite(imageSize.width) || !Number.isFinite(imageSize.height)) {
        try {
          imageSize = await lt.nativeCall(
            { type: 'request', eventName: 'FileApi' },
            { cmdName: 'getImageSizeFromPath', cmdType: 'invoke', payload: [path] },
            true
          );
        } catch (_) {}
      }
      let md5Hex = '';
      try {
        md5Hex = await lt.nativeCall(
          { type: 'request', eventName: 'FileApi' },
          { cmdName: 'getFileMd5', cmdType: 'invoke', payload: [newPath] },
          true
        );
      } catch (_) {
        try {
          md5Hex = await lt.nativeCall(
            { type: 'request', eventName: 'FileApi' },
            { cmdName: 'getFileMd5', cmdType: 'invoke', payload: [path] },
            true
          );
        } catch (e2) { dbg('md5 fallback failed', e2 && e2.message); }
      }
      let fileSize;
      try {
        fileSize = await lt.nativeCall(
          { type: 'request', eventName: 'FileApi' },
          { cmdName: 'getFileSize', cmdType: 'invoke', payload: [newPath] },
          true
        );
      } catch (_) {
        try {
          fileSize = await lt.nativeCall(
            { type: 'request', eventName: 'FileApi' },
            { cmdName: 'getFileSize', cmdType: 'invoke', payload: [path] },
            true
          );
        } catch (e2) { dbg('fileSize fallback failed', e2 && e2.message); }
      }
      const getFileName = (p) => {
        if (typeof p !== 'string') return '';
        const trimmed = p.replace(/[\\/]+$/, '');
        if (trimmed === '') return '';
        const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
        const name = idx === -1 ? trimmed : trimmed.slice(idx + 1);
        if (/^[A-Za-z]:$/.test(name)) return '';
        return name;
      };

      // Enhanced logging for MD5 debug
      try {
        dbg('le_convertMessage: image meta', {
          copyFileMd5: copyFile && copyFile.md5,
          fallbackMd5: md5Hex,
          fileSize,
          imageSize
        });
      } catch (_) {}

      // 反向研究结论：
      // 要让本地图片显示为无气泡的“原生表情”，需要：
      // 1. picSubType = 1 (Emoji/Face)
      // 2. picType = 2000 (伪装成 GIF/动图，强制客户端按表情渲染)
      // 3. original = false (非原图模式)
      // 4. copyFile 时 elementSubType = 1 (常规富媒体通道，5 可能已废弃)
      
      const isFaceMode = !!(message.asFace); 
      const rawSubType = (typeof message.picSubType === 'number' ? message.picSubType : (isFaceMode ? 1 : 0));
      
      let picWidth = imageSize && imageSize.width;
      let picHeight = imageSize && imageSize.height;
      if (isFaceMode && Number.isFinite(picWidth) && Number.isFinite(picHeight)) {
        const faceMax = 128;
        const maxDim = Math.max(1, picWidth, picHeight);
        const scale = Math.min(1, faceMax / maxDim);
        picWidth = Math.max(1, Math.round(picWidth * scale));
        picHeight = Math.max(1, Math.round(picHeight * scale));
      }
      const picElement = {
        md5HexStr: (copyFile && copyFile.md5) || md5Hex, 
        picWidth,
        picHeight,
        fileName: getFileName(newPath),
        fileSize: fileSize,
        original: isGif ? true : (isFaceMode ? false : true),
        picType: (isGif || (fileType && fileType.ext === 'gif') || isFaceMode) ? 2000 : 1000,
        picSubType: rawSubType,
        sourcePath: newPath,
        fileUuid: '',
        fileSubId: '',
        thumbFileSize: 0,
        thumbPath: undefined,
        summary: isFaceMode ? '[表情]' : '[图片]',
      };
      return { elementType: 2, elementId: '', extBufForUI: new Uint8Array(), picElement };
    }
    default:
      return null;
  }
}

async function le_sendMessage(peer, messages) {
try { window.le_sendMessage = le_sendMessage; } catch (_) {}
  // 优先通过主世界服务发送（若存在 leMainRequest），以兼容隔离世界无法直接访问 lite_tools 的情况
  try {
    if (typeof window.leMainRequest === 'function') {
      const res = await window.leMainRequest('sendMessage', { peer, messages });
      if (res) return res;
    }
  } catch (_) {}
  const lt = (globalThis && globalThis.lite_tools) || window.lite_tools;
  if (!lt || !peer || !messages || !messages.length) throw new Error('lite_tools/peer/messages missing');
  const converted = (await Promise.all(messages.map((m) => le_convertMessage(m)))).filter(Boolean);
  if (!converted.length) throw new Error('le_sendMessage: no valid msgElements');
  return lt.nativeCall(
    { eventName: 'ntApi', type: 'request' },
    {
      cmdName: 'nodeIKernelMsgService/sendMsg',
      cmdType: 'invoke',
      payload: [
        {
          msgId: '0',
          peer,
          msgElements: converted,
          msgAttributeInfos: new Map(),
        },
        null,
      ],
    }
  );
}

// 新增：扫描全局 store 中的消息元素结构（仅调试模式可用）
function scanStoreForMsgElements(maxResults = 8) {
  try {
    const cfg = window.localEmote && window.localEmote.getConfig ? window.localEmote.getConfig() : null;
    if (!cfg || !cfg.debug) {
      try { window.__le_scanStoreResults = []; } catch (_) {}
      return [];
    }

    // 收集候选根：store.state、Vue DevTools apps、window.app 及回退节点
    const roots = [];
    try {
      const store = window.app && window.app.__vue_app__ && window.app.__vue_app__.config && window.app.__vue_app__.config.globalProperties && window.app.__vue_app__.config.globalProperties.$store;
      if (store && store.state) roots.push({ v: store.state, path: 'store.state' });
    } catch (_) {}

    // 新增：尝试从 DOM 获取 Vue 实例
    try {
      const appEl = document.getElementById('app');
      if (appEl && appEl.__vue_app__) {
        roots.push({ v: appEl.__vue_app__, path: '#app.__vue_app__' });
        const st = appEl.__vue_app__.config?.globalProperties?.$store;
        if (st && st.state) roots.push({ v: st.state, path: '#app.store.state' });
      }
    } catch (_) {}

    try {
      const hook = window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
      if (hook && Array.isArray(hook.apps)) {
        hook.apps.forEach((entry, idx) => {
          const app = entry && (entry.app || entry);
          const stores = [
            app && app.config && app.config.globalProperties && app.config.globalProperties.$store,
            app && app._context && app._context.config && app._context.config.globalProperties && app._context.config.globalProperties.$store,
            app && app._instance && app._instance.appContext && app._instance.appContext.config && app._instance.appContext.config.globalProperties && app._instance.appContext.config.globalProperties.$store,
            app && app._instance && app._instance.proxy && app._instance.proxy.$store,
          ].filter(Boolean);
          stores.forEach((st, j) => { try { if (st && st.state) roots.push({ v: st.state, path: `devtools.apps[${idx}].store[${j}].state` }); } catch (_) {} });
          const extras = [
            { v: app, path: `devtools.apps[${idx}].app` },
            { v: app && app._instance, path: `devtools.apps[${idx}].app._instance` },
            { v: app && app._context, path: `devtools.apps[${idx}].app._context` },
            { v: app && app.config, path: `devtools.apps[${idx}].app.config` },
            { v: app && app.config && app.config.globalProperties, path: `devtools.apps[${idx}].app.config.globalProperties` },
          ];
          extras.forEach(p => { if (p.v) roots.push(p); });
        });
      }
    } catch (_) {}

    try { if (window.app && window.app.__vue_app__) roots.push({ v: window.app.__vue_app__, path: 'window.app.__vue_app__' }); } catch (_) {}
    try { if (window.app) roots.push({ v: window.app, path: 'window.app' }); } catch (_) {}
    try { const ca = window.app && window.app.curAioData; if (ca && typeof ca === 'object') roots.push({ v: ca, path: 'window.app.curAioData' }); } catch (_) {}

    if (roots.length === 0) {
      dbg('scanStore: no vue store; no devtools apps; fallback roots= 0');
    } else {
      dbg('scanStore: candidate roots=', roots.length);
    }

    // 尝试寻找 curAioData (BFS)
    if (maxResults <= 8) { // 仅在寻找 peer (通常为5) 或调试时尝试
       try {
         const visited = new WeakSet();
         const q = [];
         roots.forEach(r => { if (r.v) q.push(r.v); });
         if (window.app) q.push(window.app);
         
         let head = 0;
         while(head < q.length && head < 5000) { // 限制搜索步数
            const obj = q[head++];
            if (!obj || typeof obj !== 'object') continue;
            if (visited.has(obj)) continue;
            visited.add(obj);
            
            // 检查 curAioData
             const ca = obj.curAioData;
             if (ca && (ca.chatType || (ca.peer && ca.peer.chatType))) {
                 const uid = (ca.header && ca.header.uid) || ca.peerUid || (ca.peer && ca.peer.peerUid);
                 const cType = ca.chatType || (ca.peer && ca.peer.chatType);
                 if (uid && cType) {
                     dbg('scanStore: found curAioData via BFS');
                     return [{ peer: { peerUid: uid, chatType: cType, guildId: ca.guildId||'' } }];
                 }
             }
             
             // 检查 peer
             if (obj.peerUid && obj.chatType) {
                 // 排除不完整的
                  dbg('scanStore: found peer-like object via BFS');
                  return [{ peer: { peerUid: obj.peerUid, chatType: obj.chatType, guildId: obj.guildId||'' } }];
             }

            // 继续搜索子属性
            const keys = Object.keys(obj);
            for(const k of keys) {
                const v = obj[k];
                if (v && typeof v === 'object' && !visited.has(v)) {
                    // 简单的启发式过滤：忽略 DOM 节点和巨大数组
                    if (v instanceof Element) continue;
                    q.push(v);
                }
            }
         }
       } catch(e) { dbg('scanStore: curAioData BFS error', e); }
    }

    const results = [];
    const visited = new Set();
    const queue = [];
    roots.forEach(r => { if (r && r.v && typeof r.v === 'object') queue.push({ v: r.v, path: r.path, depth: 0 }); });

    if (queue.length === 0) {
      try {
        const ca = window.app && window.app.curAioData;
        if (ca && typeof ca === 'object') {
          queue.push({ v: ca, path: 'window.app.curAioData', depth: 0 });
          dbg('scanStore: fallback to window.app.curAioData');
        }
      } catch (_) {}
    }

    const MAX_NODES = 6000;
    const MAX_DEPTH = 7;

    function toBrief(e) {
      try {
        const t = e && e.elementType;
        const elementKeys = e ? Object.keys(e).filter(k => /Element$/.test(k)) : [];
        const which = elementKeys.find(Boolean);
        const inner = which && e[which] ? Object.keys(e[which]) : [];
        return { elementType: t, elementKeys, innerKeys: inner };
      } catch (_) { return { elementType: undefined, elementKeys: [], innerKeys: [] }; }
    }

    function looksLikeElementsArray(arr) {
      try {
        if (!Array.isArray(arr) || !arr.length) return false;
        const end = Math.min(arr.length, 5);
        for (let i = 0; i < end; i++) {
          const el = arr[i];
          if (el && typeof el === 'object') {
            const hasType = ('elementType' in el);
            const hasInner = Object.keys(el).some(k => /Element$/.test(k));
            if (hasType || hasInner) return true;
          }
        }
        return false;
      } catch (_) { return false; }
    }

    let visitedCount = 0;
    while (queue.length && visitedCount < MAX_NODES && results.length < maxResults) {
      const { v, path, depth } = queue.shift();
      if (!v || typeof v !== 'object') continue;
      if (visited.has(v)) continue;
      visited.add(v);
      visitedCount++;

      try {
        if (Array.isArray(v)) {
          // 若当前节点本身就是元素数组
          if (looksLikeElementsArray(v)) {
            results.push({ path, brief: v.map(toBrief), ref: v, parent: null, peer: undefined });
          }
          // 倒序优先扫描最近项
          for (let i = v.length - 1; i >= Math.max(0, v.length - 8); i--) {
            const item = v[i];
            if (item && typeof item === 'object') {
              const elems = item.msgElements || item.elements || item.elem || item.msgElementList || item.elementList || null;
              if (looksLikeElementsArray(elems)) {
                const guessedPeer = item && (item.peer || item.contact || item.talker || item.chat || item.session || item.target || null);
                results.push({ path: `${path}[${i}]`, brief: elems.map(toBrief), ref: elems, parent: item, peer: guessedPeer });
                if (results.length >= maxResults) break;
              }
              if (depth < MAX_DEPTH) {
                for (const k of Object.keys(item)) {
                  const child = item[k];
                  if (child && typeof child === 'object') queue.push({ v: child, path: `${path}[${i}].${k}`, depth: depth + 1 });
                }
              }
            }
          }
        } else {
          const maybeElems = v.msgElements || v.elements || v.elem || v.msgElementList || v.elementList || null;
          if (looksLikeElementsArray(maybeElems)) {
            let key = null;
            if (v.msgElements) key = 'msgElements';
            else if (v.elements) key = 'elements';
            else if (v.elem) key = 'elem';
            else if (v.msgElementList) key = 'msgElementList';
            else if (v.elementList) key = 'elementList';
            const guessedPeer = v && (v.peer || v.contact || v.talker || v.chat || v.session || v.target || null);
            results.push({ path: key ? `${path}.${key}` : path, brief: maybeElems.map(toBrief), ref: maybeElems, parent: v, peer: guessedPeer });
          }
          // 额外：扫描对象里的任意数组属性，若“像元素数组”则也收集
          for (const k of Object.keys(v)) {
            const child = v[k];
            if (Array.isArray(child) && looksLikeElementsArray(child)) {
              const guessedPeer = v && (v.peer || v.contact || v.talker || v.chat || v.session || v.target || null);
              results.push({ path: `${path}.${k}`, brief: child.map(toBrief), ref: child, parent: v, peer: guessedPeer });
            }
          }
          if (depth < MAX_DEPTH) {
            for (const k of Object.keys(v)) {
              const child = v[k];
              if (child && typeof child === 'object') queue.push({ v: child, path: `${path}.${k}`, depth: depth + 1 });
            }
          }
        }
      } catch (_) {}
    }

    if (results.length) {
      dbg('scanStore: found candidates=', results.length);
      for (let i = 0; i < Math.min(results.length, 3); i++) {
        const r = results[i];
        dbg(`scanStore[${i}] path=`, r.path);
        dbg(`scanStore[${i}] brief=`, r.brief);
      }
    } else {
      dbg('scanStore: no candidates');
    }

    try { window.__le_scanStoreResults = results; } catch (_) {}
    return results;
  } catch (e) {
    dbg('scanStore error', e && e.message);
    try { window.__le_scanStoreResults = []; } catch (_) {}
    return [];
  }
}
// 暴露给控制台
try { if (isDebugConfigEnabled()) window.scanStoreForMsgElements = scanStoreForMsgElements; } catch (_) {}

// === 辅助函数结束 ===

function renderSettings(view) {
  // 已废弃：设置界面改为从 src/settings.html 加载
}

// 悬浮面板构建（改为 QQNT 风格卡片：左侧分组图标，右侧表情网格）
function buildOverlay() {
  injectLEStylesOnce();
  injectLEAnimStylesOnce();

  const wrap = document.createElement('div');
  wrap.id = 'local-emote-overlay';
  wrap.className = 'le-overlay';
  wrap.style.position = 'fixed';
  wrap.style.display = 'none';
  wrap.style.left = '0px';
  wrap.style.top = '0px';
  wrap.style.zIndex = '9999';
  const guardSelection = () => {
    try { ensureSelectionAtEditorEnd(getEditorEl()); } catch (_) {}
  };
  wrap.addEventListener('pointerdown', guardSelection, true);
  wrap.addEventListener('mousedown', guardSelection, true);

  const card = document.createElement('div');
  card.className = 'le-qqnt-card';

  // 移除旧的左侧分组栏，采用上下分区布局
  const content = document.createElement('div');
  content.className = 'le-qqnt-content';

  // 可滚动区域（包含“历史表情”和“本地表情”两个网格）
  const scroll = document.createElement('div');
  scroll.className = 'le-scroll';
  const searchRow = document.createElement('div');
  searchRow.className = 'le-search-row';
  const searchInput = document.createElement('input');
  searchInput.className = 'le-input le-search';
  searchInput.type = 'search';
  searchInput.placeholder = '搜索表情、文件名或目录';
  searchInput.spellcheck = false;
  searchRow.appendChild(searchInput);

  // 历史表情 Section
  const titleRecent = document.createElement('div');
  titleRecent.className = 'le-section-title';
  titleRecent.textContent = '历史表情';
  const recentGrid = document.createElement('div');
  recentGrid.className = 'le-grid le-grid-recent';

  // 本地表情 Section
  const titleMain = document.createElement('div');
  titleMain.className = 'le-section-title';
  titleMain.textContent = '本地表情';

  const grid = document.createElement('div');
  grid.className = 'le-grid';
  grid.setAttribute('role', 'listbox');
  try {
    const cc = window.localEmote.getConfig();
    const n = Number.isFinite(cc.gridCols) ? Math.max(2, Math.min(12, Math.floor(cc.gridCols))) : 6;
    grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    recentGrid.style.gridTemplateColumns = `repeat(${Math.max(2, Math.min(12, n))}, 1fr)`;
  } catch (_) {}

  // 新增：底部表情包选择栏（横向滚动）
  const packsBar = document.createElement('div');
  packsBar.className = 'le-packs-bar';
  packsBar.addEventListener('wheel', (ev) => {
    if (!ev.ctrlKey && !ev.shiftKey) {
      if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) {
        packsBar.scrollLeft += ev.deltaY;
        ev.preventDefault();
      }
    }
  }, { passive: false });

  // 组装 DOM
  scroll.appendChild(titleRecent);
  scroll.appendChild(recentGrid);
  scroll.appendChild(titleMain);
  scroll.appendChild(grid);
  content.appendChild(searchRow);
  content.appendChild(scroll);
  content.appendChild(packsBar);
  card.appendChild(content);
  wrap.appendChild(card);

  // 状态
  let currentList = [];
  let searchQuery = "";
  let activeIndex = -1;
  let selectedCat = '__recent__';
  let categoriesCache = [];
  let packsCache = [];
  let renderRecentGridLock = false;
  let renderRecentGridQueued = false;
  let renderRecentGridPromise = null;
  const RENDER_RECENT_THROTTLE = 200;
  let renderGridLock = false;
  let renderGridQueued = false;
  let renderGridPromise = null;
  const RENDER_GRID_THROTTLE = 200;
  let loadPacksLock = false;
  let loadPacksQueued = false;
  let loadPacksPromise = null;
  const LOAD_PACKS_THROTTLE = 300;
  let showLock = false;
  let showQueued = false;
  let showPromise = null;
  let showAnchorRect = null;
  const SHOW_THROTTLE = 200;
  let refreshLock = false;
  let refreshQueued = false;
  let refreshPromise = null;
  const REFRESH_THROTTLE = 200;

  let preview = document.getElementById('local-emote-hover-preview');
  let previewImg = preview ? preview.querySelector('img') : null;
  if (!preview) {
    preview = document.createElement('div');
    preview.id = 'local-emote-hover-preview';
    previewImg = document.createElement('img');
    preview.appendChild(previewImg);
    document.body.appendChild(preview);
  } else if (!previewImg) {
    previewImg = document.createElement('img');
    preview.appendChild(previewImg);
  }
  let previewVisible = false;
  let previewSrc = '';
  function updatePreviewPos(ev) {
    if (!preview || !previewVisible || !ev) return;
    const pad = 12;
    let left = ev.clientX + pad;
    let top = ev.clientY + pad;
    const rect = preview.getBoundingClientRect();
    if (left + rect.width + pad > window.innerWidth) {
      left = Math.max(pad, ev.clientX - rect.width - pad);
    }
    if (top + rect.height + pad > window.innerHeight) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    preview.style.left = `${left}px`;
    preview.style.top = `${top}px`;
  }
  function showPreview(src, ev) {
    try {
      const cfg = window.localEmote.getConfig();
      if (cfg && cfg.hoverPreview === false) return;
    } catch (_) {}
    if (!preview || !previewImg || !src) return;
    if (previewSrc !== src) {
      previewImg.src = src;
      previewSrc = src;
    }
    preview.style.display = 'block';
    previewVisible = true;
    updatePreviewPos(ev);
  }
  function hidePreview() {
    if (!preview) return;
    preview.style.display = 'none';
    previewVisible = false;
  }
  function bindPreview(card, src) {
    if (!card || !src) return;
    card.addEventListener('mouseenter', (ev) => showPreview(src, ev));
    card.addEventListener('mousemove', (ev) => updatePreviewPos(ev));
    card.addEventListener('mouseleave', () => hidePreview());
  }

  // 新增：根据当前选中分组更新主标题（根目录=“本地表情”，子文件夹=文件夹名）
  function updateMainTitle() {
    try {
      dbg('updateMainTitle: selectedCat=', selectedCat);
      let name = '本地表情';
      if (typeof selectedCat === 'string' && selectedCat.startsWith('__dir__|')) {
        const dir = selectedCat.slice('__dir__|'.length);
        const pack = Array.isArray(packsCache) ? packsCache.find(p => (p.dir || p.path || '') === dir) : null;
        if (pack && pack.name) name = pack.name;
        dbg('updateMainTitle: dir=', dir, 'packName=', pack && pack.name);
      } else if (typeof selectedCat === 'string' && selectedCat && selectedCat !== '__recent__') {
        name = selectedCat;
      }
      titleMain.textContent = name;
      dbg('updateMainTitle: set to', name);
      // 同步更新左侧工具栏按钮的提示文案
      if (toolbarBtnRef) {
        toolbarBtnRef.title = name;
        toolbarBtnRef.setAttribute('aria-label', name);
      }
    } catch (_) {}
  }

  // 根据配置返回应显示的文件名；未开启则返回 null
  function displayNameFor(it) {
    try {
      const cfg = window.localEmote.getConfig ? window.localEmote.getConfig() : null;
      if (!cfg || !cfg.showFileName) return null;
      const raw = (it && (it.name || it.filename || '')) || '';
      // 去除扩展名
      let base = raw;
      const dot = base.lastIndexOf('.');
      if (dot > 0) base = base.slice(0, dot);
      // 截断到 6 个字符
      const MAX = 6;
      if (base.length > MAX) base = base.slice(0, MAX);
      return base;
    } catch (_) { return null; }
  }

  function filterItems(items) {
    const query = String(searchQuery || '').trim().toLowerCase();
    if (!query) return Array.isArray(items) ? items : [];
    return (Array.isArray(items) ? items : []).filter((it) => {
      const text = [
        it && it.name,
        it && it.baseName,
        it && it.path,
        it && it.absPath,
        it && it.relativePath,
      ].filter(Boolean).join(' ').toLowerCase();
      return text.includes(query);
    });
  }

  function appendEmptyState(target, text) {
    const empty = document.createElement('div');
    empty.className = 'le-empty';
    empty.textContent = text;
    target.appendChild(empty);
  }

  function getCards() { return Array.from(grid.querySelectorAll('.le-card')); }
  function getCols() {
    const cs = getComputedStyle(grid).gridTemplateColumns || '';
    const n = cs.split(' ').filter(Boolean).length;
    return Math.max(1, n || 6);
  }
  function updateActiveClasses() {
    const cards = getCards();
    cards.forEach((c, i) => {
      const isAct = i === activeIndex;
      c.classList.toggle('active', isAct);
      c.setAttribute('aria-selected', isAct ? 'true' : 'false');
    });
  }
  function applyActiveAfterRender() {
    const cards = getCards();
    if (cards.length === 0) { activeIndex = -1; return; }
    if (activeIndex < 0 || activeIndex >= cards.length) activeIndex = 0;
    updateActiveClasses();
    try { cards[activeIndex].scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
  }
  function moveActive(delta) {
    const cards = getCards();
    if (cards.length === 0) return;
    let next = activeIndex;
    if (delta === Infinity) next = cards.length - 1;
    else if (delta === -Infinity) next = 0;
    else next = Math.max(0, Math.min(cards.length - 1, (activeIndex < 0 ? 0 : activeIndex) + delta));
    if (next === activeIndex) return;
    activeIndex = next;
    updateActiveClasses();
    try { cards[activeIndex].scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
  }
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value || "";
    activeIndex = -1;
    renderRecentGrid();
    renderGrid();
  });

  // 新增：渲染“历史表情”
  async function renderRecentGrid() {
    if (renderRecentGridLock) { renderRecentGridQueued = true; return renderRecentGridPromise; }
    renderRecentGridLock = true;
    renderRecentGridPromise = (async () => {
      dbg('renderRecentGrid: start');
      if (!recentGrid) return;
      recentGrid.innerHTML = '';
      let all = [];
      try { all = await window.localEmote.listRecent(); dbg('renderRecentGrid: got', all.length, 'items'); } catch (e) { dbg('renderRecentGrid: listRecent error', e && e.message); all = []; }
      all = filterItems(all);
      if (all.length === 0) {
        appendEmptyState(recentGrid, searchQuery ? '最近使用中没有匹配的表情' : '暂无最近使用');
      }
      for (let idx = 0; idx < all.length; idx++) {
        const it = all[idx];
        const card = document.createElement('div');
        card.className = 'le-card' + (it.pinned ? ' pinned' : '');
        card.setAttribute('role', 'option');
        card.setAttribute('tabindex', '-1');

        const img = document.createElement('img');
        img.className = 'le-img';
        const imgUrl = it.url || it.preview || '';
        img.src = imgUrl; img.alt = it.name || '';
        bindPreview(card, imgUrl);

        const dn = displayNameFor(it);
        let name;
        if (dn) {
          name = document.createElement('div');
          name.className = 'le-name';
          name.textContent = dn;
        }

        const pinBtn = document.createElement('button');
        pinBtn.className = 'le-pin-btn' + (it.pinned ? ' active' : '');
        pinBtn.title = it.pinned ? '取消固定' : '固定到顶部';
        pinBtn.setAttribute('aria-label', pinBtn.title);
        pinBtn.appendChild(createPinSvg(!!it.pinned));
        pinBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          await window.localEmote.togglePin(it.absPath || it.path);
          dbg('togglePin recent:', it.absPath || it.path);
          renderRecentGrid();
        });

        card.appendChild(pinBtn);
        card.appendChild(img);
        if (name) card.appendChild(name);
        card.addEventListener('click', async (ev) => {
          const p = it.absPath || it.path;
          dbg('recent click:', p);
          const isGif = /\.gif$/i.test(String(p || ''));
          let inserted = false;
          let sentOk = false;
          let cfg = null;
          let sendMode = 'multi';
          try {
            cfg = window.localEmote.getConfig ? window.localEmote.getConfig() : null;
            if (cfg && typeof cfg.sendMode === 'string') sendMode = cfg.sendMode;
          } catch (e) { dbg('recent click: read config error', e && e.message); }

          // 尝试获取环境
          let lt = (globalThis && globalThis.lite_tools) || window.lite_tools || null;
          let peer = await qqntAdapter.getCurrentPeer();
          try { ensureSelectionAtEditorEnd(getEditorEl()); } catch (_) {}

          // 判定是否必须走 Native：配置为native、按住Alt、或者文件是GIF
          const needNative = (sendMode === 'native' || (ev && ev.altKey) || isGif);
          const preferNative = (sendMode === 'image' && !isGif);

          if ((needNative || preferNative) && (!lt || !peer)) {
            // 重试机制：等待 peer 或 lt 就绪
            try {
              const end = Date.now() + 2000;
              while (Date.now() < end) {
                await new Promise(r => setTimeout(r, 100));
                lt = (globalThis && globalThis.lite_tools) || window.lite_tools || null;
                peer = await qqntAdapter.getCurrentPeer();
                if ((lt || typeof window.leMainRequest === 'function') && peer) break;
              }
            } catch (_) {}
          }

          try { ensureLESendMsgDebugHookInstalled && ensureLESendMsgDebugHookInstalled(); } catch (_) {}
          
          const canNative = !!(peer && (lt || typeof window.leMainRequest === 'function'));
          dbg('recent click: needNative=', needNative, 'canNative=', canNative, 'peer=', peer);

          if (needNative && !canNative) {
            // 必须原生发送但环境缺失
            dbg('recent click: native required but env missing');
            alert('无法获取当前会话信息，请尝试切换会话或重启 QQ');
            return;
          }

          if (needNative && canNative) {
            dbg('recent click: native mode execute');
            try {
              // Standard/Native mode: picSubType=1, asFace=true
              const picSubType = 1;
              await qqntAdapter.sendImageMessage(peer, p, { picSubType, asFace: true });
              sentOk = true;
              dbg('recent click: native send ok');
              try { if (window.localEmote && window.localEmote.markRecent) window.localEmote.markRecent(p); } catch (_) {}
              try { overlayInstance && overlayInstance.hide && overlayInstance.hide(); } catch (_) {}
              return;
            } catch (e) {
              sentOk = false;
              dbg('recent click: native send error', e && e.message);
            }
            inserted = false;
          } else if (preferNative && canNative) {
            dbg('recent click: image mode native send');
            try {
              // Image mode: picSubType=0, asFace=false
              const picSubType = 0;
              await qqntAdapter.sendImageMessage(peer, p, { picSubType, asFace: false });
              sentOk = true;
              dbg('recent click: image native send ok');
              try { if (window.localEmote && window.localEmote.markRecent) window.localEmote.markRecent(p); } catch (_) {}
              try { overlayInstance && overlayInstance.hide && overlayInstance.hide(); } catch (_) {}
              return;
            } catch (e) {
              sentOk = false;
              dbg('recent click: image native send error', e && e.message);
            }
            inserted = false;
          } else {
            if (needNative && !canNative) {
              dbg('recent click: native required but env missing');
              // GIF 环境缺失，不得不降级，但大概率是静态图
            }
            dbg('recent click: multi/image mode or fallback');
            inserted = tryInsertImageToEditor(p);
            dbg('recent click: tryInsertImageToEditor first ret=', inserted);
            if (inserted) { sentOk = true; }
            if (!inserted) {
              try {
                const ed = getEditorEl(); try { ed && ed.focus(); } catch (_) {}
                const res = await window.localEmote.sendEmote(p);
                inserted = !!(res && res.ok);
                sentOk = inserted;
                dbg('recent click: sendEmote ret=', inserted);
              } catch (e) { inserted = false; dbg('recent click: sendEmote error', e && e.message); }
            }
          }
          try { if (sentOk) window.localEmote.markRecent(p); } catch (_) {}
          // 仅非多发模式下快速发送；多发模式只插入到编辑器等待手动确认
          const wantQuick = (sendMode !== 'multi');
          dbg('recent click: wantQuick=', wantQuick, 'inserted=', inserted);
          
          if (wantQuick) {
            // 将查找范围收敛到编辑器所在的对话容器，避免误点其他会话的“发送”
            let scope = document;
            let edRef = null;
            try {
              edRef = getEditorEl();
              if (edRef) {
                const candidate = edRef.closest('.message-input-area, .chat-input-area, .q-input-area, .container, [class*="input"], [class*="editor"], [class*="chat"], [class*="msg"], [class*="message"]');
                if (candidate) scope = candidate;
              }
            } catch (_) {}
            let sendBtn = findSendButton(scope) || findSendButton(document);
            if (sendBtn && inserted) {
              try { await animateEmoteFlight(img, sendBtn); } catch (_) {}
              // 关闭面板，避免捕获回车导致再次点击卡片
              try { overlayInstance && overlayInstance.hide && overlayInstance.hide(); } catch (_) {}
              try {
  // 更拟真的点击序列
  sendBtn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
  sendBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  sendBtn.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true }));
  sendBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  sendBtn.click();
  dbg('recent click: sendBtn clicked');
} catch (_) {}
            } else if (inserted && edRef) {
              // 已插入内容：仅回车发送，避免重复粘贴
              try { edRef.focus(); } catch (_) {}
              // 关闭面板，避免捕获回车导致再次点击卡片
              try { overlayInstance && overlayInstance.hide && overlayInstance.hide(); } catch (_) {}
              const ok = pressEnterToSend(edRef);
              dbg('recent click: pressEnterToSend ret=', ok, '(no re-paste)');
            } else if (edRef) {
              // 未插入成功：尝试使用剪贴板粘贴 + 回车进行兜底
              try { edRef.focus(); } catch (_) {}
              let pasted = false;
              try {
                const res2 = await window.localEmote.sendEmote(p);
                pasted = !!(res2 && res2.ok);
                dbg('recent click: sendEmote fallback ret=', pasted);
              } catch (e) { dbg('recent click: sendEmote fallback error', e && e.message); }
              // 关闭面板，避免捕获回车导致再次点击卡片
              try { overlayInstance && overlayInstance.hide && overlayInstance.hide(); } catch (_) {}
              const ok = pressEnterToSend(edRef);
              dbg('recent click: pressEnterToSend ret=', ok);
            } else { dbg('recent click: sendBtn not ready or not inserted'); }
          } else {
            // 非快速发送（如多发模式），给出视觉反馈并聚焦编辑器，便于继续连点
            try {
              const edOnly = getEditorEl();
              if (edOnly && inserted) {
                try { edOnly.focus(); } catch (_) {}
                try { await animateEmoteFlight(img, edOnly); } catch (_) {}
                dbg('recent click: inserted (multi), focused editor');
              }
            } catch (_) {}
          }
        });
        recentGrid.appendChild(card);
      }
    })();
    try { await renderRecentGridPromise; } finally {
      renderRecentGridLock = false;
      renderRecentGridPromise = null;
      if (renderRecentGridQueued) {
        renderRecentGridQueued = false;
        setTimeout(renderRecentGrid, RENDER_RECENT_THROTTLE);
      }
    }
  }

  async function renderGrid() {
    if (renderGridLock) { renderGridQueued = true; return renderGridPromise; }
    renderGridLock = true;
    renderGridPromise = (async () => {
      dbg('renderGrid: start, selectedCat=', selectedCat);
      grid.innerHTML = '';
      const cat = selectedCat;
      if (!cat) { dbg('renderGrid: no category'); return; }
      let all = [];
      if (typeof cat === 'string' && cat.startsWith('__dir__|')) {
        const dir = cat.slice('__dir__|'.length);
        try { all = await window.localEmote.listImagesInDir(dir); dbg('renderGrid: dir', dir, 'items', all.length); } catch (e) { dbg('renderGrid: listImagesInDir error', e && e.message); all = []; }
      } else {
        try { all = await window.localEmote.listEmojis(cat); dbg('renderGrid: category', cat, 'items', all.length); } catch (e) { dbg('renderGrid: listEmojis error', e && e.message); all = []; }
      }
      currentList = filterItems(all);
      if (currentList.length === 0) {
        appendEmptyState(grid, searchQuery ? '当前表情包中没有匹配结果' : '当前目录没有可用图片，请导入或选择包含图片的目录');
      }
      for (let idx = 0; idx < currentList.length; idx++) {
        const it = currentList[idx];
        const card = document.createElement('div');
        card.className = 'le-card';
        card.setAttribute('role', 'option');
        card.setAttribute('tabindex', '-1');
        card.dataset.index = String(idx);

        const img = document.createElement('img');
        img.className = 'le-img';
        const imgUrl = it.url || it.preview || '';
        img.src = imgUrl;
        img.alt = it.name || '';
        bindPreview(card, imgUrl);

        const dn = displayNameFor(it);
        let name;
        if (dn) {
          name = document.createElement('div');
          name.className = 'le-name';
          name.textContent = dn;
        }

        card.appendChild(img);
        if (name) card.appendChild(name);
        card.addEventListener('click', async (ev) => {
        const p = it.absPath || it.path;
        dbg('grid click:', p, 'mode=', (window.localEmote.getConfig && window.localEmote.getConfig().sendMode));
        const isGif = /\.gif$/i.test(String(p || ''));
        let inserted = false;
        let sentOk = false;
        // 依据发送模式处理：点击即发。优先原生（保真），否则走 image 自动发送
        let cfg = null;
        let sendMode = 'multi';
        try { cfg = window.localEmote.getConfig ? window.localEmote.getConfig() : null; if (cfg && typeof cfg.sendMode === 'string') sendMode = cfg.sendMode; } catch (e) { dbg('grid click: read config error', e && e.message); }
        
        // 尝试获取环境
        let lt = (globalThis && globalThis.lite_tools) || window.lite_tools || null;
        let peer = await qqntAdapter.getCurrentPeer();

        // 判定是否必须走 Native
        const needNative = (sendMode === 'native' || (ev && ev.altKey) || isGif);
        const preferNative = (sendMode === 'image' && !isGif);

        if ((needNative || preferNative) && (!lt || !peer)) {
          // 重试机制：等待 peer 或 lt 就绪
          try {
            const end = Date.now() + 2000;
            while (Date.now() < end) {
              await new Promise(r => setTimeout(r, 100));
              lt = (globalThis && globalThis.lite_tools) || window.lite_tools || null;
              peer = await qqntAdapter.getCurrentPeer();
              if ((lt || typeof window.leMainRequest === 'function') && peer) break;
            }
          } catch (_) {}
        }

        try { ensureLESendMsgDebugHookInstalled && ensureLESendMsgDebugHookInstalled(); } catch (_) {}
        
        const canNative = !!(peer && (lt || typeof window.leMainRequest === 'function'));
        dbg('grid click: needNative=', needNative, 'canNative=', canNative, 'peer=', peer);

        if (needNative && !canNative) {
          // 必须原生发送但环境缺失：提示用户而不是静默失败
          dbg('grid click: native required but env missing (no peer or lite_tools)');
          alert('无法获取当前会话信息，请尝试切换会话或重启 QQ');
          return; 
        }

        if (needNative && canNative) {
          dbg('grid click: native mode execute');
          try {
            // Standard/Native mode: picSubType=1 (local file), asFace=true
            const picSubType = 1;
            await qqntAdapter.sendImageMessage(peer, p, { picSubType, asFace: true });
            sentOk = true;
            dbg('grid click: native send ok');
            try { if (window.localEmote && window.localEmote.markRecent) window.localEmote.markRecent(p); } catch (_) {}
            try { overlayInstance && overlayInstance.hide && overlayInstance.hide(); } catch (_) {}
            return;
          } catch (e) {
            sentOk = false;
            dbg('grid click: native send error', e && e.message);
          }
          inserted = false;
        } else if (preferNative && canNative) {
          dbg('grid click: image mode native send');
          try {
            // Image mode: picSubType=0 (local file), asFace=false
            const picSubType = 0;
            await qqntAdapter.sendImageMessage(peer, p, { picSubType, asFace: false });
            sentOk = true;
            dbg('grid click: image native send ok');
            try { if (window.localEmote && window.localEmote.markRecent) window.localEmote.markRecent(p); } catch (_) {}
            try { overlayInstance && overlayInstance.hide && overlayInstance.hide(); } catch (_) {}
            return;
          } catch (e) {
            sentOk = false;
            dbg('grid click: image native send error', e && e.message);
          }
          inserted = false;
        } else {
          if (needNative && !canNative) {
            dbg('grid click: native required but env missing');
          }
          inserted = tryInsertImageToEditor(p);
          dbg('grid click: tryInsertImageToEditor first ret=', inserted);
          if (inserted) { sentOk = true; }
          if (!inserted) {
            try {
              const ed = getEditorEl(); try { ed && ed.focus(); } catch (_) {}
              const res = await window.localEmote.sendEmote(p);
              inserted = !!(res && res.ok);
              sentOk = inserted;
              dbg('grid click: sendEmote ret=', inserted);
            } catch (_) { inserted = false; }
          }
        }
        try { if (sentOk) window.localEmote.markRecent(p); } catch (_) {}
        // 仅非多发模式下快速发送；多发模式只插入到编辑器等待手动确认
        const wantQuick = (sendMode !== 'multi');
        dbg('grid click: wantQuick=', wantQuick, 'inserted=', inserted);
        
        if (wantQuick) {
          // 将查找范围收敛到编辑器所在的对话容器，避免误点其他会话的“发送”
          let scope = document;
          let edRef = null;
          try {
            edRef = getEditorEl();
            if (edRef) {
              // 以包含编辑器、输入工具条或消息列表的最近容器作为查找范围
              const candidate = edRef.closest('.message-input-area, .chat-input-area, .q-input-area, .container, [class*="input"], [class*="editor"], [class*="chat"], [class*="msg"], [class*="message"]');
              if (candidate) scope = candidate;
            }
          } catch (_) {}
          let sendBtn = findSendButton(scope) || findSendButton(document);
          if (sendBtn && inserted) {
            try { await animateEmoteFlight(img, sendBtn); } catch (_) {}
            // 关闭面板，避免捕获回车导致再次点击卡片
            try { overlayInstance && overlayInstance.hide && overlayInstance.hide(); } catch (_) {}
            try {
  // 更拟真的点击序列
  sendBtn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
  sendBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  sendBtn.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true }));
  sendBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  sendBtn.click();
  dbg('grid click: sendBtn clicked');
} catch (_) {}
          } else if (inserted && edRef) {
            // 已插入内容：仅回车发送，避免重复粘贴
            try { edRef.focus(); } catch (_) {}
            // 关闭面板，避免捕获回车导致再次点击卡片
            try { overlayInstance && overlayInstance.hide && overlayInstance.hide(); } catch (_) {}
            const ok = pressEnterToSend(edRef);
            dbg('grid click: pressEnterToSend ret=', ok, '(no re-paste)');
          } else if (edRef) {
            // 未插入成功：尝试使用剪贴板粘贴 + 回车进行兜底
            try { edRef.focus(); } catch (_) {}
            let pasted = false;
            try {
              const res2 = await window.localEmote.sendEmote(p);
              pasted = !!(res2 && res2.ok);
              dbg('grid click: sendEmote fallback ret=', pasted);
            } catch (e) { dbg('grid click: sendEmote fallback error', e && e.message); }
            // 关闭面板，避免捕获回车导致再次点击卡片
            try { overlayInstance && overlayInstance.hide && overlayInstance.hide(); } catch (_) {}
            const ok = pressEnterToSend(edRef);
            dbg('grid click: pressEnterToSend ret=', ok);
          } else { dbg('grid click: sendBtn not ready or not inserted'); }
        } else {
          // 非快速发送（如多发模式），给出视觉反馈并聚焦编辑器，便于继续连点
          try {
            const edOnly = getEditorEl();
            if (edOnly && inserted) {
              try { edOnly.focus(); } catch (_) {}
              try { await animateEmoteFlight(img, edOnly); } catch (_) {}
              dbg('grid click: inserted (multi), focused editor');
            }
          } catch (_) {}
        }
        });
        grid.appendChild(card);
      }
      applyActiveAfterRender();
    })();
    try { await renderGridPromise; } finally {
      renderGridLock = false;
      renderGridPromise = null;
      if (renderGridQueued) {
        renderGridQueued = false;
        setTimeout(renderGrid, RENDER_GRID_THROTTLE);
      }
    }
  }

  function renderPacksBar() {
    dbg('renderPacksBar: packs', Array.isArray(packsCache) ? packsCache.length : -1, 'selectedCat', selectedCat);
    packsBar.innerHTML = '';
    if (!Array.isArray(packsCache) || packsCache.length === 0) return;
    const frag = document.createDocumentFragment();
    for (const p of packsCache) {
      const dirPath = p.dir || p.path || '';
      const key = `__dir__|${dirPath}`;
      const item = document.createElement('div');
      item.className = 'le-pack' + (selectedCat === key ? ' active' : '');
      item.title = p.name || dirPath;
      const img = document.createElement('img');
      const coverAbs = p.coverPath || p.firstPath || p.first || '';
      const coverUrl = (window.localEmote && window.localEmote.toLocalUrl) ? window.localEmote.toLocalUrl(coverAbs) : coverAbs;
      img.src = coverUrl || '';
      img.alt = p.name || '';
      item.appendChild(img);
      item.addEventListener('click', () => {
        dbg('packsBar click:', key);
        selectedCat = key;
        const cfg = window.localEmote.getConfig();
        cfg.lastCategory = key;
        window.localEmote.setConfig(cfg);
        activeIndex = -1;
        renderPacksBar();
        renderGrid();
        // 选中包后，立即更新标题与左侧按钮提示
        updateMainTitle();
      });
      frag.appendChild(item);
    }
    packsBar.appendChild(frag);
  }

  async function loadPacks() {
    if (loadPacksLock) { loadPacksQueued = true; return loadPacksPromise; }
    loadPacksLock = true;
    loadPacksPromise = (async () => {
      dbg('loadPacks: start');
      try {
        const cfg = window.localEmote.getConfig();
        const root = cfg && cfg.rootDir;
        dbg('loadPacks: root=', root);
        packsCache = root ? await window.localEmote.listPacksInDir(root) : [];
        dbg('loadPacks: packs length=', Array.isArray(packsCache) ? packsCache.length : -1);
        // 选择默认包：优先使用 cfg.lastCategory（必须是包），否则第一个
        const keys = packsCache.map(p => `__dir__|${p.dir || p.path || ''}`);
        const last = (cfg && cfg.lastCategory) || '';
        dbg('loadPacks: keys', keys, 'last', last, 'selected(before)', selectedCat);
        if (last && last.startsWith('__dir__|') && keys.includes(last)) selectedCat = last;
        else if (!keys.includes(selectedCat)) selectedCat = keys[0] || null;
        dbg('loadPacks: selected(after)', selectedCat);
      } catch (e) {
        dbg('loadPacks: error', e && e.message);
        packsCache = [];
      }
      renderPacksBar();
      updateMainTitle();
      dbg('loadPacks: done, packsCache=', Array.isArray(packsCache) ? packsCache.length : -1, 'selectedCat', selectedCat);
    })();
    try { await loadPacksPromise; } finally {
      loadPacksLock = false;
      loadPacksPromise = null;
      if (loadPacksQueued) {
        loadPacksQueued = false;
        setTimeout(loadPacks, LOAD_PACKS_THROTTLE);
      }
    }
  }

  function onKeydown(e) {
    const isOpen = wrap.style.display !== 'none';
    if (!isOpen) { dbg('overlay onKeydown: not open, key=', e && e.key); return; }
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    const isEditable = (e.target && (e.target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select'));
    if (isEditable && e.key !== 'Escape') { dbg('overlay onKeydown: editable target, ignore key=', e.key); return; }

    if (e.key === 'Escape') { dbg('overlay onKeydown: Escape pressed, hide'); e.preventDefault(); e.stopPropagation(); hide(); return; }
    const cols = getCols();
    dbg('overlay onKeydown: key', e.key, 'cols', cols, 'activeIndex', activeIndex);
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); e.stopPropagation(); dbg('overlay onKeydown: moveActive', 1); moveActive(1); break;
      case 'ArrowLeft': e.preventDefault(); e.stopPropagation(); dbg('overlay onKeydown: moveActive', -1); moveActive(-1); break;
      case 'ArrowDown': e.preventDefault(); e.stopPropagation(); dbg('overlay onKeydown: moveActive', cols); moveActive(cols); break;
      case 'ArrowUp': e.preventDefault(); e.stopPropagation(); dbg('overlay onKeydown: moveActive', -cols); moveActive(-cols); break;
      case 'Home': e.preventDefault(); e.stopPropagation(); dbg('overlay onKeydown: moveActive Home'); moveActive(-Infinity); break;
      case 'End': e.preventDefault(); e.stopPropagation(); dbg('overlay onKeydown: moveActive End'); moveActive(Infinity); break;
      case 'Enter': {
        const cards = getCards();
        if (activeIndex >= 0 && activeIndex < cards.length) {
          e.preventDefault(); e.stopPropagation();
          dbg('overlay onKeydown: Enter, click active card', activeIndex);
          cards[activeIndex].click();
        } else {
          dbg('overlay onKeydown: Enter with no active card');
        }
        break;
      }
      default: break;
    }
  }

  async function show(anchorRect) {
    if (anchorRect) showAnchorRect = anchorRect;
    if (showLock) { showQueued = true; return showPromise; }
    showLock = true;
    showPromise = (async () => {
      dbg('show overlay: anchorRect', anchorRect);
      await loadPacks();
      await renderRecentGrid();
      wrap.style.display = 'block';
      try {
        const cc = window.localEmote.getConfig();
        const n = Number.isFinite(cc.gridCols) ? Math.max(2, Math.min(12, Math.floor(cc.gridCols))) : 6;
        grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
        recentGrid.style.gridTemplateColumns = `repeat(${Math.max(2, Math.min(12, n))}, 1fr)`;
        dbg('show overlay: cols', n);
      } catch (_) {}
      position(anchorRect);
      setTimeout(() => document.addEventListener('mousedown', onDocDown, true), 0);
      window.addEventListener('resize', onResize, { passive: true });
      window.addEventListener('scroll', onResize, { passive: true });
      document.addEventListener('keydown', onKeydown, true);
      await renderGrid();
      updateMainTitle();
      applyActiveAfterRender();
      dbg('show overlay: done');
    })();
    try { await showPromise; } finally {
      showLock = false;
      showPromise = null;
      if (showQueued) {
        showQueued = false;
        setTimeout(() => show(showAnchorRect), SHOW_THROTTLE);
      }
    }
  }
  function hide() {
    dbg('hide overlay');
    wrap.style.display = 'none';
    hidePreview();
    document.removeEventListener('mousedown', onDocDown, true);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onResize);
    document.removeEventListener('keydown', onKeydown, true);
  }
  function position(rect) {
    const pad = 8;
    const left = Math.min(window.innerWidth - wrap.offsetWidth - pad, Math.max(pad, rect.left));
    let top = rect.top - wrap.offsetHeight - 8;
    if (top < pad) top = rect.bottom + 8;
    const finalLeft = Math.max(pad, left);
    const finalTop = Math.max(pad, top);
    dbg('overlay position:', { rect, wrapW: wrap.offsetWidth, wrapH: wrap.offsetHeight, finalLeft, finalTop, winW: window.innerWidth, winH: window.innerHeight });
    wrap.style.left = `${finalLeft}px`;
    wrap.style.top = `${finalTop}px`;
  }
  function onDocDown(e) { if (!wrap.contains(e.target)) { dbg('onDocDown: outside click -> hide'); hide(); } }
  function onResize() {
    if (!toolbarBtnRef || wrap.style.display === 'none') return;
    try {
      const rect = toolbarBtnRef.getBoundingClientRect();
      dbg('onResize: reposition overlay', rect);
      position(rect);
    } catch (_) {
      position(toolbarBtnRef.getBoundingClientRect());
    }
  }

  // 新增：在不关闭面板的情况下刷新布局与内容（用于设置变更实时生效）
  async function refresh() {
    if (refreshLock) { refreshQueued = true; return refreshPromise; }
    refreshLock = true;
    refreshPromise = (async () => {
      dbg('overlay refresh: start');
      try {
        const cc = window.localEmote.getConfig();
        const n = Number.isFinite(cc.gridCols) ? Math.max(2, Math.min(12, Math.floor(cc.gridCols))) : 6;
        grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
        recentGrid.style.gridTemplateColumns = `repeat(${Math.max(2, Math.min(12, n))}, 1fr)`;
        dbg('overlay refresh: cols', n);
      } catch (_) {}
      await renderRecentGrid();
      await renderGrid();
      dbg('overlay refresh: grids rendered, updating title and active');
      updateMainTitle();
      applyActiveAfterRender();
    })();
    try { await refreshPromise; } finally {
      refreshLock = false;
      refreshPromise = null;
      if (refreshQueued) {
        refreshQueued = false;
        setTimeout(refresh, REFRESH_THROTTLE);
      }
    }
  }

  document.body.appendChild(wrap);
  return { show, hide, el: wrap, refresh };
}

function injectButton() {
  dbg('injectButton: start');
  // 对齐 deepl_plugin：优先将按钮放到聊天功能栏左侧（.chat-func-bar 的第一个子元素）
  const chatBar = document.querySelector('.chat-func-bar');
  const leftIcons = chatBar && chatBar.firstElementChild ? chatBar.firstElementChild : null;
  
  // 如果按钮已存在，且发现了正确的容器，则迁移到左侧功能区
  const existed = document.getElementById('local-emote-toolbar-btn');
  if (existed && leftIcons && existed.parentElement !== leftIcons) {
    try { leftIcons.appendChild(existed); dbg('injectButton: moved existed to leftIcons'); } catch (_) {}
    return true;
  }
  
  // 仅当找到左侧功能区时才注入，未找到则等待下次观察
  if (!leftIcons) { dbg('injectButton: leftIcons not found, wait'); return false; }
  
  // 若已存在按钮，直接返回
  if (document.getElementById('local-emote-toolbar-btn')) { dbg('injectButton: already exists'); return true; }
  
  const btn = document.createElement('button');
  btn.id = 'local-emote-toolbar-btn';
  btn.title = '本地表情';
  btn.setAttribute('aria-label', '本地表情');
  // 尺寸尽量贴近左侧功能区的图标尺寸
  btn.style.width = '24px';
  btn.style.height = '24px';
  btn.style.display = 'inline-flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.border = 'none';
  btn.style.background = 'transparent';
  btn.style.borderRadius = '6px';
  btn.style.cursor = 'pointer';
  btn.style.color = 'var(--icon-color, #4b5563)';
  btn.style.margin = '0 8px';
  
  const svg = createIconSvg();
  btn.appendChild(svg);
  
  const overlay = buildOverlay();
  dbg('injectButton: overlay built');
  overlayInstance = overlay;
  toolbarBtnRef = btn;
  
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    try { ensureSelectionAtEditorEnd(getEditorEl()); } catch (_) {}
    const rect = btn.getBoundingClientRect();
    const ov = overlay.el;
    if (ov.style.display === 'none') overlay.show(rect); else overlay.hide();
  });
  
  // 直接追加到左侧功能区，保证位置一致
  leftIcons.appendChild(btn);
  dbg('injectButton: appended and ready');
  return true;
}

document.addEventListener('keydown', onGlobalKeydown, true);
try { installGlobalSelectionGuard(); } catch (_) {}

// 首次尝试注入
const tryInject = () => {
  if (injected) { dbg('tryInject: already injected, skip'); return; }
  injected = injectButton();
  dbg('tryInject: result', injected);
};

const leContextMenuState = { lastImageSource: "", lastTs: 0 };
const leSubMenuTimers = new Map();

function leEnsureContextMenuStyle() {
  if (document.getElementById('le-contextmenu-style')) return;
  const style = document.createElement('style');
  style.id = 'le-contextmenu-style';
  style.textContent = `
.le-sub-context-menu{position:fixed;top:var(--top);left:var(--left);z-index:2147483647;min-width:160px;max-width:320px;max-height:260px;display:none;background:var(--bg_transparent,#2b2b2b);color:var(--text_primary,#e5e7eb);border:1px solid rgba(0,0,0,.1);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.2);overflow:hidden}
.le-sub-context-menu.show{display:block}
.le-sub-context-menu .le-sub-scroll{max-height:260px;overflow:auto}
.le-sub-context-menu .le-sub-item{padding:6px 10px;display:flex;align-items:center;gap:8px;cursor:pointer;white-space:nowrap}
.le-sub-context-menu .le-sub-item:hover{background:var(--bg_hover,rgba(0,0,0,.08))}
.le-sub-context-menu .le-sub-arrow{margin-left:auto;opacity:.7}
`;
  document.head.appendChild(style);
}

function leRemoveAllSubMenus() {
  document.querySelectorAll(".le-sub-context-menu").forEach((el) => {
    try { el.__leCleanup?.(); } catch (_) {}
    el.remove();
  });
}

function leEnsureToastStyle() {
  if (document.getElementById('le-toast-style')) return;
  const style = document.createElement('style');
  style.id = 'le-toast-style';
  style.textContent = `
.lite-tools-toast{display:flex;flex-direction:column;gap:8px;padding:8px 12px}
.lite-tools-toast .lite-tools-toast-item{opacity:0;transform:translateY(-30px);height:0;transition:500ms}
.lite-tools-toast .lite-tools-toast-item.lite-tools-toast-show{opacity:1;height:62px;transform:translateY(0)}
`;
  document.head.appendChild(style);
}

function leFindCommonPrefix(paths) {
  if (!paths.length) return "";
  const splitPaths = paths.map((p) => String(p || "").split("\\").filter(Boolean));
  const minLength = Math.min(...splitPaths.map((p) => p.length));
  const commonPrefix = [];
  for (let i = 0; i < minLength; i++) {
    const currentPart = splitPaths[0][i];
    if (splitPaths.every((p) => p[i] === currentPart)) commonPrefix.push(currentPart); else break;
  }
  return commonPrefix.join("\\");
}

function leBuildFolderTree(flatList) {
  const tree = [];
  const map = new Map();
  const sortedList = [...flatList].sort((a, b) => String(a.path || "").localeCompare(String(b.path || ""), "en", { sensitivity: "base" }));
  const commonPrefix = leFindCommonPrefix(sortedList.map((item) => item.path));
  const prefixLength = sortedList.length > 1 && commonPrefix ? commonPrefix.length + 1 : 0;
  sortedList.forEach((item) => {
    const adjustedPath = String(item.path || "").substring(prefixLength);
    map.set(adjustedPath, { name: item.name, path: item.path, adjustedPath, children: [] });
  });
  sortedList.forEach((item) => {
    const adjustedPath = String(item.path || "").substring(prefixLength);
    const parts = adjustedPath.split("\\").filter(Boolean);
    if (parts.length === 1) {
      tree.push(map.get(adjustedPath));
    } else {
      const parentPath = parts.slice(0, -1).join("\\");
      const parent = map.get(parentPath);
      if (parent) {
        parent.children.push(map.get(adjustedPath));
      } else {
        const virtualParentName = parts[parts.length - 2];
        const virtualParent = { name: virtualParentName, path: (commonPrefix ? commonPrefix + "\\" : "") + parentPath, adjustedPath: parentPath, children: [map.get(adjustedPath)], virtual: true };
        map.set(parentPath, virtualParent);
        if (parts.length > 2) {
          const grandParentPath = parts.slice(0, -2).join("\\");
          const grandParent = map.get(grandParentPath);
          if (grandParent) grandParent.children.push(virtualParent); else tree.push(virtualParent);
        } else {
          tree.push(virtualParent);
        }
      }
    }
  });
  return tree;
}

function leCreateNestedSubMenu(parentEl, menuItems, callback, level = 0) {
  const subMenuEl = document.createElement("div");
  const scrollEl = document.createElement("div");
  scrollEl.classList.add("le-sub-scroll");
  subMenuEl.appendChild(scrollEl);
  subMenuEl.classList.add("le-sub-context-menu", `level-${level}`);
  const menuId = `le-submenu-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  subMenuEl.setAttribute("data-menu-id", menuId);
  parentEl.setAttribute("data-submenu-id", menuId);
  subMenuEl.style.setProperty("--top", `0px`);
  subMenuEl.style.setProperty("--left", `0px`);

  const clearMenuTimer = (id) => {
    const timer = leSubMenuTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      leSubMenuTimers.delete(id);
    }
  };
  const setCloseTimer = (id, element) => {
    clearMenuTimer(id);
    const timer = setTimeout(() => {
      element.classList.remove("show");
      element.querySelectorAll(".le-sub-context-menu").forEach((child) => child.classList.remove("show"));
    }, 260);
    leSubMenuTimers.set(id, timer);
  };

  function lePositionSubMenuFromAnchor(anchorEl) {
    if (!anchorEl || !anchorEl.getBoundingClientRect) return;
    const rect = anchorEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const menuWidth = Math.max(subMenuEl.offsetWidth || 180, 160);
    const menuHeight = Math.min(Math.max(subMenuEl.offsetHeight || 80, 80), 260);
    const gap = 2;
    let left = rect.x + rect.width + gap;
    if (viewportWidth && left + menuWidth > viewportWidth - 4) left = Math.max(4, rect.x - menuWidth - gap);
    let top = rect.y;
    if (viewportHeight && top + menuHeight > viewportHeight - 4) top = Math.max(4, viewportHeight - menuHeight - 4);
    subMenuEl.style.setProperty("--top", `${top}px`);
    subMenuEl.style.setProperty("--left", `${left}px`);
  }

  function leOpenSubMenuFromAnchor(anchorEl = parentEl) {
    clearMenuTimer(menuId);
    subMenuEl.classList.add("show");
    subMenuEl.style.zIndex = "2147483647";
    lePositionSubMenuFromAnchor(anchorEl);
  }

  const openMenuAt = (event) => {
    leOpenSubMenuFromAnchor(parentEl);
    let currentEl = parentEl;
    while (currentEl) {
      const currentSubmenuId = currentEl.getAttribute("data-submenu-id");
      if (currentSubmenuId) {
        clearMenuTimer(currentSubmenuId);
        const currentSubmenu = document.querySelector(`[data-menu-id="${currentSubmenuId}"]`);
        if (currentSubmenu) currentSubmenu.classList.add("show");
      }
      if (currentEl.classList.contains("le-sub-item")) {
        const parentSubmenu = currentEl.closest(".le-sub-context-menu");
        if (parentSubmenu) {
          const parentSubmenuId = parentSubmenu.getAttribute("data-menu-id");
          if (parentSubmenuId) {
            clearMenuTimer(parentSubmenuId);
            parentSubmenu.classList.add("show");
          }
          currentEl = document.querySelector(`[data-submenu-id="${parentSubmenuId}"]`);
        } else {
          currentEl = null;
        }
      } else {
        currentEl = null;
      }
    }
    event?.stopPropagation?.();
  };

  subMenuEl.addEventListener("mouseenter", openMenuAt);
  subMenuEl.addEventListener("pointerenter", openMenuAt);
  subMenuEl.addEventListener("mousemove", openMenuAt);

  subMenuEl.addEventListener("mouseleave", (event) => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget && parentEl.contains(relatedTarget)) return;
    const childMenus = subMenuEl.querySelectorAll(".le-sub-context-menu");
    for (let childMenu of childMenus) {
      if (relatedTarget && childMenu.contains(relatedTarget)) return;
    }
    setCloseTimer(menuId, subMenuEl);
  });

  subMenuEl.addEventListener("wheel", (event) => {
    event.stopPropagation();
    const maxTop = scrollEl.offsetHeight - subMenuEl.offsetHeight + 8;
    if (maxTop < 10) return;
    let addValue = 30;
    if (event.deltaY > 0) addValue = -30;
    let offsetY = (parseFloat((scrollEl.style.transform || "translateY(0px)").split("translateY(")[1]) || 0) + addValue;
    if (offsetY > 0) offsetY = 0;
    if (offsetY < -maxTop) offsetY = -maxTop;
    scrollEl.style.transform = `translateY(${offsetY}px)`;
  });

  menuItems.forEach((menuData) => {
    const subMenuItemEl = document.createElement("div");
    subMenuItemEl.classList.add("le-sub-item");
    const textSpan = document.createElement("span");
    textSpan.textContent = menuData.name;
    textSpan.style.flexGrow = "1";
    subMenuItemEl.appendChild(textSpan);
    subMenuItemEl.menuData = menuData;
    if (menuData.children && menuData.children.length > 0) {
      subMenuItemEl.classList.add("has-submenu");
      const arrowSpan = document.createElement("span");
      arrowSpan.className = "le-sub-arrow";
      arrowSpan.textContent = "›";
      subMenuItemEl.appendChild(arrowSpan);
      const childSubMenu = leCreateNestedSubMenu(subMenuItemEl, menuData.children, callback, level + 1);
      const openChildMenu = (event) => {
        const childMenuId = subMenuItemEl.getAttribute("data-submenu-id");
        clearMenuTimer(childMenuId);
        if (typeof childSubMenu.__leOpenFromAnchor === "function") childSubMenu.__leOpenFromAnchor(event.currentTarget);
      };
      subMenuItemEl.addEventListener("mouseenter", openChildMenu);
      subMenuItemEl.addEventListener("pointerenter", openChildMenu);
      subMenuItemEl.addEventListener("mousemove", openChildMenu);
      subMenuItemEl.addEventListener("mouseleave", (event) => {
        const relatedTarget = event.relatedTarget;
        const childMenuId = subMenuItemEl.getAttribute("data-submenu-id");
        const childMenu = document.querySelector(`[data-menu-id="${childMenuId}"]`);
        if (relatedTarget && childMenu && childMenu.contains(relatedTarget)) return;
        if (childMenu) setCloseTimer(childMenuId, childMenu);
      });
    }
    leBindContextActivate(subMenuItemEl, (event) => {
      event.stopPropagation();
      callback(event, menuData);
      leSubMenuTimers.clear();
      leRemoveAllSubMenus();
      document.querySelector(".q-context-menu")?.remove();
    });
    scrollEl.appendChild(subMenuItemEl);
  });

  const openFromParent = (event) => {
    leOpenSubMenuFromAnchor(event?.currentTarget || parentEl);
  };
  const openFromPointer = (event) => {
    if (!event || typeof event.clientX !== "number" || typeof event.clientY !== "number") return;
    const rect = parentEl.getBoundingClientRect();
    if (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      leOpenSubMenuFromAnchor(parentEl);
    }
  };
  parentEl.addEventListener("mouseenter", openFromParent);
  parentEl.addEventListener("mouseover", openFromParent);
  parentEl.addEventListener("pointerenter", openFromParent);
  parentEl.addEventListener("mousemove", openFromParent);
  parentEl.addEventListener("pointermove", openFromParent);
  parentEl.addEventListener("mouseleave", (event) => {
    const relatedTarget = event.relatedTarget;
    const submenuId = parentEl.getAttribute("data-submenu-id");
    const submenu = document.querySelector(`[data-menu-id="${submenuId}"]`);
    if (relatedTarget && submenu && submenu.contains(relatedTarget)) return;
    setCloseTimer(menuId, subMenuEl);
  });
  document.addEventListener("pointermove", openFromPointer, true);
  document.addEventListener("mousemove", openFromPointer, true);
  subMenuEl.__leOpenFromAnchor = leOpenSubMenuFromAnchor;
  subMenuEl.__leCleanup = () => {
    document.removeEventListener("pointermove", openFromPointer, true);
    document.removeEventListener("mousemove", openFromPointer, true);
  };
  document.body.appendChild(subMenuEl);
  const openIfHovered = () => {
    try { if (parentEl.matches(":hover")) leOpenSubMenuFromAnchor(parentEl); } catch (_) {}
  };
  requestAnimationFrame(openIfHovered);
  setTimeout(openIfHovered, 80);
  return subMenuEl;
}

const leToastContentEl = `<div class="q-toast lite-tools-toast" style="position: fixed; z-index: 5000; top: 0px; left: 0px; pointer-events: none"></div>`;
const leToastEl = `<div class="lite-tools-toast-item"><div class="q-toast-item">{{icon}}<span>{{content}}</span></div></div>`;
const leDefaultIcon = `<i style="width:20px;height:20px; color:#0099ff;"><svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.5 8C14.5 11.5899 11.5899 14.5 8 14.5C4.41015 14.5 1.5 11.5899 1.5 8C1.5 4.41015 4.41015 1.5 8 1.5C11.5899 1.5 14.5 4.41015 14.5 8ZM8.5 6.5V11.5H7.5V6.5H8.5ZM8.5 5.5V4.5H7.5V5.5H8.5Z"></path></svg></i>`;
const leSuccessIcon = `<i style="width:20px;height:20px; color:#15D173;"><svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 14.5C11.5899 14.5 14.5 11.5899 14.5 8C14.5 4.41015 11.5899 1.5 8 1.5C4.41015 1.5 1.5 4.41015 1.5 8C1.5 11.5899 4.41015 14.5 8 14.5ZM7.45232 10.2991L11.3555 6.35155L10.6445 5.64845L7.08919 9.2441L5.22771 7.44087L4.53193 8.15913L6.74888 10.3067L7.10435 10.651L7.45232 10.2991Z"></path></svg></i>`;
const leErrorIcon = `<i style="width:20px;height:20px; color:#d11515;"><svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 14.5C11.5899 14.5 14.5 11.5899 14.5 8C14.5 4.41015 11.5899 1.5 8 1.5C4.41015 1.5 1.5 4.41015 1.5 8C1.5 11.5899 4.41015 14.5 8 14.5ZM8 4C8.55228 4 9 4.44772 9 5V9C9 9.55228 8.55228 10 8 10C7.44772 10 7 9.55228 7 9V5C7 4.44772 7.44772 4 8 4ZM8 11C8.55228 11 9 11.4477 9 12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12C7 11.4477 7.44772 11 8 11Z"></path></svg></i>`;

function leGetIcon(type) {
  switch (type) {
    case "success": return leSuccessIcon;
    case "error": return leErrorIcon;
    case "none": return "";
    default: return leDefaultIcon;
  }
}

function leCreateToastEl(content, type) {
  const newToastEl = leToastEl.replace("{{content}}", content).replace("{{icon}}", leGetIcon(type));
  return new DOMParser().parseFromString(newToastEl, "text/html").querySelector(".lite-tools-toast-item");
}

let leToastContainer = null;
function leEnsureToastContainer() {
  if (leToastContainer && document.body.contains(leToastContainer)) return leToastContainer;
  document.body.insertAdjacentHTML("beforeend", leToastContentEl);
  leToastContainer = document.querySelector(".lite-tools-toast");
  return leToastContainer;
}

function leShowToast(content, type, duration = 3000) {
  leEnsureToastStyle();
  const container = leEnsureToastContainer();
  if (!container) return;
  const toast = leCreateToastEl(content, type);
  container.appendChild(toast);
  // Force reflow
  toast.offsetHeight;
  toast.classList.add("lite-tools-toast-show");
  
  toast.close = function () {
    clearTimeout(this.timeout);
    toast.addEventListener("transitionend", () => this.remove(), { once: true });
    this.classList.remove("lite-tools-toast-show");
  };
  
  toast.timeout = setTimeout(() => toast.close(), duration);
  return toast;
}

function leBindContextActivate(el, handler) {
  if (!el || typeof handler !== "function") return;
  const onActivate = (event) => {
    if (event && event.__le_handled) return;
    if (event) event.__le_handled = true;
    const now = Date.now();
    if (el.__le_lastFire && now - el.__le_lastFire < 300) return;
    el.__le_lastFire = now;
    handler(event);
  };
  el.addEventListener("pointerdown", onActivate, true);
  el.addEventListener("mousedown", onActivate, true);
  el.addEventListener("click", onActivate, true);
}

function leAddQContextMenu(qContextMenu, title, subMenuList, callback, allowMainClick = false) {
  const contextItem = qContextMenu.querySelector(`:scope > :not(.menu-stickers-wrapper,[disabled="true"])`)?.cloneNode(true) ??
    qContextMenu.querySelector(`.q-context-menu-item:not([disabled="true"])`)?.cloneNode(true);
  if (!contextItem) return;
  contextItem.classList.add("le-context-item");
  
  // Clean up styles
  contextItem.style.removeProperty("color");
  
  if (contextItem.classList.contains("q-context-menu-item__text")) contextItem.innerText = title;
  else {
    const textEl = contextItem.querySelector(".q-context-menu-item__text");
    if (textEl) textEl.innerText = title;
  }
  
  let hasSubMenu = false;
  if (Array.isArray(subMenuList) && subMenuList.length) {
    hasSubMenu = true;
    // Add arrow icon if text element exists
    if (contextItem.querySelector(".q-context-menu-item__text")) {
      const subMenuIconEl = `<div class="q-context-menu-item__icon icon_next lite-tools-context-next-icon"><i class="q-icon"><svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.6953 3L10.7993 8.10522L5.6953 13.2104L5 12.5161L9.4098 8.10522L5 3.69439L5.6953 3Z"></path></svg></i></div>`;
      contextItem.insertAdjacentHTML("beforeend", subMenuIconEl);
    }
    const tree = subMenuList.some((item) => Array.isArray(item?.children)) ? subMenuList : leBuildFolderTree(subMenuList);
    leCreateNestedSubMenu(contextItem, tree, callback, 0);
  } else if (typeof callback === "function") {
    // No submenu, always click
    leBindContextActivate(contextItem, (event) => {
      event.stopPropagation();
      callback(event);
      leSubMenuTimers.clear();
      leRemoveAllSubMenus();
      qContextMenu.remove();
    });
    qContextMenu.appendChild(contextItem);
    return;
  }
  
  // If submenu exists, only add click listener if allowMainClick is true
  if (callback && (!hasSubMenu || allowMainClick)) {
    leBindContextActivate(contextItem, (e) => {
      e.stopPropagation();
      callback(e);
      leSubMenuTimers.clear();
      leRemoveAllSubMenus();
      qContextMenu.remove();
    });
  }
  
  qContextMenu.appendChild(contextItem);
}

function leDecodeLocalUrl(src) {
  if (!src || typeof src !== "string") return "";
  // Strip query and hash
  const qIdx = src.indexOf("?");
  if (qIdx >= 0) src = src.slice(0, qIdx);
  const hIdx = src.indexOf("#");
  if (hIdx >= 0) src = src.slice(0, hIdx);

  const decodePart = (part, twice) => {
    let v = part;
    try { v = decodeURIComponent(v); } catch (_) {}
    if (twice) {
      try { v = decodeURIComponent(v); } catch (_) {}
    }
    return v;
  };
  const decodeWhole = (value, twice) => {
    let v = value;
    try { v = decodeURIComponent(v); } catch (_) {}
    if (twice) {
      try { v = decodeURIComponent(v); } catch (_) {}
    }
    return v;
  };
  const normalizeAppimgPath = (raw) => {
    let v = decodeWhole(raw, true);
    const driveIdx = v.search(/[A-Za-z]:[\\/]/);
    if (driveIdx >= 0) v = v.slice(driveIdx);
    v = v.replace(/^\/+/, "");
    return v.replace(/\//g, "\\");
  };
  if (src.startsWith("local:///")) {
    const raw = src.slice("local:///".length);
    const parts = raw.split("/").filter((p) => p.length > 0).map((p) => decodePart(p, true));
    const joined = parts.join("/");
    return joined.replace(/\//g, "\\");
  }
  if (src.startsWith("file:///")) {
    const raw = src.slice("file:///".length);
    const parts = raw.split("/").filter((p) => p.length > 0).map((p) => decodePart(p, false));
    const joined = parts.join("/");
    return joined.replace(/\//g, "\\");
  }
  if (src.startsWith("appimg:///")) {
    const raw = src.slice("appimg:///".length);
    return normalizeAppimgPath(raw);
  }
  if (src.startsWith("appimg://")) {
    const raw = src.slice("appimg://".length);
    return normalizeAppimgPath(raw);
  }
  return "";
}

function leGetImagePathFromSrc(src) {
  if (!src || typeof src !== "string") return "";
  if (src.startsWith("local:///") || src.startsWith("file:///") || src.startsWith("appimg://")) return leDecodeLocalUrl(src);
  if (src.startsWith("qqface:")) return "";
  if (src.startsWith("blob:") || src.startsWith("data:") || src.startsWith("http")) return "";
  return src;
}

function leContextReasonText(reason) {
  const map = {
    root_dir_missing: "请先在设置页选择本地表情目录",
    target_outside_root: "目标目录不在本地表情目录内",
    source_missing: "找不到图片文件",
    unsupported_source: "当前图片来源不支持保存",
    fetch_failed: "图片读取失败",
    bad_size: "图片为空或超过 20MB",
    bad_magic: "不是有效图片文件",
    bad_ext: "不支持的图片格式",
    write_failed: "写入文件失败",
  };
  return map[reason] || reason || "未知错误";
}

function leNormalizeContextSource(source) {
  try {
    if (window.localEmote?.normalizeContextImageSource) {
      return window.localEmote.normalizeContextImageSource(source);
    }
  } catch (_) {}
  const p = leGetImagePathFromSrc(source);
  if (p) return { kind: "file", source: p, fileName: p.split(/[\\/]/).pop() || "", mime: "" };
  return { kind: "unsupported", source, reason: "unsupported_source" };
}

function leExtractCssUrl(value) {
  const raw = String(value || "");
  const match = raw.match(/url\((['"]?)(.*?)\1\)/i);
  return match ? match[2] : "";
}

function leCollectImageCandidates(el) {
  const out = [];
  if (!el || el.nodeType !== 1) return out;
  const push = (value) => { if (value && typeof value === "string") out.push(value); };
  if (el.tagName === "IMG") {
    push(el.currentSrc);
    push(el.src);
  }
  const attrs = [
    "src",
    "href",
    "data-src",
    "data-original",
    "data-origin",
    "data-src-original",
    "data-url",
    "data-thumb",
    "data-image",
    "data-file",
    "data-path",
    "origin-src",
  ];
  for (const attr of attrs) {
    try { push(el.getAttribute?.(attr)); } catch (_) {}
  }
  try { push(leExtractCssUrl(getComputedStyle(el).backgroundImage)); } catch (_) {}
  return out;
}

function leFindContextImageSource(event) {
  const pathList = event?.composedPath ? event.composedPath() : [];
  const candidates = [];
  for (const el of pathList) candidates.push(...leCollectImageCandidates(el));
  const target = event?.target;
  const img = target && (target.tagName === "IMG" ? target : (target.closest ? target.closest("img") : null));
  if (img) candidates.push(...leCollectImageCandidates(img));
  for (const candidate of candidates) {
    const normalized = leNormalizeContextSource(candidate);
    if (normalized && normalized.kind !== "unsupported") return candidate;
  }
  return "";
}

async function leBuildContextImagePayload(source, targetDir) {
  const normalized = leNormalizeContextSource(source);
  if (!normalized || normalized.kind === "unsupported") {
    return { ok: false, reason: normalized?.reason || "unsupported_source" };
  }
  if (normalized.kind === "file") {
    return {
      ok: true,
      payload: {
        kind: "file",
        path: normalized.source,
        fileName: normalized.fileName,
        mime: normalized.mime || "",
        targetDir,
      },
    };
  }
  if (normalized.kind === "data" || normalized.kind === "remote") {
    try {
      const res = await fetch(normalized.source, { credentials: "include" });
      if (!res || (typeof res.ok === "boolean" && !res.ok)) return { ok: false, reason: "fetch_failed" };
      const blob = await res.blob();
      const bytes = await blob.arrayBuffer();
      return {
        ok: true,
        payload: {
          kind: "bytes",
          bytes,
          fileName: normalized.fileName || "context-image",
          mime: normalized.mime || blob.type || res.headers?.get?.("content-type") || "",
          targetDir,
        },
      };
    } catch (_) {
      return { ok: false, reason: "fetch_failed" };
    }
  }
  return { ok: false, reason: "unsupported_source" };
}

async function leRefreshAfterContextSave() {
  try { await window.localEmote?.refreshLibraryIndex?.(); } catch (_) {}
  try { await overlayInstance?.refresh?.(); } catch (_) {}
}

function leInstallImageContextMenu() {
  if (window.__le_image_context_menu_installed) return;
  window.__le_image_context_menu_installed = true;
  leEnsureContextMenuStyle();
  document.addEventListener("contextmenu", (e) => {
    try {
      const cfg = window.localEmote?.getConfig?.();
      if (!cfg || cfg.imageContextMenu === false) return;
      const src = leFindContextImageSource(e);
      try { dbg('contextmenu: image source detected', { src: src ? src.slice(0, 80) : '' }); } catch (_) {}
      if (!src) {
        leContextMenuState.lastImageSource = "";
        return;
      }
      leContextMenuState.lastImageSource = src;
      leContextMenuState.lastTs = Date.now();
    } catch (e) {
      try { dbg('contextmenu error', e); } catch (_) {}
    }
  }, true);
  const moCtx = new MutationObserver(() => {
    try {
      const qContextMenu = document.querySelector(".q-context-menu:not(.le-context-menu)");
    if (!qContextMenu) {
      leRemoveAllSubMenus();
      return;
    }
    qContextMenu.classList.add("le-context-menu");
    const cfg = window.localEmote?.getConfig?.();
    if (!cfg || cfg.imageContextMenu === false) return;
    if (!leContextMenuState.lastImageSource || Date.now() - leContextMenuState.lastTs > 1500) return;
    if (qContextMenu.querySelector(".le-context-item")) return;
    const listPromise = (async () => {
      if (window.localEmote?.getContextSaveTargets) {
        const targets = await window.localEmote.getContextSaveTargets();
        return Array.isArray(targets) ? targets : [];
      }
      const cfg = window.localEmote?.getConfig?.();
      const rootDir = cfg?.rootDir;
      let packs = [];
      if (rootDir && window.localEmote?.listPacksInDir) {
        try { packs = await window.localEmote.listPacksInDir(rootDir); } catch (_) { packs = []; }
      }
      if (Array.isArray(packs) && packs.length > 0) {
        return packs.map((p) => ({ name: p?.name || (p?.dir ? String(p.dir).split(/[\\/]/).pop() : ""), path: `__dir__|${p?.dir || p?.path || ""}` }));
      }
      const list = await window.localEmote?.listCategories?.();
      if (Array.isArray(list) && list.length > 0) {
        return list.map((name) => {
          const p = String(name || "");
          const parts = p.split(/\\|\//).filter(Boolean);
          return { name: parts[parts.length - 1] || p, path: p };
        });
      }
      return [{ name: "默认", path: "Default" }];
    })();
      if (!listPromise || typeof listPromise.then !== "function") return;
      listPromise.then((subMenuList) => {
        leAddQContextMenu(qContextMenu, "保存到本地表情", subMenuList, async (_event, data) => {
          try {
            const target = data || subMenuList?.[0];
            const src = leContextMenuState.lastImageSource;
            const targetDir = target?.dir || (target?.path && String(target.path).startsWith("__dir__|") ? String(target.path).slice("__dir__|".length) : "");
            if (!src) {
              leShowToast("保存失败: 找不到图片来源", "error");
              return;
            }
            if (!targetDir) {
              leShowToast("保存失败: " + leContextReasonText("root_dir_missing"), "error");
              return;
            }
            const built = await leBuildContextImagePayload(src, targetDir);
            if (!built.ok) {
              leShowToast("保存失败: " + leContextReasonText(built.reason), "error");
              return;
            }
            try {
              const cfg = window.localEmote?.getConfig?.();
              if (cfg) {
                cfg.lastCategory = "__dir__|" + targetDir;
                window.localEmote.setConfig(cfg);
              }
            } catch (_) {}
            const res = await window.localEmote.saveContextImage(built.payload);
            dbg('contextmenu: save result', res);
            if (!res || !res.ok) {
              leShowToast("保存失败: " + leContextReasonText(res?.reason), "error");
              return;
            }
            await leRefreshAfterContextSave();
            const label = target?.name || res.name || "";
            leShowToast(label ? `保存成功: ${label}` : "保存成功", "success");
          } catch (e) {
            dbg('contextmenu: save handler error', e);
            leShowToast("保存出错: " + (e?.message || "未知错误"), "error");
          }
        }, true);
        return;
        leAddQContextMenu(qContextMenu, "保存到本地表情", subMenuList, async (_event, data) => {
          try {
            const src = leContextMenuState.lastImagePath;
            let targetPath = data?.path;
            
            // Handle main menu click (no data)
            if (!targetPath) {
               const cfg = window.localEmote?.getConfig?.();
               targetPath = cfg?.lastCategory || "Default";
               dbg('contextmenu: main click, using default path', targetPath);
            }
            
            dbg('contextmenu: clicked', { src: src ? src.slice(0, 50) : '', path: targetPath });
            if (!src) {
              dbg('contextmenu: no source image path');
              leShowToast('保存失败: 找不到图片路径', 'error');
              return;
            }
            if (!targetPath) {
              dbg('contextmenu: no target category path');
              leShowToast('保存失败: 未选择分类', 'error');
              return;
            }
            try {
              const cfg = window.localEmote?.getConfig?.();
              if (cfg) {
                cfg.lastCategory = targetPath;
                window.localEmote.setConfig(cfg);
              }
            } catch (_) {}
            const res = await window.localEmote.copyToCategory(src, targetPath);
            dbg('contextmenu: copy result', res);
            if (!res || !res.ok) {
              const msg = '保存失败: ' + (res?.reason || '未知错误');
              console.error(msg);
              leShowToast(msg, 'error');
            } else {
              // success
              const label = (data && data.name) || res?.category || (targetPath ? String(targetPath).split(/[\\/]/).pop() : '');
              leShowToast(label ? `保存成功：${label}` : '保存成功', 'success');
            }
          } catch (e) {
            dbg('contextmenu: click handler error', e);
            leShowToast('保存出错: ' + e.message, 'error');
          }
        }, true);
      }).catch((e) => {
        try { dbg('listCategories failed', e); } catch (_) {}
      });
    } catch (e) {
      try { dbg('contextmenu mutation error', e); } catch (_) {}
    }
  });
  moCtx.observe(document.body, { childList: true, subtree: true });
}

// 新增：监听主进程推送的 Peer 更新 (反向研究成果)
if (window.localEmote && typeof window.localEmote.onUpdatePeer === 'function') {
  window.localEmote.onUpdatePeer((peer) => {
    if (peer && peer.peerUid && peer.chatType) {
      window.__le_lastPeer = peer;
      try { dbg('onUpdatePeer: updated from main', peer); } catch (_) {}
    }
  });
}

tryInject();
try { leInstallImageContextMenu(); } catch (_) {}

// 监听 DOM 变化，确保路由切换后依然注入
const mo = new MutationObserver(() => tryInject());
mo.observe(document.documentElement, { childList: true, subtree: true });

// 兜底定时器（防止某些页面结构延迟加载）
setInterval(tryInject, OBSERVER_INTERVAL);
// 移除多余的闭包结束

export const onSettingWindowCreated = (view) => {
  try {
    dbg('settings: window created');
    const plugin = LiteLoader.plugins && LiteLoader.plugins["local_emotes"]; // 真实环境
    const htmlUrls = [
      plugin ? `local:///${plugin.path.plugin}/src/settings.html` : null,
      './src/settings.html', // 预览环境 fallback
    ].filter(Boolean);

    const tryLoad = (idx = 0) => {
      if (idx >= htmlUrls.length) throw new Error('no settings.html found');
      const url = htmlUrls[idx];
      return fetch(url)
        .then(r => {
          if (!r.ok) throw new Error('fetch failed: ' + r.status);
          return r.text();
        })
        .then(html => {
          try { dbg('settings: loaded html from', url); } catch (_) {}
          view.innerHTML = html;
          const cfg = window.localEmote.getConfig();

          const dirInput = view.querySelector('.local_emotes .le-dir-input');
          const btnChoose = view.querySelector('.local_emotes .le-dir-choose');
          const btnOpenData = view.querySelector('.local_emotes .le-dir-open');
          const hotkeyInput = view.querySelector('.local_emotes .le-hotkey-input');
          const hotkeyReset = view.querySelector('.local_emotes .le-hotkey-reset');
          const hotkeyApply = view.querySelector('.local_emotes .le-hotkey-apply');
          const gridColsInput = view.querySelector('.local_emotes .le-grid-cols');
          const gridColsApply = view.querySelector('.local_emotes .le-grid-cols-apply');
          const clearRecentBtn = view.querySelector('#le-clear-recent');
          const recentLimitInput = view.querySelector('.local_emotes .le-recent-limit');
          const recentLimitApply = view.querySelector('.local_emotes .le-recent-limit-apply');
          const pinLimitInput = view.querySelector('.local_emotes .le-pin-limit');
          const pinLimitApply = view.querySelector('.local_emotes .le-pin-limit-apply');
          const versionEl = view.querySelector('#le-settings-version');
          const openDataDirBtn = view.querySelector('#le-open-data-dir');
          const diagnosticsEl = view.querySelector('#le-diagnostics');
          const refreshLibraryBtn = view.querySelector('#le-refresh-library');
          const refreshDiagnosticsBtn = view.querySelector('#le-refresh-diagnostics');
          const showNameSwitch = view.querySelector('#le-show-filename');
          const debugSwitch = view.querySelector('#le-debug');
          const imageContextSwitch = view.querySelector('#le-image-contextmenu');
          const hoverPreviewSwitch = view.querySelector('#le-hover-preview');

          if (versionEl) {
            try { versionEl.textContent = (LiteLoader.plugins?.["local_emotes"]?.manifest?.version) || ''; } catch (_) {}
          }
          const renderDiagnostics = async (refresh = false) => {
            if (!diagnosticsEl) return;
            try {
              const cfgNow = window.localEmote.getConfig();
              const index = window.localEmote.getLibraryIndex ? await window.localEmote.getLibraryIndex(refresh) : null;
              const caps = qqntAdapter.probeRuntimeCapabilities();
              const parts = [
                `目录：${cfgNow.rootDir || '未选择'}`,
                `索引：${index?.packs?.length || 0} 个表情包 / ${index?.images?.length || 0} 张图片`,
                `Hash：${index?.hash || '-'}`,
                `发送模式：${cfgNow.sendMode}`,
                `Adapter：nativeCall=${caps.nativeCall ? 'Y' : 'N'}，peer=${caps.peer ? 'Y' : 'N'}，image=${caps.imageMessage ? 'Y' : 'N'}，marketFace=${caps.marketFace ? 'Y' : 'N'}`,
                `调试：${cfgNow.debug ? '开启' : '关闭'}`,
              ];
              diagnosticsEl.textContent = parts.join('；');
            } catch (e) {
              diagnosticsEl.textContent = '诊断刷新失败：' + (e?.message || e);
            }
          };
          renderDiagnostics(false);
          if (dirInput) dirInput.value = cfg.rootDir || '未选择目录';
          // 已移除快速发送设置开关
          if (showNameSwitch) {
            if (cfg.showFileName) showNameSwitch.setAttribute('is-active', ''); else showNameSwitch.removeAttribute('is-active');
            showNameSwitch.addEventListener('click', () => {
              const is = showNameSwitch.hasAttribute('is-active');
              if (is) showNameSwitch.removeAttribute('is-active'); else showNameSwitch.setAttribute('is-active', '');
              const newCfg = window.localEmote.getConfig();
              newCfg.showFileName = !is;
              window.localEmote.setConfig(newCfg);
              try { dbg('settings: showFileName set to', newCfg.showFileName); } catch (_) {}
              // 开关变化后，如面板已打开则即时刷新
              try {
                if (overlayInstance && overlayInstance.el && overlayInstance.el.style.display !== 'none') {
                  overlayInstance.refresh && overlayInstance.refresh();
                }
              } catch (_) {}
            });
          }
          if (debugSwitch) {
            if (cfg.debug) debugSwitch.setAttribute('is-active', ''); else debugSwitch.removeAttribute('is-active');
            debugSwitch.addEventListener('click', () => {
              const is = debugSwitch.hasAttribute('is-active');
              if (is) debugSwitch.removeAttribute('is-active'); else debugSwitch.setAttribute('is-active', '');
              const newCfg = window.localEmote.getConfig();
              newCfg.debug = !is;
              window.localEmote.setConfig(newCfg);
              try { dbg('config.debug set to', newCfg.debug); } catch (_) {}
            });
          }
          if (imageContextSwitch) {
            if (cfg.imageContextMenu !== false) imageContextSwitch.setAttribute('is-active', ''); else imageContextSwitch.removeAttribute('is-active');
            imageContextSwitch.addEventListener('click', () => {
              const is = imageContextSwitch.hasAttribute('is-active');
              if (is) imageContextSwitch.removeAttribute('is-active'); else imageContextSwitch.setAttribute('is-active', '');
              const newCfg = window.localEmote.getConfig();
              newCfg.imageContextMenu = !is;
              window.localEmote.setConfig(newCfg);
              try { dbg('config.imageContextMenu set to', newCfg.imageContextMenu); } catch (_) {}
            });
          }
          if (hoverPreviewSwitch) {
            if (cfg.hoverPreview !== false) hoverPreviewSwitch.setAttribute('is-active', ''); else hoverPreviewSwitch.removeAttribute('is-active');
            hoverPreviewSwitch.addEventListener('click', () => {
              const is = hoverPreviewSwitch.hasAttribute('is-active');
              if (is) hoverPreviewSwitch.removeAttribute('is-active'); else hoverPreviewSwitch.setAttribute('is-active', '');
              const newCfg = window.localEmote.getConfig();
              newCfg.hoverPreview = !is;
              window.localEmote.setConfig(newCfg);
              try { dbg('config.hoverPreview set to', newCfg.hoverPreview); } catch (_) {}
            });
          }

          // 目录选择
          if (btnChoose) {
            btnChoose.addEventListener('click', async () => {
              try {
                const p = await window.localEmote.selectRootDir();
                if (p && dirInput) dirInput.value = p;
                try { dbg('settings: rootDir selected', p); } catch (_) {}
                try { overlayInstance?.refresh?.(); } catch (_) {}
              } catch (_) {}
            });
          }
          // 打开数据目录（两处按钮）
          if (btnOpenData) btnOpenData.addEventListener('click', () => { try { window.localEmote.openDataDir(); } catch (_) {} });
          if (openDataDirBtn) openDataDirBtn.addEventListener('click', () => { try { window.localEmote.openDataDir(); } catch (_) {} });
          if (refreshLibraryBtn) refreshLibraryBtn.addEventListener('click', async () => {
            try {
              await window.localEmote.refreshLibraryIndex?.();
              await renderDiagnostics(true);
              await overlayInstance?.refresh?.();
            } catch (_) {}
          });
          if (refreshDiagnosticsBtn) refreshDiagnosticsBtn.addEventListener('click', () => { renderDiagnostics(false); });

          // 热键设置
          if (hotkeyInput) {
            hotkeyInput.value = cfg.hotkey || 'Alt+E';
            hotkeyInput.addEventListener('keydown', (e) => {
              e.preventDefault();
              const parts = [];
              if (e.ctrlKey) parts.push('Ctrl');
              if (e.shiftKey) parts.push('Shift');
              if (e.altKey) parts.push('Alt');
              if (e.metaKey) parts.push('Meta');
              const k = e.key;
              const ignore = ['Control','Shift','Alt','Meta'];
              if (k && !ignore.includes(k)) {
                parts.push(k.length === 1 ? k.toUpperCase() : (k[0]?.toUpperCase() + k.slice(1)));
              }
              hotkeyInput.value = parts.join('+');
            });
          }
          const normalizeHotkey = (s) => {
            const hk = parseHotkeyString(s);
            const parts = [];
            if (hk.ctrl) parts.push('Ctrl');
            if (hk.shift) parts.push('Shift');
            if (hk.alt) parts.push('Alt');
            if (hk.meta) parts.push('Meta');
            if (hk.key) parts.push(hk.key.length === 1 ? hk.key.toUpperCase() : (hk.key[0]?.toUpperCase() + hk.key.slice(1)));
            return parts.join('+');
          };
          if (hotkeyReset) hotkeyReset.addEventListener('click', () => {
            const c = window.localEmote.getConfig();
            c.hotkey = 'Alt+E';
            window.localEmote.setConfig(c);
            try { dbg('settings: hotkey reset to', 'Alt+E'); } catch (_) {}
            if (hotkeyInput) hotkeyInput.value = 'Alt+E';
          });
          if (hotkeyApply) hotkeyApply.addEventListener('click', () => {
            let val = (hotkeyInput?.value || '').trim();
            let norm = normalizeHotkey(val);
            if (!norm) norm = 'Alt+E';
            const c = window.localEmote.getConfig();
            c.hotkey = norm;
            window.localEmote.setConfig(c);
            try { dbg('settings: hotkey set to', norm); } catch (_) {}
            if (hotkeyInput) hotkeyInput.value = norm;
          });

          // 网格列数
          if (gridColsInput) {
            gridColsInput.value = (cfg.gridCols != null ? cfg.gridCols : 6);
          }
          if (gridColsApply) gridColsApply.addEventListener('click', () => {
            let n = Math.floor(Number(gridColsInput?.value));
            if (!Number.isFinite(n)) n = 6;
            n = Math.max(2, Math.min(12, n));
            const c = window.localEmote.getConfig();
            c.gridCols = n;
            window.localEmote.setConfig(c);
            try { dbg('settings: gridCols set to', n); } catch (_) {}
            if (gridColsInput) gridColsInput.value = String(n);
            try { overlayInstance?.refresh?.(); } catch (_) {}
          });

          // 最近使用上限
          if (recentLimitInput) {
            const val = Number.isFinite(cfg.recentLimit) ? cfg.recentLimit : 60;
            recentLimitInput.value = String(val);
          }
          if (recentLimitApply) recentLimitApply.addEventListener('click', () => {
            let n = Math.floor(Number(recentLimitInput?.value));
            if (!Number.isFinite(n)) n = 60;
            n = Math.max(1, Math.min(999, n));
            const c = window.localEmote.getConfig();
            c.recentLimit = n;
            if (Array.isArray(c.recent)) c.recent = c.recent.slice(0, n);
            window.localEmote.setConfig(c);
            try { dbg('settings: recentLimit set to', n); } catch (_) {}
            if (recentLimitInput) recentLimitInput.value = String(n);
            try { overlayInstance?.refresh?.(); } catch (_) {}
          });

          // 置顶上限
          if (pinLimitInput) {
            const val = Number.isFinite(cfg.pinLimit) ? cfg.pinLimit : 12;
            pinLimitInput.value = String(val);
          }
          if (pinLimitApply) pinLimitApply.addEventListener('click', () => {
            let n = Math.floor(Number(pinLimitInput?.value));
            if (!Number.isFinite(n)) n = 12;
            n = Math.max(1, Math.min(99, n));
            const c = window.localEmote.getConfig();
            c.pinLimit = n;
            if (Array.isArray(c.pinned)) c.pinned = c.pinned.slice(0, n);
            window.localEmote.setConfig(c);
            try { dbg('settings: pinLimit set to', n); } catch (_) {}
            if (pinLimitInput) pinLimitInput.value = String(n);
            try { overlayInstance?.refresh?.(); } catch (_) {}
          });

          // 清空最近
          if (clearRecentBtn) clearRecentBtn.addEventListener('click', async () => {
            try { await window.localEmote.clearRecent(); try { dbg('settings: recent cleared'); } catch (_) {} } catch (_) {}
            try { overlayInstance?.refresh?.(); } catch (_) {}
          });

          // 发送模式按钮绑定
          const sendModeWrap = view.querySelector('.le-send-mode');
          const btnMulti = view.querySelector('#le-send-mode-multi');
          const btnSingle = view.querySelector('#le-send-mode-single');
          const btnNative = view.querySelector('#le-send-mode-native');
          const setActive = (mode) => {
            const all = [btnMulti, btnSingle, btnNative];
            for (const b of all) {
              if (!b) continue;
              b.removeAttribute('is-active');
              b.setAttribute('data-type', 'secondary');
            }
            if (mode === 'multi' && btnMulti) { btnMulti.setAttribute('is-active', ''); btnMulti.setAttribute('data-type', 'primary'); }
            else if (mode === 'image' && btnSingle) { btnSingle.setAttribute('is-active', ''); btnSingle.setAttribute('data-type', 'primary'); }
            else if (mode === 'native' && btnNative) { btnNative.setAttribute('is-active', ''); btnNative.setAttribute('data-type', 'primary'); }
          };
          setActive((cfg && cfg.sendMode) || 'multi');
          const updateMode = (m) => {
            const c = window.localEmote.getConfig();
            c.sendMode = m;
            const ok = window.localEmote.setConfig(c);
            let latest = c;
            try { latest = ok && window.localEmote.getConfig ? window.localEmote.getConfig() : c; } catch (_) {}
            const mode = latest && latest.sendMode ? latest.sendMode : m;
            try { dbg('settings: sendMode set to', mode); } catch (_) {}
            setActive(mode);
          };
          if (sendModeWrap) {
            const modeFromEvent = (e) => {
              try {
                const ids = {
                  'le-send-mode-multi': 'multi',
                  'le-send-mode-single': 'image',
                  'le-send-mode-native': 'native',
                };
                const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
                for (const n of path) {
                  if (n && n.id && ids[n.id]) return ids[n.id];
                }
                const el = e.target && e.target.closest ? e.target.closest('#le-send-mode-multi, #le-send-mode-single, #le-send-mode-native') : null;
                return el && ids[el.id] ? ids[el.id] : '';
              } catch (_) {
                return '';
              }
            };
            sendModeWrap.addEventListener(
              'click',
              (e) => {
                const mode = modeFromEvent(e);
                if (mode) updateMode(mode);
              },
              true
            );
          }
        })
        .catch(() => tryLoad(idx + 1));
    };

    tryLoad().catch(err => {
      console.error('[local_emotes] 加载设置失败', err);
      view.innerHTML = '<div style="padding:12px;color:#ef4444">设置页加载失败，请检查 settings.html 是否存在</div>';
    });
  } catch (e) {
    console.error('[local_emotes] 设置页初始化异常', e);
    view.innerHTML = '<div style="padding:12px;color:#ef4444">设置页初始化异常</div>';
  }
};

export const onVueComponentMount = (component) => {};
export const onVueComponentUnmount = (component) => {};




