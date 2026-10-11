// ==UserScript==
// @name         Pommu 入力欄ズレ修正
// @namespace    https://github.com/4STRA1
// @version      1.1
// @description  Pommu投稿画面で、固定ヘッダー/ツールバーに入力欄が隠れる問題を修正し、横幅を画面幅いっぱいに広げる
// @author       4STRA1
// @license      MIT
// @homepageURL  https://github.com/4STRA1/pommu-userscripts
// @supportURL   https://github.com/4STRA1/pommu-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/4STRA1/pommu-userscripts/main/pommu-input-fix2.user.js
// @updateURL    https://raw.githubusercontent.com/4STRA1/pommu-userscripts/main/pommu-input-fix2.user.js
// @match        https://ch.dlsite.com/pommu/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const MARGIN = 8;        // ヘッダー/ツールバーとの余白(px)
  const MIN_HEIGHT = 72;   // 入力欄の最低高さ(約3行)
  const TA_ID = 'post-text-area';
  let timer = null;
  const handled = new WeakSet();

  function getTextarea() {
    return document.getElementById(TA_ID);
  }

  // 画面上端に張り付いた帯(ヘッダー)と下端に張り付いた帯(ツールバー)の高さを測る
  function measureBars() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let header = 0;
    let footer = 0;

    document.querySelectorAll('body *').forEach((e) => {
      const p = getComputedStyle(e).position;
      if (p !== 'fixed' && p !== 'sticky') return;
      const b = e.getBoundingClientRect();
      // 帯状の要素だけを対象にする(全画面オーバーレイや小さなボタンは除外)
      if (b.width < vw * 0.9) return;
      if (b.height < 20 || b.height > vh * 0.5) return;
      if (b.top <= 1 && b.bottom > 0) header = Math.max(header, b.bottom);
      else if (b.bottom >= vh - 2 && b.top < vh) footer = Math.max(footer, vh - b.top);
    });

    return { header, footer };
  }

  // 入力欄の祖先にあるmax-widthを外して、画面幅いっぱいに広げる
  function widenLayout(ta) {
    let n = ta;
    while (n && n !== document.body) {
      if (getComputedStyle(n).maxWidth !== 'none') {
        n.style.setProperty('max-width', 'none', 'important');
      }
      n = n.parentElement;
    }
    document.documentElement.style.setProperty('overflow-x', 'hidden');
  }

  function update(scrollToCaret) {
    const ta = getTextarea();
    if (!ta) return;

    widenLayout(ta);

    const { header, footer } = measureBars();
    const root = document.documentElement;

    // 1) Chromeの自動スクロールがバーを避けるようにする
    root.style.setProperty('scroll-padding-top', (header + MARGIN) + 'px');
    root.style.setProperty('scroll-padding-bottom', (footer + MARGIN) + 'px');

    // 2) 入力欄の最低高さを、バーの間に収まる値に制限する
    ta.style.removeProperty('min-height');
    const orig = parseFloat(getComputedStyle(ta).minHeight) || 0;
    const available = window.innerHeight - header - footer - MARGIN * 2;
    if (orig > 0 && available < orig) {
      ta.style.setProperty('min-height', Math.max(MIN_HEIGHT, Math.floor(available)) + 'px', 'important');
    }

    // 3) 入力欄の上端がヘッダーの裏に入っていたら、ずれた分だけスクロールして戻す
    if (scrollToCaret) {
      const top = ta.getBoundingClientRect().top;
      const limit = header + MARGIN;
      if (top < limit) window.scrollBy(0, top - limit);
    }
  }

  function schedule(scrollToCaret, delay) {
    clearTimeout(timer);
    timer = setTimeout(() => update(scrollToCaret), delay);
  }

  // フォーカス直後はキーボード表示のアニメーション中なので、少し待ってから補正
  document.addEventListener('focusin', (e) => {
    if (e.target && e.target.id === TA_ID) {
      schedule(true, 100);
      setTimeout(() => update(true), 400);
    }
  }, true);

  window.addEventListener('resize', () => schedule(true, 100));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => schedule(true, 100));
  }

  // サイトはSPAなので、投稿画面へ画面遷移で入ったとき(入力欄が後から現れたとき)も処理する
  let obsTimer = null;
  new MutationObserver(() => {
    clearTimeout(obsTimer);
    obsTimer = setTimeout(() => {
      const ta = getTextarea();
      if (ta && !handled.has(ta)) {
        handled.add(ta);
        schedule(false, 100);
      }
    }, 200);
  }).observe(document.body, { childList: true, subtree: true });

  schedule(false, 300);
})();
