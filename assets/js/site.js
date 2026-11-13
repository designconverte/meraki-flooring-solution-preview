/* Meraki Flooring Solution: page motion and UI.
   Everything is visible in the HTML first; motion starts from that final state (gsap.from with clearProps).
   Libraries are optional: without GSAP, ScrollTrigger or Lenis the page still works and shows everything. */
(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.remove('no-js');
  doc.classList.add('js');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';
  var hasST = hasGsap && typeof window.ScrollTrigger !== 'undefined';
  var gsap = window.gsap;
  if (hasST) gsap.registerPlugin(window.ScrollTrigger);

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var isDesktop = function () { return window.innerWidth >= 1024; };

  /* ── smooth scroll (fine pointer, desktop, no reduced motion) ── */
  var lenis = null;
  if (!reduce && finePointer && isDesktop() && typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
    if (hasST) {
      lenis.on('scroll', window.ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  function scrollToEl(el, offset) {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: offset || -100 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  /* ── header: solid after the hero, hides on fast scroll down ── */
  var hdr = $('[data-hdr]');
  var hero = $('.hero');
  var lastY = window.scrollY;
  function onScrollHeader() {
    if (!hdr) return;
    var y = window.scrollY;
    var limit = hero ? Math.max(80, (isDesktop() ? 60 : hero.querySelector('.hero__media').offsetHeight - 70)) : 60;
    hdr.classList.toggle('is-solid', y > limit);
    var menuOpen = doc.classList.contains('menu-open');
    hdr.classList.toggle('is-hidden', !menuOpen && y > 700 && y > lastY + 4);
    if (y < lastY - 4 || y < 700) hdr.classList.remove('is-hidden');
    lastY = y;
  }
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  onScrollHeader();

  /* ── hero: diagonal cut measured from the copy column, herringbone row placed along it ── */
  var seam = $('[data-seam]');
  function layoutHero() {
    if (!hero) return;
    var hb = hero.getBoundingClientRect();
    var W = hb.width;
    var media = $('.hero__media', hero);
    var p1, p2, stripW;
    if (isDesktop()) {
      var copy = $('.hero__copy', hero).getBoundingClientRect();
      var form = $('.hero__form', hero).getBoundingClientRect();
      var cutBot = Math.min(copy.right - hb.left + 40, form.left - hb.left - 24);
      var cutTop = Math.min(cutBot + W * 0.12, form.left - hb.left + 40);
      hero.style.setProperty('--cut-top', cutTop + 'px');
      hero.style.setProperty('--cut-bot', cutBot + 'px');
      p1 = { x: cutTop, y: -20 };
      p2 = { x: cutBot, y: hb.height + 20 };
      stripW = 80;
    } else {
      var h1 = $('.hero__h1', hero);
      var band = h1.getBoundingClientRect().bottom - hb.top + 56;
      hero.style.setProperty('--band', Math.round(band) + 'px');
      p1 = { x: -20, y: band - 34 - 16 };
      p2 = { x: W + 20, y: band - 14 };
      stripW = 34;
      void media;
    }
    if (!seam) return;
    var dx = p2.x - p1.x, dy = p2.y - p1.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    var ang = Math.atan2(-dx, dy) * 180 / Math.PI;
    var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    seam.style.setProperty('--seam-w', stripW + 'px');
    seam.style.setProperty('--seam-l', len + 'px');
    seam.style.setProperty('--seam-x', (mx - stripW / 2) + 'px');
    seam.style.setProperty('--seam-y', (my - len / 2) + 'px');
    seam.style.setProperty('--seam-a', ang + 'deg');
    seam.classList.add('is-placed');
  }
  layoutHero();
  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { layoutHero(); if (hasST) window.ScrollTrigger.refresh(); }, 120);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutHero);

  /* signature: the row lays leg by leg, then one finish pass over the photo */
  if (hero && seam && !reduce) {
    var start = function () {
      seam.classList.add('is-laying');
      var visible = Math.ceil(parseFloat(getComputedStyle(seam).height) / (parseFloat(getComputedStyle(seam).width) / 158 * 60)) * 2;
      var step = 26;
      setTimeout(function () { hero.classList.add('is-finished'); }, 260 + Math.min(visible, 90) * step * 0.7);
    };
    requestAnimationFrame(function () { requestAnimationFrame(start); });
  }

  /* hero intro: H1 sentences rise from their masks, then the supporting lines */
  if (hasGsap && !reduce && hero) {
    gsap.from($$('.hero__h1 .ln > span', hero), { yPercent: 108, duration: 1.15, ease: 'expo.out', stagger: 0.12, delay: 0.15, clearProps: 'transform' });
    gsap.from($$('[data-intro]', hero), { y: 22, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.07, delay: 0.35, clearProps: 'transform,opacity' });
  }

  /* ── reveals ── */
  if (hasST && !reduce) {
    $$('[data-reveal]').forEach(function (group) {
      var kids = group.children;
      gsap.from(kids, { y: 32, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08, clearProps: 'transform,opacity',
        scrollTrigger: { trigger: group, start: 'top 85%', once: true } });
    });
    $$('[data-reveal-title]').forEach(function (el) {
      gsap.from(el, { y: 28, opacity: 0, duration: 1, ease: 'expo.out', clearProps: 'transform,opacity',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
  }

  /* ── tape measure runs with the scroll ── */
  var tape = $('[data-tape-track]');
  if (tape && hasST && !reduce) {
    gsap.fromTo(tape, { x: 0 }, { x: function () { return -(tape.scrollWidth / 2); }, ease: 'none',
      scrollTrigger: { trigger: '[data-tape]', start: 'top bottom', end: '+=1600', scrub: 0.6, invalidateOnRefresh: true } });
  }

  /* ── counters (the HTML already holds the final value) ── */
  if (hasST && !reduce) {
    $$('[data-count]').forEach(function (el) {
      var end = parseInt(el.getAttribute('data-count'), 10);
      if (!(end > 1)) return;
      var o = { v: 0 };
      gsap.to(o, { v: end, duration: 1.4, ease: 'power2.out', onUpdate: function () { el.textContent = Math.round(o.v); },
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }, onStart: function () { el.textContent = '0'; } });
    });
  }

  /* ── manifesto: words light up with the scroll, like a finish coat passing ── */
  var words = $('[data-words]');
  if (words && hasST && !reduce) {
    $$('.mani__l', words).forEach(function (line) {
      var parts = line.innerHTML.split(/(\s+)/);
      line.innerHTML = parts.map(function (p) { return /^\s+$/.test(p) ? p : '<span class="mani__w">' + p + '</span>'; }).join('');
    });
    var ws = $$('.mani__w', words);
    window.ScrollTrigger.create({
      trigger: words, start: 'top 80%', end: 'bottom 45%', scrub: true,
      onUpdate: function (self) {
        var lit = self.progress * (ws.length + 3);
        for (var i = 0; i < ws.length; i++) {
          var o = Math.min(1, Math.max(0.22, lit - i));
          ws[i].style.setProperty('--o', o.toFixed(2));
        }
      }
    });
  }

  /* ── services: preview follows the cursor; a click preselects the floor in the hero form ── */
  var svcList = $('[data-svc]');
  if (svcList && finePointer) {
    svcList.addEventListener('pointermove', function (e) {
      var row = e.target.closest('.svc__row');
      if (!row) return;
      var r = row.getBoundingClientRect();
      row.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      row.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }
  function goEstimate(service) {
    var heroForm = $('#quote-hero');
    if (!heroForm) return;
    var onStep1 = !$('[data-cs-step="1"]', heroForm).hidden;
    if (service && onStep1) {
      var radio = heroForm.querySelector('input[name="service"][value="' + service + '"]');
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
    }
    scrollToEl($('#estimate'), isDesktop() ? -140 : -90);
    var zip = $('input[name="zip"]', heroForm);
    if (onStep1 && zip) setTimeout(function () { zip.focus({ preventScroll: true }); }, reduce ? 0 : 700);
  }
  $$('[data-service]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); goEstimate(a.getAttribute('data-service')); });
  });
  $$('[data-go-estimate]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (a.hasAttribute('data-menu-link')) return;
      e.preventDefault(); goEstimate(null);
    });
  });

  /* ── process: the rail of boards fills with the scroll, each step lights when reached ── */
  var rail = $('[data-rail]');
  var steps = $$('[data-step]');
  if (rail && hasST && !reduce) {
    gsap.fromTo(rail, { scaleY: 0 }, { scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: '[data-steps]', start: 'top 70%', end: 'bottom 60%', scrub: 0.4 } });
    steps.forEach(function (s) {
      window.ScrollTrigger.create({ trigger: s, start: 'top 68%', onEnter: function () { s.classList.add('is-on'); }, onLeaveBack: function () { s.classList.remove('is-on'); } });
    });
  } else {
    steps.forEach(function (s) { s.classList.add('is-on'); });
  }

  /* ── work: columns at different speeds (desktop) ── */
  if (hasST && !reduce) {
    window.ScrollTrigger.matchMedia({
      '(min-width: 1024px)': function () {
        $$('.mosaic__col').forEach(function (col) {
          var sp = parseFloat(col.getAttribute('data-speed')) || 0;
          gsap.fromTo(col, { y: sp * 4 }, { y: -sp * 4, ease: 'none', scrollTrigger: { trigger: '.mosaic', start: 'top bottom', end: 'bottom top', scrub: true } });
        });
      }
    });
    var seal = $('[data-seal]');
    if (seal) gsap.fromTo(seal, { rotate: -50 }, { rotate: 40, ease: 'none', scrollTrigger: { trigger: '.name', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  /* ── gallery: full-screen dialog with arrows, keys and swipe ── */
  var shots = $$('[data-lb]');
  if (shots.length && typeof HTMLDialogElement !== 'undefined') {
    var dlg = document.createElement('dialog');
    dlg.className = 'lb';
    dlg.setAttribute('aria-label', 'Photo gallery');
    dlg.innerHTML = '<div class="lb__stage"><img class="lb__img" alt=""></div>' +
      '<div class="lb__bar"><p class="lb__cap"></p><p class="lb__count"></p></div>' +
      '<button class="lb__btn lb__close" type="button" aria-label="Close gallery"><svg class="ic" aria-hidden="true"><use href="#i-close"></use></svg></button>' +
      '<button class="lb__btn lb__prev" type="button" aria-label="Previous photo"><svg class="ic" aria-hidden="true"><use href="#i-arrow-left"></use></svg></button>' +
      '<button class="lb__btn lb__next" type="button" aria-label="Next photo"><svg class="ic" aria-hidden="true"><use href="#i-arrow-right"></use></svg></button>';
    document.body.appendChild(dlg);
    var lbImg = $('.lb__img', dlg), lbCap = $('.lb__cap', dlg), lbCount = $('.lb__count', dlg);
    var cur = 0, opener = null;
    var show = function (i) {
      cur = (i + shots.length) % shots.length;
      var src = shots[cur].querySelector('img');
      var set = (src.getAttribute('srcset') || '').split(',').map(function (s) { return s.trim().split(' ')[0]; });
      lbImg.src = set[set.length - 1] || src.currentSrc || src.src;
      lbImg.alt = src.alt;
      lbCap.textContent = shots[cur].getAttribute('data-cap') || '';
      lbCount.textContent = (cur + 1) + ' / ' + shots.length;
    };
    shots.forEach(function (b, i) {
      b.addEventListener('click', function () {
        opener = b; show(i); dlg.showModal(); if (lenis) lenis.stop();
      });
    });
    $('.lb__close', dlg).addEventListener('click', function () { dlg.close(); });
    $('.lb__prev', dlg).addEventListener('click', function () { show(cur - 1); });
    $('.lb__next', dlg).addEventListener('click', function () { show(cur + 1); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.classList.contains('lb__stage')) dlg.close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(cur - 1);
      if (e.key === 'ArrowRight') show(cur + 1);
    });
    dlg.addEventListener('close', function () { if (lenis) lenis.start(); if (opener) opener.focus(); });
    var sx = null;
    dlg.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    dlg.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var d = e.clientX - sx; sx = null;
      if (Math.abs(d) > 50) show(cur + (d < 0 ? 1 : -1));
    });
  }

  /* ── forms: step counter, step-2 answers composed into "details", request summary ── */
  $$('form[data-cs-form]').forEach(function (form) {
    var now = $('[data-step-now]', form);
    var stepEls = $$('[data-cs-step]', form);
    var details = $('[data-details]', form);
    var sumBox = $('[data-request-summary]', form);
    var sumText = $('[data-request-summary-text]', form);
    var val = function (name) { var el = form.querySelector('[name="' + name + '"]:checked'); return el ? el.value : ''; };
    var label = function (name) { var el = form.querySelector('[name="' + name + '"]:checked'); return el ? el.parentNode.textContent.replace(/\s+/g, ' ').trim() : ''; };
    function compose() {
      if (!details) return;
      var notes = (form.querySelector('[name="notes"]') || {}).value || '';
      var parts = [];
      if (val('size')) parts.push('Size: ' + val('size'));
      if (val('timeline')) parts.push('Start: ' + val('timeline'));
      if (notes.trim()) parts.push('Notes: ' + notes.trim());
      details.value = parts.join(' | ').slice(0, 1000);
      if (sumBox && sumText) {
        var zip = (form.querySelector('[name="zip"]') || {}).value || '';
        var bits = [label('service'), zip ? 'ZIP ' + zip : '', label('size'), label('timeline')].filter(Boolean);
        sumText.textContent = bits.join(' · ');
        sumBox.hidden = bits.length === 0;
      }
    }
    form.addEventListener('change', compose);
    form.addEventListener('input', compose);
    form.addEventListener('submit', compose, true);
    var sync = function () {
      var visible = stepEls.filter(function (s) { return !s.hidden; })[0];
      if (!visible) return;
      var k = visible.getAttribute('data-cs-step');
      if (now && /^\d$/.test(k)) now.textContent = k;
      form.classList.toggle('is-done', k === 'done');
      if (k === '3') compose();
    };
    if (typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(sync);
      stepEls.forEach(function (s) { mo.observe(s, { attributes: true, attributeFilter: ['hidden'] }); });
    }
    compose();
  });

  /* ── mobile bar: after the hero form, hidden while the final form is on screen ── */
  var mbar = $('[data-mbar]');
  var heroForm = $('[data-hero-form]');
  var finalForm = $('[data-final-form]');
  if (mbar && heroForm && 'IntersectionObserver' in window) {
    var pastHero = false, finalOn = false;
    var paint = function () { mbar.classList.toggle('is-on', pastHero && !finalOn); };
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { pastHero = !e.isIntersecting && e.boundingClientRect.top < 0; });
      paint();
    }).observe(heroForm);
    if (finalForm) new IntersectionObserver(function (es) {
      es.forEach(function (e) { finalOn = e.isIntersecting; });
      paint();
    }, { threshold: 0.15 }).observe(finalForm);
  }

  /* ── mobile menu: focus trapped, Esc closes, focus returns to the button ── */
  var menu = $('[data-menu]');
  var toggle = $('[data-menu-toggle]');
  if (menu && toggle) {
    var main = $('#main'), footer = $('.ftr');
    var focusables = function () { return $$('a[href], button:not([disabled])', menu); };
    var open = function () {
      menu.hidden = false; doc.classList.add('menu-open'); toggle.setAttribute('aria-expanded', 'true');
      [main, footer, hdr].forEach(function (el) { if (el) el.inert = true; });
      if (lenis) lenis.stop();
      var f = focusables(); if (f[1]) f[1].focus();
    };
    var close = function (back) {
      doc.classList.remove('menu-open'); toggle.setAttribute('aria-expanded', 'false');
      [main, footer, hdr].forEach(function (el) { if (el) el.inert = false; });
      if (lenis) lenis.start();
      menu.hidden = true;
      if (back !== false) toggle.focus();
    };
    toggle.addEventListener('click', open);
    $('[data-menu-close]', menu).addEventListener('click', function () { close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) close();
    });
    menu.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = focusables(), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    $$('[data-menu-link]', menu).forEach(function (a) {
      a.addEventListener('click', function (e) {
        var href = a.getAttribute('href') || '';
        var id = href.indexOf('#') > -1 ? href.slice(href.indexOf('#')) : '';
        close(false);
        if (a.hasAttribute('data-go-estimate')) { e.preventDefault(); goEstimate(null); return; }
        if (id && $(id)) { e.preventDefault(); scrollToEl($(id), -80); }
      });
    });
  }

  /* in-page anchors go through Lenis when it is on */
  if (lenis) {
    $$('a[href^="/#"], a[href^="#"]').forEach(function (a) {
      if (a.hasAttribute('data-service') || a.hasAttribute('data-go-estimate') || a.hasAttribute('data-menu-link')) return;
      a.addEventListener('click', function (e) {
        var href = a.getAttribute('href'); var id = href.slice(href.indexOf('#'));
        var t = id.length > 1 ? $(id) : null;
        if (t) { e.preventDefault(); scrollToEl(t, -90); }
      });
    });
  }

  if (hasST) window.addEventListener('load', function () { layoutHero(); window.ScrollTrigger.refresh(); });
})();
