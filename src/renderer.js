// 设置页与渲染进程入口

// —— 样式注入（一次） ——
function injectLEStylesOnce() {
  if (document.getElementById("le-styles")) return;
  const style = document.createElement("style");
  style.id = "le-styles";
  style.textContent = `
  /* 主题变量（亮/暗） */
  :root {
    --le-bg: #fff;
    --le-fg: #111827;
    --le-muted: #6b7280;
    --le-border: rgba(0,0,0,.08);
    --le-hover-bg: rgba(0,0,0,.05);
    --le-active-bg: rgba(0,0,0,.08);
    --le-header-bg: #fafafa;
    --le-input-bg: #fff;
    --le-divider: rgba(0,0,0,.06);
    --le-icon: #4b5563;
    --le-icon-hover: #111827;
    --le-primary: #2563eb;
    --le-focus: rgba(37,99,235,.25);
    --le-image-border: rgba(0,0,0,.08);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --le-bg: #1f2937;
      --le-fg: #e5e7eb;
      --le-muted: #9ca3af;
      --le-border: rgba(255,255,255,.08);
      --le-hover-bg: rgba(255,255,255,.06);
      --le-active-bg: rgba(255,255,255,.10);
      --le-header-bg: rgba(255,255,255,.03);
      --le-input-bg: #111827;
      --le-divider: rgba(255,255,255,.06);
      --le-icon: #cfd4dc;
      --le-icon-hover: #fff;
      --le-primary: #60a5fa;
      --le-focus: rgba(96,165,250,.35);
      --le-image-border: rgba(255,255,255,.10);
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
    background: var(--le-bg) !important;
    color: var(--le-fg) !important;
    border: 1px solid var(--le-border) !important;
    box-shadow: 0 12px 30px rgba(0,0,0,.22) !important;
    border-radius: 10px !important;
    overflow: hidden !important;
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

  /* 滚动条 */
  #local-emote-overlay .le-grid::-webkit-scrollbar { width: 8px; height: 8px; }
  #local-emote-overlay .le-grid::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,.25); border-radius: 8px; }
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
        if (sel.rangeCount === 0) {
          range = document.createRange();
          range.selectNodeContents(editable);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          range = sel.getRangeAt(0);
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
  // 0) 最近缓存
  try {
    const lp = window.__le_lastPeer;
    if (lp && lp.chatType && lp.peerUid) return lp;
  } catch (_) {}
  // 1) lite_tools.getPeer（若可用）
  try {
    if (window.lite_tools && typeof window.lite_tools.getPeer === 'function') {
      const p = window.lite_tools.getPeer();
      if (p && p.chatType && p.peerUid) return p;
    }
  } catch (_) {}
  // 2) window.app.curAioData
  try {
    if (window.app && window.app.curAioData) {
      const c = window.app.curAioData;
      if (c.peer && c.peer.chatType && c.peer.peerUid) return c.peer;
      const chatType = c.chatType || (c.peer && c.peer.chatType);
      const peerUid = (c.header && c.header.uid) || (c.peer && c.peer.peerUid) || c.peerUid;
      if (chatType && peerUid) return { chatType, peerUid };
    }
  } catch (_) {}
  // 3) Vuex store 常见路径
  try {
    const store = window.app && window.app.__vue_app__ && window.app.__vue_app__.config && window.app.__vue_app__.config.globalProperties && window.app.__vue_app__.config.globalProperties.$store;
    const st = store && store.state;
    const candidates = [];
    if (st && st.common_Aio && st.common_Aio.curAioData) candidates.push(st.common_Aio.curAioData);
    if (st && st.aio_chatMsgArea && st.aio_chatMsgArea.curAioData) candidates.push(st.aio_chatMsgArea.curAioData);
    for (const c of candidates) {
      if (!c) continue;
      if (c.peer && c.peer.chatType && c.peer.peerUid) return c.peer;
      const chatType = c.chatType || (c.peer && c.peer.chatType);
      const peerUid = (c.header && c.header.uid) || (c.peer && c.peer.peerUid) || c.peerUid;
      if (chatType && peerUid) return { chatType, peerUid };
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
  // 5) 深度扫描 store 中的消息元素，尝试从元素容器/父对象推断 peer
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
        const peerUid = (parent.header && parent.header.uid) || (parent.peer && parent.peer.peerUid) || parent.peerUid;
        if (chatType && peerUid) { const pp = { chatType, peerUid }; try { window.__le_lastPeer = pp; } catch (_) {} return pp; }
      }
    }
  } catch (_) {}
  return null;
}
try { window.derivePeer = derivePeer; } catch (_) {}
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
      dbg('sendMsg debug hook install failed (lazy): nativeCall is non-writable');
    }
  } catch (_) {}
}
try { window.__le_installSendMsgHook = ensureLESendMsgDebugHookInstalled; } catch (_) {}

// 官方消息元素转换与发送
async function le_convertMessage(message) {
try { window.le_convertMessage = le_convertMessage; } catch (_) {}

// --- LE main-world bridge injection (works under contextIsolation) ---
try {
  (function installLEMainWorldBridge() {
    if (window.__LE_BRIDGE_ATTEMPTED) return; // avoid duplicate
    window.__LE_BRIDGE_ATTEMPTED = true;
    // 1) Inject a script into MAIN WORLD to expose proxy functions
    try {
      const s = document.createElement('script');
      s.id = 'le-main-bridge';
      s.textContent = `(() => {\n  try {\n    if (window.__LE_BRIDGE_INSTALLED) return;\n    window.__LE_BRIDGE_INSTALLED = true;\n    const pending = new Map();\n    window.addEventListener('message', (e) => {\n      const d = e.data;\n      if (!d || d.__from !== 'le-isolated' || !d.id) return;\n      const p = pending.get(d.id);\n      if (!p) return;\n      pending.delete(d.id);\n      if (d.error) {\n        const err = new Error(d.error.message || 'LE bridge error');\n        err.name = d.error.name || err.name;\n        err.stack = d.error.stack || err.stack;\n        p.reject(err);\n      } else {\n        p.resolve(d.result);\n      }\n    }, false);\n    function send(type, payload) {\n      const id = Math.random().toString(36).slice(2);\n      return new Promise((resolve, reject) => {\n        pending.set(id, { resolve, reject });\n        window.postMessage({ __to: 'le-isolated', id, type, payload }, '*');\n      });\n    }\n    // Expose proxies in MAIN WORLD\n    window.le_sendMessage = function(peer, messages, opts) {\n      return send('sendMessage', { peer, messages, opts });\n    };\n    window.le_convertMessage = function(messages) {\n      return send('convertMessage', { messages });\n    };\n    window.derivePeer = function() {\n      return send('derivePeer', {});\n    };\n  } catch (e) {\n    console.error('[local_emotes] main-world bridge install failed', e);\n  }\n})();`;
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
              result = await derivePeer();
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
    case 'image': {
      const path = message.path;
      if (!lt || !path) return null;
      try {
        await lt.nativeCall(
          { type: 'request', eventName: 'FileApi' },
          { cmdName: 'getFileType', cmdType: 'invoke', payload: [path] },
          true
        );
      } catch (_) {}
      let copyFile = null;
      try {
        copyFile = await lt.nativeCall(
          { type: 'request', eventName: 'ntApi' },
          { cmdName: 'nodeIKernelMsgService/copyFileWithDelExifInfo', cmdType: 'invoke', payload: [ { sourcePath: path, elementSubType: (Number(message && message.picSubType) === 1 ? 5 : 1) }, null ] },
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
          { cmdName: 'getImageSize', cmdType: 'invoke', payload: [newPath] },
          true
        );
      } catch (_) {
        try {
          imageSize = await lt.nativeCall(
            { type: 'request', eventName: 'FileApi' },
            { cmdName: 'getImageSizeFromPath', cmdType: 'invoke', payload: [newPath] },
            true
          );
        } catch (e2) { dbg('imageSize fallback failed', e2 && e2.message); }
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
      const picElement = {
        md5HexStr: (copyFile && copyFile.md5) || md5Hex, 
        picWidth: imageSize && imageSize.width,
        picHeight: imageSize && imageSize.height,
        fileName: getFileName(newPath),
        fileSize: fileSize,
        original: (Number(message && message.picSubType) === 1) ? false : true,
        picType: (fileType && fileType.ext === 'gif') ? 2000 : 1000,
        picSubType: (typeof message.picSubType === 'number' ? message.picSubType : 1),
        sourcePath: newPath,
        fileUuid: '',
        fileSubId: '',
        thumbFileSize: 0,
        thumbPath: undefined,
        summary: '',
      };
      return { elementType: 2, elementId: '', extBufForUI: new Uint8Array(), picElement };
    }
    default:
      return null;
  }
}

async function le_sendMessage(peer, messages) {
try { window.le_sendMessage = le_sendMessage; } catch (_) {}
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
try { window.scanStoreForMsgElements = scanStoreForMsgElements; } catch (_) {}

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

  const card = document.createElement('div');
  card.className = 'le-qqnt-card';

  // 移除旧的左侧分组栏，采用上下分区布局
  const content = document.createElement('div');
  content.className = 'le-qqnt-content';

  // 可滚动区域（包含“历史表情”和“本地表情”两个网格）
  const scroll = document.createElement('div');
  scroll.className = 'le-scroll';

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
  content.appendChild(scroll);
  content.appendChild(packsBar);
  card.appendChild(content);
  wrap.appendChild(card);

  // 状态
  let currentList = [];
  let activeIndex = -1;
  let selectedCat = '__recent__';
  let categoriesCache = [];
  let packsCache = [];

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

  // 新增：渲染“历史表情”
  async function renderRecentGrid() {
    dbg('renderRecentGrid: start');
    if (!recentGrid) return;
    recentGrid.innerHTML = '';
    let all = [];
    try { all = await window.localEmote.listRecent(); dbg('renderRecentGrid: got', all.length, 'items'); } catch (e) { dbg('renderRecentGrid: listRecent error', e && e.message); all = []; }
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
        let inserted = false;
        let sentOk = false;
        let cfg = null;
        let sendMode = 'multi';
        try {
          cfg = window.localEmote.getConfig ? window.localEmote.getConfig() : null;
          if (cfg && typeof cfg.sendMode === 'string') sendMode = cfg.sendMode;
        } catch (e) { dbg('recent click: read config error', e && e.message); }
        // 根据发送模式：仅多发需要经过输入框确认；其余模式直接发送
        // 等待 lite_tools 与 peer 就绪，避免 haveNative 误判
        let lt = (globalThis && globalThis.lite_tools) || window.lite_tools || null;
        if ((sendMode === 'native' || (ev && ev.altKey)) && (!lt || !derivePeer())) {
          try {
            const end = Date.now() + 800;
            while (Date.now() < end) {
              await new Promise(r => setTimeout(r, 50));
              lt = (globalThis && globalThis.lite_tools) || window.lite_tools || null;
              if (lt && derivePeer()) break;
            }
          } catch (_) {}
        }
        try { ensureLESendMsgDebugHookInstalled && ensureLESendMsgDebugHookInstalled(); } catch (_) {}
        const peer = derivePeer();
        const haveNative = !!(lt && peer);
        const doNative = (sendMode === 'native' && haveNative);
        dbg('recent click: sendMode=', sendMode, 'haveNative=', haveNative, 'peer=', peer);

        if ((sendMode === 'native' || (ev && ev.altKey)) && lt && peer) {
          dbg('recent click: native mode');
          try {
            const picSubType = 1;
            await le_sendMessage(peer, [{ type: 'image', path: p, picSubType }]);
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
        } else {
          dbg('recent click: multi/image mode');
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
        
        // 如果已经成功发送（native 模式），直接返回不执行后续逻辑
        if (sentOk && sendMode === 'native') {
          try { overlayInstance && overlayInstance.hide && overlayInstance.hide(); } catch (_) {}
          return;
        }
        
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
  }

  async function renderGrid() {
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
    currentList = all;
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
        let inserted = false;
        let sentOk = false;
        // 依据发送模式处理：点击即发。优先原生（保真），否则走 image 自动发送
        let cfg = null;
        let sendMode = 'multi';
        try { cfg = window.localEmote.getConfig ? window.localEmote.getConfig() : null; if (cfg && typeof cfg.sendMode === 'string') sendMode = cfg.sendMode; } catch (e) { dbg('grid click: read config error', e && e.message); }
        // 等待 lite_tools 与 peer 就绪，避免 haveNative 误判
        let lt = (globalThis && globalThis.lite_tools) || window.lite_tools || null;
        if ((sendMode === 'native' || (ev && ev.altKey)) && (!lt || !derivePeer())) {
          try {
            const end = Date.now() + 800;
            while (Date.now() < end) {
              await new Promise(r => setTimeout(r, 50));
              lt = (globalThis && globalThis.lite_tools) || window.lite_tools || null;
              if (lt && derivePeer()) break;
            }
          } catch (_) {}
        }
        try { ensureLESendMsgDebugHookInstalled && ensureLESendMsgDebugHookInstalled(); } catch (_) {}
        const peer = derivePeer();
        const haveNative = !!(lt && peer);
        const doNative = (sendMode === 'native' && haveNative);
        dbg('grid click: sendMode=', sendMode, 'haveNative=', haveNative, 'peer=', peer);

        if ((sendMode === 'native' || (ev && ev.altKey)) && lt && peer) {
          dbg('grid click: native mode');
          try {
            const picSubType = 1;
            await le_sendMessage(peer, [{ type: 'image', path: p, picSubType }]);
            sentOk = true;
            dbg('grid click: native send ok');
            try { if (window.localEmote && window.localEmote.markRecent) window.localEmote.markRecent(p); } catch (_) {}
            try { overlayInstance && overlayInstance.hide && overlayInstance.hide(); } catch (_) {}
            return;
          } catch (e) {
            sentOk = false;
          }
          inserted = false;
        } else {
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
        
        // 如果已经成功发送（native 模式），直接返回不执行后续逻辑
        if (sentOk && sendMode === 'native') {
          try { overlayInstance && overlayInstance.hide && overlayInstance.hide(); } catch (_) {}
          return;
        }

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
  }
  function hide() {
    dbg('hide overlay');
    wrap.style.display = 'none';
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

// 首次尝试注入
const tryInject = () => {
  if (injected) { dbg('tryInject: already injected, skip'); return; }
  injected = injectButton();
  dbg('tryInject: result', injected);
};
tryInject();

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
          const showNameSwitch = view.querySelector('#le-show-filename');
          const debugSwitch = view.querySelector('#le-debug');

          if (versionEl) {
            try { versionEl.textContent = (LiteLoader.plugins?.["local_emotes"]?.manifest?.version) || ''; } catch (_) {}
          }
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
            window.localEmote.setConfig(c);
            try { dbg('settings: sendMode set to', m); } catch (_) {}
            setActive(m);
          };
          if (btnMulti) btnMulti.addEventListener('click', () => updateMode('multi'));
          if (btnSingle) btnSingle.addEventListener('click', () => updateMode('image'));
          if (btnNative) btnNative.addEventListener('click', () => updateMode('native'));
          // 兜底：使用事件委托，保证在某些自定义组件内部阻止冒泡时依然能工作
          if (sendModeWrap) {
            sendModeWrap.addEventListener(
              'click',
              (e) => {
                try {
                  const el = e.target && (e.target.closest ? e.target.closest('#le-send-mode-multi, #le-send-mode-single, #le-send-mode-native') : null);
                  if (!el) return;
                  if (el.id === 'le-send-mode-multi') updateMode('multi');
                  else if (el.id === 'le-send-mode-single') updateMode('image');
                  else if (el.id === 'le-send-mode-native') updateMode('native');
                } catch (_) {}
              },
              true
            );
          }
          // 终极兜底：在整个 settings 视图上捕获 click，通过 composedPath 穿透 Shadow DOM
          if (view && view.addEventListener) {
            view.addEventListener('click', (e) => {
              try {
                const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
                let el = null;
                for (const n of path) {
                  if (!n || !n.id) continue;
                  if (n.id === 'le-send-mode-multi' || n.id === 'le-send-mode-single' || n.id === 'le-send-mode-native') { el = n; break; }
                }
                if (!el) return;
                if (el.id === 'le-send-mode-multi') updateMode('multi');
                else if (el.id === 'le-send-mode-single') updateMode('image');
                else if (el.id === 'le-send-mode-native') updateMode('native');
              } catch (_) {}
            }, true);
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




