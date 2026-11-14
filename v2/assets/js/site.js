/* Meraki Flooring Solution · home V2: page motion and UI.
   Everything is visible in the HTML first; motion starts from that final state (gsap.from with clearProps).
   Libraries are optional: without GSAP, ScrollTrigger, Lenis or the floor engine the page still works and shows everything. */
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
  var MF = window.MerakiFloor || null;

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
  function scrollToY(y) {
    if (lenis) lenis.scrollTo(y);
    else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }
  function scrollToEl(el, offset) {
    if (!el) return;
    scrollToY(Math.max(0, el.getBoundingClientRect().top + window.scrollY + (offset || -100)));
  }

  /* ── header: transparent over the dark hero, paper after it, hides on fast scroll down ── */
  var hdr = $('[data-hdr]');
  var hero = $('[data-hero]');
  var lastY = window.scrollY;
  function onScrollHeader() {
    if (!hdr) return;
    var y = window.scrollY;
    var formBox = $('[data-hero-form]');
    var limit = !hero ? 60 : isDesktop() || !formBox ? Math.max(80, hero.offsetHeight - 72) : Math.max(60, formBox.getBoundingClientRect().top + y - 72);
    hdr.classList.toggle('is-solid', y > limit);
    var menuOpen = doc.classList.contains('menu-open');
    hdr.classList.toggle('is-hidden', !menuOpen && y > 900 && y > lastY + 4);
    if (y < lastY - 4 || y < 900) hdr.classList.remove('is-hidden');
    lastY = y;
  }
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  onScrollHeader();

  /* ── swatches: every [data-swatch] gets its material painted by the floor engine ── */
  var swCache = {};
  function swatchUrl(mat, size) {
    if (!MF) return '';
    var key = mat + ':' + size;
    if (!swCache[key]) {
      var dims = size === 'big' ? [420, 336, 16] : size === 'room' ? [240, 240, 9] : [132, 92, 7];
      swCache[key] = MF.swatch(mat, dims[0], dims[1], dims[2]);
    }
    return swCache[key];
  }
  function paintSwatches(root, size) {
    $$('[data-swatch]', root).forEach(function (el) {
      var big = el.hasAttribute('data-swatch-big');
      if ((size === 'big') !== big) return;
      var url = swatchUrl(el.getAttribute('data-swatch'), size);
      if (url) el.style.backgroundImage = 'url("' + url + '")';
    });
  }

  /* ── 1 · the floor: plan-view canvas tilted in 3D; the form's floor choice lays a new floor ── */
  var floorEl = $('[data-floor]');
  var plane = $('[data-floor-plane]');
  var canvas = $('[data-floor-canvas]');
  var heroForm = $('#quote-hero');
  var floor = null;
  var floorName = $('[data-floor-name]'), floorSrc = $('[data-floor-src]');
  function floorCaption(mat) {
    if (!MF || !floorName) return;
    var m = MF.materials[mat] || MF.materials['hardwood-installation'];
    floorName.textContent = m.label;
    if (floorSrc) floorSrc.textContent = m.real ? 'Wood from a Meraki job' : 'Illustration';
  }
  function viewWindow() {
    if (!plane || !floorEl) return [0, 1];
    var pl = plane.offsetLeft, pw = plane.offsetWidth, fw = floorEl.offsetWidth;
    return [Math.max(0, -pl / pw), Math.min(1, (-pl + fw) / pw)];
  }
  if (MF && canvas && hero) {
    floor = MF.create(canvas, { unit: function () { return isDesktop() ? 30 : 18; }, view: viewWindow() });
    MF.load().then(function () {
      paintSwatches(document, 'small');
      var start = function () {
        floor.lay('hardwood-installation', { fresh: true, instant: reduce, dur: 0.55, done: function () { if (!reduce) hero.classList.add('is-finished'); } });
      };
      if (reduce) start(); else requestAnimationFrame(function () { requestAnimationFrame(start); });
    });
    var resizeFloor;
    var lastW = window.innerWidth;
    window.addEventListener('resize', function () {
      if (Math.abs(window.innerWidth - lastW) < 2) return; // mobile URL bar: ignore height-only resizes
      lastW = window.innerWidth;
      clearTimeout(resizeFloor);
      resizeFloor = setTimeout(function () { floor.redraw(); }, 160);
    });
  } else if (plane) {
    plane.classList.add('floor__plane--static');
  }

  /* raking light: the installer's low light that shows the grain; follows a fine pointer */
  if (hero && floorEl && finePointer && !reduce) {
    var rake = $('[data-rake]');
    hero.addEventListener('pointermove', function (e) {
      var r = floorEl.getBoundingClientRect();
      if (e.clientY < r.top - 40) { hero.classList.remove('is-raking'); return; }
      var fx = (e.clientX - r.left) / r.width;
      var fy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      var pl = plane.offsetLeft / floorEl.offsetWidth, pw = plane.offsetWidth / floorEl.offsetWidth;
      rake.style.setProperty('--lx', ((fx - pl) / pw * 100).toFixed(2) + '%');
      rake.style.setProperty('--ly', (100 - Math.pow(1 - fy, 0.55) * 42).toFixed(2) + '%');
      hero.classList.add('is-raking');
      if (hasGsap) gsap.to(plane, { '--rz': ((fx - 0.5) * -2.4).toFixed(2) + 'deg', duration: 0.8, ease: 'power2.out', overwrite: 'auto' });
    });
    hero.addEventListener('pointerleave', function () { hero.classList.remove('is-raking'); });
  }

  /* scroll: the camera lowers as the hero leaves */
  if (hasST && !reduce && plane) {
    gsap.fromTo(plane, { '--rx': '66deg' }, { '--rx': '75deg', ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.5 } });
  }

  /* hero intro: H1 sentences rise from their masks, then the supporting lines */
  if (hasGsap && !reduce && hero) {
    gsap.from($$('.hero__h1 .ln > span', hero), { yPercent: 108, duration: 1.15, ease: 'expo.out', stagger: 0.12, delay: 0.1, clearProps: 'transform' });
    gsap.from($$('[data-intro]', hero), { y: 22, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.07, delay: 0.3, clearProps: 'transform,opacity' });
  }

  /* ── reveals ── */
  if (hasST && !reduce) {
    $$('[data-reveal]').forEach(function (group) {
      gsap.from(group.children, { y: 32, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08, clearProps: 'transform,opacity',
        scrollTrigger: { trigger: group, start: 'top 85%', once: true } });
    });
    $$('[data-reveal-title]').forEach(function (el) {
      gsap.from(el, { y: 28, opacity: 0, duration: 1, ease: 'expo.out', clearProps: 'transform,opacity',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
  }

  /* ── 2 · tape measure runs with the scroll ── */
  var tape = $('[data-tape-track]');
  if (tape && hasST && !reduce) {
    gsap.fromTo(tape, { x: 0 }, { x: function () { return -(tape.scrollWidth / 2); }, ease: 'none',
      scrollTrigger: { trigger: '[data-tape]', start: 'top bottom', end: '+=1800', scrub: 0.6, invalidateOnRefresh: true } });
  }

  /* ── 3 · the box lands; the label prints line by line; counters ── */
  if (hasST && !reduce) {
    var box = $('[data-box]');
    if (box) gsap.from(box, { y: -60, rotate: -2.5, duration: 1.1, ease: 'back.out(1.6)', clearProps: 'transform', scrollTrigger: { trigger: box, start: 'top 80%', once: true } });
    var label = $('[data-label]');
    if (label) {
      gsap.from(label.querySelectorAll('.label__top, .label__row, .label__foot'), { clipPath: 'inset(0 0 100% 0)', y: -6, duration: 0.5, ease: 'steps(6)', stagger: 0.16, clearProps: 'clipPath,transform',
        scrollTrigger: { trigger: label, start: 'top 82%', once: true } });
    }
    $$('[data-count]').forEach(function (el) {
      var end = parseInt(el.getAttribute('data-count'), 10);
      if (!(end > 1)) return;
      var o = { v: 0 };
      gsap.to(o, { v: end, duration: 1.4, ease: 'power2.out', onUpdate: function () { el.textContent = Math.round(o.v); },
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }, onStart: function () { el.textContent = '0'; } });
    });
  }

  /* ── 4 · the chalk line snaps across "lowest price"; "value" gets its board ── */
  var chalk = $('[data-chalk]');
  var value = $('.mani__value');
  if (chalk) {
    var snap = function () {
      chalk.classList.add('is-snapped');
      if (value) setTimeout(function () { value.style.setProperty('--v', '1'); }, reduce ? 0 : 1100);
    };
    if (value && !reduce) value.style.setProperty('--v', '0');
    if (hasST && !reduce) window.ScrollTrigger.create({ trigger: chalk, start: 'top 68%', once: true, onEnter: snap });
    else snap();
  }

  /* ── 5 · the gallery: each row is tapped tight, joints close as it enters (desktop) ── */
  if (hasST && !reduce) {
    window.ScrollTrigger.matchMedia({
      '(min-width: 1024px)': function () {
        $$('.planks__row').forEach(function (row) {
          var dir = parseFloat(row.getAttribute('data-row')) || 1;
          gsap.fromTo(row, { '--gap': '56px', x: dir * 90 }, { '--gap': '10px', x: 0, ease: 'none',
            scrollTrigger: { trigger: row, start: 'top bottom', end: 'top 40%', scrub: 0.6 } });
        });
      }
    });
  }

  /* ── 6 · the sample rack: faces painted when near, samples swing on their hooks and settle ── */
  var rack = $('[data-rack]');
  if (rack) {
    var paintRack = function () { paintSwatches(rack, 'big'); };
    if ('IntersectionObserver' in window) {
      var rio = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) {
          rio.disconnect();
          if (MF) MF.load().then(paintRack);
        }
      }, { rootMargin: '600px 0px' });
      rio.observe(rack);
    } else if (MF) MF.load().then(paintRack);
    if (hasST && !reduce) {
      $$('.rack__row', rack).forEach(function (row) {
        var items = $$('.smp', row);
        gsap.from(items, { rotate: function (i) { return i % 2 ? 9 : -9; }, y: -14, duration: 1.7, ease: 'elastic.out(1, 0.35)', stagger: 0.09, clearProps: 'transform',
          scrollTrigger: { trigger: row, start: 'top 82%', once: true } });
      });
    }
  }

  /* ── 7 · process: the plan builds itself while the steps scroll ── */
  var scene = $('[data-scene]');
  var steps = $$('[data-step]');
  if (scene && steps.length && hasST && !reduce) {
    var sn = $('[data-scene-n]'), st = $('[data-scene-t]');
    scene.setAttribute('data-s', '0');
    var setStep = function (n) {
      scene.setAttribute('data-s', String(n));
      steps.forEach(function (s, i) { s.classList.toggle('is-on', i < n); });
      if (sn) sn.textContent = '0' + Math.max(1, n);
      if (st) st.textContent = steps[Math.max(0, n - 1)].getAttribute('data-t');
    };
    steps.forEach(function (s, i) {
      window.ScrollTrigger.create({ trigger: s, start: isDesktop() ? 'top 62%' : 'top 75%', onEnter: function () { setStep(i + 1); }, onLeaveBack: function () { setStep(i); } });
    });
  } else {
    steps.forEach(function (s) { s.classList.add('is-on'); });
  }

  /* ── 8 · the name rises; the punch list gets its pencil ticks ── */
  if (hasST && !reduce) {
    var word = $$('.name__w span');
    if (word.length) gsap.from(word, { yPercent: 60, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1, clearProps: 'transform,opacity', scrollTrigger: { trigger: '.name__w', start: 'top 85%', once: true } });
  }
  function onceVisible(el, cls, margin) {
    if (!el) return;
    if (reduce || !('IntersectionObserver' in window)) { el.classList.add(cls); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { el.classList.add(cls); io.disconnect(); } });
    }, { rootMargin: margin || '0px 0px -25% 0px' });
    io.observe(el);
  }
  onceVisible($('[data-punch]'), 'is-on');
  /* ── 9 · the map: towns drop in a wave from Charlotte ── */
  onceVisible($('[data-map]'), 'is-on', '0px 0px -20% 0px');

  /* open now? (Charlotte time) */
  (function () {
    var els = $$('[data-open-status]');
    if (!els.length || typeof Intl === 'undefined') return;
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      var get = function (t) { var p = parts.filter(function (x) { return x.type === t; })[0]; return p ? p.value : ''; };
      var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      var d = days.indexOf(get('weekday')), h = parseInt(get('hour'), 10) % 24, m = parseInt(get('minute'), 10);
      var t = h + m / 60;
      var hours = function (day) { return day >= 1 && day <= 5 ? [8, 18] : day === 6 ? [8, 12] : null; };
      var today = hours(d), open = !!(today && t >= today[0] && t < today[1]);
      var text;
      if (open) text = 'Open now · until ' + (today[1] === 18 ? '6 PM' : '12 PM') + ' in Charlotte';
      else {
        var nd = d, label = '';
        for (var k = 0; k < 8; k++) {
          var hh = hours(nd);
          if (hh && (k > 0 || t < hh[0])) { label = k === 0 ? 'today' : k === 1 ? 'tomorrow' : days[nd]; break; }
          nd = (nd + 1) % 7;
        }
        text = 'Closed now · opens ' + label + ' at 8 AM';
      }
      els.forEach(function (el) {
        el.classList.toggle('is-open', open);
        var tx = $('[data-open-text]', el); if (tx) tx.textContent = text;
      });
    } catch (_e) { /* keeps the static hours */ }
  })();

  /* ── forms: material → floor + swatch vars; step counter; answers composed into "details"; the request ticket ── */
  var MAT_NAMES = {
    'hardwood-installation': 'Hardwood', 'lvp-installation': 'LVP', 'laminate-installation': 'Laminate', 'sand-refinish': 'Sand & refinish',
    'stairs': 'Stairs', 'tile-installation': 'Tile', 'carpet-installation': 'Carpet', 'vct-installation': 'VCT'
  };
  function setFormMaterial(form, mat) {
    if (!mat) return;
    var ref = $('[data-swatch="' + mat + '"]');
    form.style.setProperty('--sw-cur', (ref ? getComputedStyle(ref).getPropertyValue('--sw') : '') || '#B88F5E');
    var url = swatchUrl(mat, 'room');
    if (url) form.style.setProperty('--mat-img', 'url("' + url + '")');
  }
  $$('form[data-cs-form]').forEach(function (form) {
    var now = $('[data-step-now]', form);
    var stepEls = $$('[data-cs-step]', form);
    var details = $('[data-details]', form);
    var sumBox = $('[data-request-summary]', form);
    var sumText = $('[data-request-summary-text]', form);
    var one = function (name) { var el = form.querySelector('[name="' + name + '"]:checked'); return el ? el.value : ''; };
    var many = function (name) { return $$('[name="' + name + '"]:checked', form).map(function (el) { return el.value; }); };
    var service = function () { var el = form.querySelector('[name="service"]'); if (!el) return ''; return el.tagName === 'SELECT' ? el.value : one('service'); };
    function compose() {
      if (!details) return;
      var notesEl = form.querySelector('[name="notes"]');
      var notes = notesEl ? notesEl.value.trim() : '';
      var parts = [];
      var rooms = many('rooms');
      if (rooms.length) parts.push('Rooms: ' + rooms.join(', '));
      if (one('current')) parts.push('Floor now: ' + one('current'));
      if (one('timeline')) parts.push('Start: ' + one('timeline'));
      if (one('reach')) parts.push('Reach by: ' + one('reach'));
      if (notes) parts.push('Notes: ' + notes);
      details.value = parts.join(' | ').slice(0, 1000);
      if (sumBox && sumText) {
        var zip = (form.querySelector('[name="zip"]') || {}).value || '';
        var bits = [MAT_NAMES[service()] || '', zip ? 'ZIP ' + zip : '', rooms.join(', '), one('timeline')].filter(Boolean);
        sumText.textContent = bits.join(' · ');
        sumBox.hidden = bits.length === 0;
      }
    }
    form.addEventListener('change', function (e) {
      if (e.target && e.target.name === 'service') {
        setFormMaterial(form, service());
        if (form === heroForm && floor && service()) { floor.lay(service(), { dur: 0.5 }); floorCaption(service()); }
        if (form === heroForm) syncFinal();
      }
      if (e.target && e.target.name === 'zip' && form === heroForm) syncFinal();
      compose();
    });
    form.addEventListener('input', compose);
    form.addEventListener('submit', compose, true);
    var sync = function () {
      var visible = stepEls.filter(function (s) { return !s.hidden; })[0];
      if (!visible) return;
      var k = visible.getAttribute('data-cs-step');
      if (now && /^\d$/.test(k)) now.textContent = k;
      form.classList.toggle('is-done', k === 'done');
      compose();
    };
    if (typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(sync);
      stepEls.forEach(function (s) { mo.observe(s, { attributes: true, attributeFilter: ['hidden'] }); });
    }
    compose();
  });

  /* the final sentence starts from what the visitor already chose up top (until they touch it) */
  var finalForm = $('#quote-final');
  var finalTouched = false;
  if (finalForm) {
    finalForm.addEventListener('input', function () { finalTouched = true; });
    finalForm.addEventListener('change', function () { finalTouched = true; });
  }
  function syncFinal() {
    if (!finalForm || !heroForm || finalTouched) return;
    var s = heroForm.querySelector('[name="service"]:checked');
    var z = heroForm.querySelector('[name="zip"]');
    var fs = finalForm.querySelector('[name="service"]'), fz = finalForm.querySelector('[name="zip"]');
    if (s && fs) { fs.value = s.value; setFormMaterial(finalForm, s.value); }
    if (z && fz && /^\d{5}$/.test(z.value)) fz.value = z.value;
  }

  /* any sample / CTA → the hero form; a floor picked elsewhere is laid in the hero once we're back there */
  function goEstimate(svc) {
    if (!heroForm) return;
    var onStep1 = !$('[data-cs-step="1"]', heroForm).hidden;
    var target = isDesktop() ? 0 : Math.max(0, ($('[data-floor]') || heroForm).getBoundingClientRect().top + window.scrollY - 140);
    scrollToY(target);
    var zip = $('input[name="zip"]', heroForm);
    var wait = reduce ? 0 : Math.min(1400, 300 + window.scrollY / 4);
    setTimeout(function () {
      if (svc && onStep1) {
        var radio = heroForm.querySelector('input[name="service"][value="' + svc + '"]');
        if (radio && !radio.checked) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
      }
      if (onStep1 && zip) zip.focus({ preventScroll: true });
    }, wait);
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
      b.addEventListener('click', function () { opener = b; show(i); dlg.showModal(); if (lenis) lenis.stop(); });
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

  /* ── mobile bar: after the hero form, hidden while the final form is on screen ── */
  var mbar = $('[data-mbar]');
  var heroFormBox = $('[data-hero-form]');
  var finalBox = $('[data-final-form]');
  if (mbar && heroFormBox && 'IntersectionObserver' in window) {
    var pastHero = false, finalOn = false;
    var paint = function () { mbar.classList.toggle('is-on', pastHero && !finalOn); };
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { pastHero = !e.isIntersecting && e.boundingClientRect.top < 0; });
      paint();
    }).observe(heroFormBox);
    if (finalBox) new IntersectionObserver(function (es) {
      es.forEach(function (e) { finalOn = e.isIntersecting; });
      paint();
    }, { threshold: 0.15 }).observe(finalBox);
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
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) close(); });
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
        if (t) { e.preventDefault(); scrollToEl(t, id === '#top' ? 0 : -90); }
      });
    });
  }

  if (hasST) window.addEventListener('load', function () { window.ScrollTrigger.refresh(); });
})();
