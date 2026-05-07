/* Tree House Yoga Retreat — shared site behaviour
   - Nav scroll state (transparent over hero -> bone-blur on scroll)
   - Mobile menu open/close
   - Language toggle (EN / DE) with localStorage persistence
   - Footer year
*/

(function () {
  'use strict';

  // ---- i18n ----
  var DICT = window.THYR_DICT || { en: {}, de: {} };

  function getLang() {
    try {
      var saved = localStorage.getItem('thyr.lang');
      if (saved === 'en' || saved === 'de') return saved;
    } catch (e) {}
    var html = document.documentElement.lang;
    if (html === 'en') return 'en';
    return 'de';
  }

  function setLang(lang) {
    try { localStorage.setItem('thyr.lang', lang); } catch (e) {}
    document.documentElement.lang = lang;
    applyTranslations(lang);
    updateLangButtons(lang);
  }

  function t(key, lang) {
    var d = DICT[lang] || DICT.en || {};
    if (d[key] != null) return d[key];
    if (DICT.en && DICT.en[key] != null) return DICT.en[key];
    return key;
  }

  function applyTranslations(lang) {
    // text content
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-i18n');
      if (!key) continue;
      el.textContent = t(key, lang);
    }
    // placeholders
    var phs = document.querySelectorAll('[data-i18n-placeholder]');
    for (var j = 0; j < phs.length; j++) {
      var p = phs[j];
      var k = p.getAttribute('data-i18n-placeholder');
      if (k) p.setAttribute('placeholder', t(k, lang));
    }
    // aria-labels
    var ar = document.querySelectorAll('[data-i18n-aria]');
    for (var a = 0; a < ar.length; a++) {
      var n = ar[a];
      var ak = n.getAttribute('data-i18n-aria');
      if (ak) n.setAttribute('aria-label', t(ak, lang));
    }
    // Inline bilingual text emitted by Astro pages driven by data files.
    // Elements carry both translations as data-i18n-de / data-i18n-en, and we
    // swap to whichever matches the active language. No dictionary needed.
    var inline = document.querySelectorAll('[data-i18n-de]');
    for (var b = 0; b < inline.length; b++) {
      var ie = inline[b];
      var text = ie.getAttribute('data-i18n-' + lang);
      if (text != null) ie.textContent = text;
    }
  }

  function updateLangButtons(lang) {
    var buttons = document.querySelectorAll('[data-lang]');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (b.getAttribute('data-lang') === lang) {
        b.classList.add('active');
        b.setAttribute('aria-pressed', 'true');
      } else {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      }
    }
  }

  // ---- Booking modal ----
  function initBookingModal() {
    if (document.getElementById('book-modal')) return;

    var modal = document.createElement('div');
    modal.id = 'book-modal';
    modal.className = 'book-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = ''
      + '<div class="book-dialog" role="document">'
      + '  <button type="button" class="book-close" aria-label="Close">'
      + '    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>'
      + '  </button>'
      + '  <div class="book-body">'
      + '    <span class="eyebrow" data-i18n="book.eyebrow">jetzt buchen</span>'
      + '    <h2 data-i18n="book.title">Retreat reservieren</h2>'
      + '    <p data-i18n="book.intro">Schreibt uns ein paar Zeilen. Wir antworten in der Regel am selben Werktag.</p>'
      + '    <form class="book-form" novalidate>'
      + '      <div class="form-row">'
      + '        <label class="form-field"><span data-i18n="book.f.name">Vorname</span><input type="text" name="name" required autocomplete="given-name" /></label>'
      + '        <label class="form-field"><span data-i18n="book.f.surname">Nachname</span><input type="text" name="surname" required autocomplete="family-name" /></label>'
      + '      </div>'
      + '      <label class="form-field"><span data-i18n="book.f.email">E-Mail</span><input type="email" name="email" required autocomplete="email" /></label>'
      + '      <label class="form-field"><span data-i18n="book.f.phone">Mobilnummer</span><input type="tel" name="phone" required autocomplete="tel" inputmode="tel" /></label>'
      + '      <label class="form-field"><span data-i18n="book.f.retreat">Retreat ausw\u00e4hlen</span>'
      + '        <select name="retreat" required>'
      + '          <option value="" data-i18n="book.opt.choose">Bitte w\u00e4hlen…</option>'
      + '        </select>'
      + '      </label>'
      + '      <label class="form-field"><span data-i18n="book.f.guests">Anzahl G\u00e4ste</span>'
      + '        <select name="guests" required>'
      + '          <option value="1">1</option>'
      + '          <option value="2">2</option>'
      + '        </select>'
      + '      </label>'
      + '      <label class="form-field"><span data-i18n="book.f.room">Zimmer</span>'
      + '        <select name="room" required>'
      + '          <option value="" data-i18n="book.opt.choose_room">Zuerst Retreat wählen…</option>'
      + '        </select>'
      + '        <small class="form-hint room-hint" hidden></small>'
      + '      </label>'
      + '      <p class="form-group-cta"><span data-i18n="book.group.intro">Gruppe oder 3+ Zimmer? </span><a href="/contact.html" data-i18n="book.group.link">Schreib uns direkt →</a></p>'
      + '      <label class="form-check">'
      + '        <input type="checkbox" name="human" required />'
      + '        <span data-i18n="book.human">Ich best\u00e4tige, dass ich ein Mensch bin.</span>'
      + '      </label>'
      + '      <div aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden">'
      + '        <label>Website<input type="text" name="website" tabindex="-1" autocomplete="off" /></label>'
      + '      </div>'
      + '      <div class="form-error" role="alert" aria-live="polite"></div>'
      + '      <button type="submit" class="btn btn-primary book-send" data-i18n="book.send" disabled>Senden</button>'
      + '      <p class="form-footnote" data-i18n="book.footnote">Kein Versand heute — wir melden uns innerhalb eines Werktags.</p>'
      + '    </form>'
      + '    <div class="book-success" hidden>'
      + '      <h2 data-i18n="book.success.title">Vielen Dank.</h2>'
      + '      <p data-i18n="book.success.body">Deine Anfrage ist bei uns. Wir antworten in der Regel innerhalb eines Werktags.</p>'
      + '      <p class="pay-note" data-i18n="book.success.payNote">Damit der Platz fest reserviert ist, kannst du jetzt die Anzahlung leisten — Kreditkarte oder PayPal, sicher über Stripe.</p>'
      + '      <p class="pay-error" hidden></p>'
      + '      <div class="pay-actions">'
      + '        <button type="button" class="btn btn-primary book-pay" data-i18n="book.success.pay">Anzahlung leisten</button>'
      + '        <button type="button" class="btn btn-secondary book-close-alt" data-i18n="book.success.close">Schlie\u00dfen</button>'
      + '      </div>'
      + '    </div>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(modal);

    var form = modal.querySelector('form.book-form');
    var err = modal.querySelector('.form-error');
    var successPane = modal.querySelector('.book-success');
    var formPane = modal.querySelector('.book-body form');
    var retreatSel = form.querySelector('select[name=retreat]');
    var guestsSel = form.querySelector('select[name=guests]');
    var roomSel = form.querySelector('select[name=room]');
    var roomHint = form.querySelector('.room-hint');

    // Cache of booked room slugs per retreat. Populated on first open of that
    // retreat, refreshed on every subsequent retreat change. Keeps the UI snappy
    // and avoids hammering /api/availability.
    var availabilityCache = {};

    // ---- Populate retreats once at modal init ----
    (function populateRetreats(){
      var retreats = (window.THYR_RETREATS || []).slice();
      // Drop everything past the placeholder option
      while (retreatSel.options.length > 1) retreatSel.remove(1);
      retreats.forEach(function(r){
        var opt = document.createElement('option');
        opt.value = r.slug;
        // Per-language strings — the i18n machinery picks the active one
        var labelDe = (r.title.de || '') + ' — ' + (r.dates.de || '');
        var labelEn = (r.title.en || '') + ' — ' + (r.dates.en || '');
        opt.setAttribute('data-i18n-de', labelDe);
        opt.setAttribute('data-i18n-en', labelEn);
        opt.textContent = labelDe;
        retreatSel.appendChild(opt);
      });
      // Re-apply translations so the options pick up the active language
      try {
        var lang = (document.documentElement.getAttribute('lang') || 'de').toLowerCase().slice(0, 2);
        var inline = retreatSel.querySelectorAll('option[data-i18n-de]');
        for (var i = 0; i < inline.length; i++) {
          var t = inline[i].getAttribute('data-i18n-' + lang);
          if (t != null) inline[i].textContent = t;
        }
      } catch (e) {}
    })();

    function setRoomPlaceholder(key) {
      // Replace the room dropdown with just a placeholder using the given i18n key.
      while (roomSel.options.length > 0) roomSel.remove(0);
      var ph = document.createElement('option');
      ph.value = '';
      ph.setAttribute('data-i18n', key);
      // Best-effort default text — applyTranslations() will overwrite it.
      var fallback = {
        'book.opt.choose_room': 'Zuerst Retreat wählen…',
        'book.opt.no_rooms': 'Keine Zimmer verfügbar',
        'book.opt.loading_rooms': 'Verfügbarkeit wird geprüft…',
        'book.opt.pick_room': 'Bitte Zimmer wählen…'
      };
      ph.textContent = fallback[key] || '';
      roomSel.appendChild(ph);
      // Trigger global re-translation so the placeholder updates
      try { window.THYR_APPLY_LANG && window.THYR_APPLY_LANG(); } catch (e) {}
    }

    function fillRoomOptions(retreatSlug, guests, bookedSlugs) {
      var rooms = (window.THYR_ROOMS || []).slice();
      while (roomSel.options.length > 0) roomSel.remove(0);

      // Placeholder first
      var ph = document.createElement('option');
      ph.value = '';
      ph.setAttribute('data-i18n', 'book.opt.pick_room');
      ph.textContent = 'Bitte Zimmer wählen…';
      roomSel.appendChild(ph);

      // Strip the "Zimmer „..."" / "Room "...""  wrappers so the dropdown
      // shows just the proper name (Iris, Philipp, etc.). The wrapper words
      // are redundant given the field label is already "Zimmer".
      function shortName(label) {
        if (!label) return '';
        // Remove leading "Zimmer " or "Room " (case-insensitive)
        var stripped = label.replace(/^(zimmer|room)\s+/i, '');
        // Remove surrounding German low-9/high-9 quotes („Iris") or ASCII " "
        stripped = stripped.replace(/^[„"']/, '').replace(/[“”"']$/, '');
        return stripped.trim();
      }

      var added = 0;
      rooms.forEach(function(r){
        if (bookedSlugs.indexOf(r.slug) !== -1) return; // already booked
        if (guests >= 2 && r.capacity === 'single only') return; // doesn't fit
        var opt = document.createElement('option');
        opt.value = r.slug;
        var labelDe = shortName(r.name && r.name.de) || r.slug;
        var labelEn = shortName(r.name && r.name.en) || r.slug;
        opt.setAttribute('data-i18n-de', labelDe);
        opt.setAttribute('data-i18n-en', labelEn);
        opt.textContent = labelDe;
        roomSel.appendChild(opt);
        added++;
      });

      if (added === 0) {
        // Replace placeholder with "no rooms available"
        ph.setAttribute('data-i18n', 'book.opt.no_rooms');
        ph.textContent = 'Keine Zimmer verfügbar';
        if (roomHint) {
          roomHint.hidden = false;
          roomHint.setAttribute('data-i18n', 'book.f.room.none_hint');
          roomHint.textContent = 'Alle Zimmer sind belegt — schreib uns gerne direkt.';
        }
      } else if (roomHint) {
        roomHint.hidden = true;
      }

      try { window.THYR_APPLY_LANG && window.THYR_APPLY_LANG(); } catch (e) {}
    }

    async function refreshRoomDropdown() {
      var retreatSlug = retreatSel.value;
      var guests = parseInt(guestsSel.value, 10) || 1;

      if (!retreatSlug) {
        setRoomPlaceholder('book.opt.choose_room');
        return;
      }

      // Loading state while we fetch availability
      setRoomPlaceholder('book.opt.loading_rooms');

      var cached = availabilityCache[retreatSlug];
      if (!cached) {
        try {
          var res = await fetch('/api/availability?retreat=' + encodeURIComponent(retreatSlug));
          var body = await res.json();
          cached = (body && body.ok) ? (body.booked || []) : [];
          availabilityCache[retreatSlug] = cached;
        } catch (e) {
          cached = [];
        }
      }

      fillRoomOptions(retreatSlug, guests, cached);
    }

    // Expose a globally-callable language re-applier so the helpers above can
    // ask the existing applyTranslations() function to rerun. Set during init.
    if (typeof applyTranslations === 'function') {
      window.THYR_APPLY_LANG = function(){
        try { applyTranslations(getLang()); } catch (e) {}
      };
    }

    retreatSel.addEventListener('change', function(){
      // Clear cache for this retreat so we get fresh data on first switch back
      // (room may have been booked while modal was open). Keep prev cached for
      // others to avoid re-fetching when the user toggles between two retreats.
      availabilityCache[retreatSel.value] = undefined;
      refreshRoomDropdown();
    });
    guestsSel.addEventListener('change', refreshRoomDropdown);

    // Disable the submit button until the human-confirmation checkbox is ticked.
    // Visual signal that the box is required, even though the form also
    // validates it on submit.
    var humanCheckbox = form.querySelector('input[name=human]');
    var sendBtn = form.querySelector('.book-send');
    if (humanCheckbox && sendBtn) {
      humanCheckbox.addEventListener('change', function(){
        sendBtn.disabled = !humanCheckbox.checked;
      });
    }

    function openModal(retreatKey) {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      form.hidden = false;
      successPane.hidden = true;
      if (retreatKey) {
        // Only set if the option exists — otherwise fall back to the default.
        var match = false;
        for (var i = 0; i < retreatSel.options.length; i++) {
          if (retreatSel.options[i].value === retreatKey) { match = true; break; }
        }
        if (match) retreatSel.value = retreatKey;
      }
      // Populate / refresh the room dropdown based on whatever retreat is selected
      refreshRoomDropdown();
      setTimeout(function(){
        var first = form.querySelector('input[name=name]');
        if (first) first.focus();
      }, 60);
    }
    function closeModal() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    modal.querySelector('.book-close').addEventListener('click', closeModal);
    modal.querySelector('.book-close-alt').addEventListener('click', closeModal);
    modal.addEventListener('click', function(e){ if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });

    // Trigger from any [data-reserve] element (anchor or button)
    var reserves = document.querySelectorAll('[data-reserve]');
    for (var i = 0; i < reserves.length; i++) {
      (function(el){
        // Neutralise mailto hrefs that may still be on legacy anchors
        if (el.tagName === 'A') el.setAttribute('href', '#book');
        el.addEventListener('click', function(ev){
          ev.preventDefault();
          openModal(el.getAttribute('data-reserve'));
        });
      })(reserves[i]);
    }

    // Form submit — POSTs to /api/booking (the Cloudflare Worker).
    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      err.textContent = '';
      var lang = getLang();

      var firstname = form.name.value.trim();
      var surname = form.surname.value.trim();
      var email = form.email.value.trim();
      var phone = form.phone.value.trim();
      var retreat = form.retreat.value;
      var guestsRaw = (form.guests && form.guests.value) || '1';
      var guests = parseInt(guestsRaw, 10) || 1;
      var room = (form.room && form.room.value) || '';
      var human = form.human.checked;
      var honeypot = (form.website && form.website.value) || '';

      var msgs = {
        de: {
          missing: 'Bitte f\u00fclle alle Felder aus.',
          email:   'Bitte eine g\u00fcltige E-Mail-Adresse angeben.',
          phone:   'Bitte eine g\u00fcltige Mobilnummer angeben.',
          room:    'Bitte ein Zimmer ausw\u00e4hlen.',
          human:   'Bitte best\u00e4tige, dass du ein Mensch bist.',
          server:  'Es gab ein Problem beim Senden. Bitte versuche es in einem Moment noch einmal.',
          network: 'Verbindung fehlgeschlagen. Bitte pr\u00fcfe deine Internetverbindung.',
          sending: 'Senden\u2026'
        },
        en: {
          missing: 'Please fill in every field.',
          email:   'Please enter a valid email address.',
          phone:   'Please enter a valid mobile number.',
          room:    'Please choose a room.',
          human:   'Please confirm you are a human.',
          server:  'There was a problem sending. Please try again in a moment.',
          network: 'Connection failed. Please check your internet connection.',
          sending: 'Sending\u2026'
        }
      };
      var M = msgs[lang] || msgs.en;

      if (!firstname || !surname || !email || !phone || !retreat) { err.textContent = M.missing; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = M.email; return; }
      if (!/^[+\d][\d\s\-()]{6,}$/.test(phone)) { err.textContent = M.phone; return; }
      if (!room) { err.textContent = M.room; return; }
      if (!human) { err.textContent = M.human; return; }

      // Pull the retreat title + dates out of the currently-rendered option text.
      // The dictionary format is "Title — Dates" (em dash).
      var retreatSel = form.querySelector('select[name=retreat]');
      var optionText = retreatSel && retreatSel.options[retreatSel.selectedIndex]
        ? retreatSel.options[retreatSel.selectedIndex].textContent
        : '';
      var parts = optionText.split(/\s+[\u2014\u2013-]\s+/); // split on dash with spaces
      var retreatTitle = (parts[0] || '').trim();
      var retreatDates = (parts.slice(1).join(' \u2014 ') || '').trim();

      var payload = {
        name: (firstname + ' ' + surname).trim(),
        email: email,
        retreatCode: retreat,
        retreatTitle: retreatTitle,
        dates: retreatDates,
        guests: guests,
        room: room,
        // Phone isn't a dedicated Airtable field yet, so surface it in the message.
        message: (lang === 'de' ? 'Telefon: ' : 'Phone: ') + phone,
        lang: lang,
        website: honeypot // honeypot — Worker rejects non-empty values
      };

      // UI: disable + loading label
      var btn = form.querySelector('.book-send');
      var originalLabel = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = M.sending; }

      // 15s timeout via AbortController so a hung network doesn't leave the UI stuck
      var controller = null;
      var timeoutId = null;
      try { controller = new AbortController(); } catch (e) {}
      if (controller) {
        timeoutId = setTimeout(function(){ try { controller.abort(); } catch (e) {} }, 15000);
      }

      fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      })
      .then(function(res){
        if (timeoutId) clearTimeout(timeoutId);
        return res.json().then(function(body){ return { ok: res.ok, status: res.status, body: body }; });
      })
      .then(function(r){
        if (r.ok && r.body && r.body.ok) {
          // Success — stash payment context on the success pane for the "Pay deposit" button.
          successPane.dataset.bookingId = (r.body.bookingId || '');
          successPane.dataset.retreatTitle = retreatTitle;
          successPane.dataset.email = email;
          form.hidden = true;
          successPane.hidden = false;
        } else {
          if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
          err.textContent = M.server;
          try { console.warn('[booking] server rejected:', r); } catch (e) {}
        }
      })
      .catch(function(e){
        if (timeoutId) clearTimeout(timeoutId);
        if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
        err.textContent = M.network;
        try { console.warn('[booking] network error:', e); } catch (_) {}
      });
    });

    // ---- Pay deposit button on the success pane ----
    var payBtn = modal.querySelector('.book-pay');
    var payErr = modal.querySelector('.pay-error');
    if (payBtn) {
      payBtn.addEventListener('click', function(){
        var lang = getLang();
        var payMsgs = {
          de: { sending: 'Weiterleitung\u2026', err: 'Zahlung konnte nicht gestartet werden. Bitte versuche es noch einmal.' },
          en: { sending: 'Redirecting\u2026',     err: 'Could not start checkout. Please try again.' }
        };
        var P = payMsgs[lang] || payMsgs.en;
        if (payErr) { payErr.hidden = true; payErr.textContent = ''; }

        var bookingId = successPane.dataset.bookingId || '';
        var retreatTitle = successPane.dataset.retreatTitle || '';
        var email = successPane.dataset.email || '';
        if (!bookingId || !email) {
          if (payErr) { payErr.hidden = false; payErr.textContent = P.err; }
          return;
        }

        var origLabel = payBtn.textContent;
        payBtn.disabled = true; payBtn.textContent = P.sending;

        fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: bookingId, retreatTitle: retreatTitle, email: email, lang: lang })
        })
        .then(function(res){ return res.json().then(function(b){ return { ok: res.ok, body: b }; }); })
        .then(function(r){
          if (r.ok && r.body && r.body.ok && r.body.url) {
            window.location.href = r.body.url;
          } else {
            payBtn.disabled = false; payBtn.textContent = origLabel;
            if (payErr) { payErr.hidden = false; payErr.textContent = P.err; }
            try { console.warn('[checkout] failed:', r); } catch (e) {}
          }
        })
        .catch(function(e){
          payBtn.disabled = false; payBtn.textContent = origLabel;
          if (payErr) { payErr.hidden = false; payErr.textContent = P.err; }
          try { console.warn('[checkout] network error:', e); } catch (_) {}
        });
      });
    }
  }

  // ---- Nav scroll state ----
  function initNavScroll() {
    var nav = document.querySelector('.nav');
    if (!nav) return;
    var isTransparent = nav.getAttribute('data-transparent') === 'true';
    if (!isTransparent) {
      nav.classList.remove('nav--top');
      nav.classList.add('nav--scrolled');
      return;
    }
    function onScroll() {
      if (window.scrollY > 40) {
        nav.classList.remove('nav--top');
        nav.classList.add('nav--scrolled');
      } else {
        nav.classList.add('nav--top');
        nav.classList.remove('nav--scrolled');
      }
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ---- Mobile menu ----
  function initMobileMenu() {
    var openBtn = document.querySelector('[data-menu-open]');
    var closeBtn = document.querySelector('[data-menu-close]');
    var menu = document.querySelector('.mobile-menu');
    if (!menu) return;
    function open() { menu.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function close() { menu.classList.remove('open'); document.body.style.overflow = ''; }
    if (openBtn) openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    // Close when a link in the mobile menu is clicked
    var links = menu.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', close);
    }
  }

  // ---- Language toggle clicks ----
  function initLangToggle() {
    var buttons = document.querySelectorAll('[data-lang]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (ev) {
        var l = ev.currentTarget.getAttribute('data-lang');
        if (l) setLang(l);
      });
    }
  }

  // ---- Contact form -> POST /api/contact ----
  function initContactForm() {
    var form = document.querySelector('form[data-contact]');
    if (!form) return;

    var errEl = form.querySelector('.form-error');
    var successEl = form.querySelector('.form-success');
    var btn = form.querySelector('button[type=submit]');
    var humanCheckbox = form.querySelector('input[name=human]');

    // Disable submit until the human-confirmation checkbox is ticked.
    if (humanCheckbox && btn) {
      humanCheckbox.addEventListener('change', function(){
        btn.disabled = !humanCheckbox.checked;
      });
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (errEl) errEl.textContent = '';

      var name = (form.querySelector('[name=name]') || {}).value || '';
      var email = (form.querySelector('[name=email]') || {}).value || '';
      var which = (form.querySelector('[name=which]') || {}).value || '';
      var note = (form.querySelector('[name=note]') || {}).value || '';
      var honeypot = (form.querySelector('[name=website]') || {}).value || '';
      var human = humanCheckbox ? humanCheckbox.checked : true;
      var lang = getLang();

      name = name.trim();
      email = email.trim();
      which = which.trim();
      note = note.trim();

      var msgs = {
        de: {
          missing: 'Bitte f\u00fclle Name und E-Mail aus.',
          email:   'Bitte eine g\u00fcltige E-Mail-Adresse angeben.',
          human:   'Bitte best\u00e4tige, dass du ein Mensch bist.',
          server:  'Es gab ein Problem beim Senden. Bitte versuche es in einem Moment noch einmal.',
          network: 'Verbindung fehlgeschlagen. Bitte pr\u00fcfe deine Internetverbindung.',
          sending: 'Senden\u2026'
        },
        en: {
          missing: 'Please fill in name and email.',
          email:   'Please enter a valid email address.',
          human:   'Please confirm you are a human.',
          server:  'There was a problem sending. Please try again in a moment.',
          network: 'Connection failed. Please check your internet connection.',
          sending: 'Sending\u2026'
        }
      };
      var M = msgs[lang] || msgs.en;

      if (!name || !email) { if (errEl) errEl.textContent = M.missing; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { if (errEl) errEl.textContent = M.email; return; }
      if (!human) { if (errEl) errEl.textContent = M.human; return; }

      var payload = {
        name: name,
        email: email,
        retreatInterest: which,
        message: note,
        lang: lang,
        website: honeypot
      };

      var originalLabel = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = M.sending; }

      var controller = null;
      var timeoutId = null;
      try { controller = new AbortController(); } catch (e) {}
      if (controller) {
        timeoutId = setTimeout(function(){ try { controller.abort(); } catch (e) {} }, 15000);
      }

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      })
      .then(function(res){
        if (timeoutId) clearTimeout(timeoutId);
        return res.json().then(function(body){ return { ok: res.ok, body: body }; });
      })
      .then(function(r){
        if (r.ok && r.body && r.body.ok) {
          // Hide everything in the form except the success pane
          var kids = form.children;
          for (var i = 0; i < kids.length; i++) {
            if (!kids[i].classList.contains('form-success')) kids[i].hidden = true;
          }
          if (successEl) successEl.hidden = false;
        } else {
          if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
          if (errEl) errEl.textContent = M.server;
          try { console.warn('[contact] server rejected:', r); } catch (e) {}
        }
      })
      .catch(function(e){
        if (timeoutId) clearTimeout(timeoutId);
        if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
        if (errEl) errEl.textContent = M.network;
        try { console.warn('[contact] network error:', e); } catch (_) {}
      });
    });
  }

  // ---- WhatsApp FAB ----
  function initWhatsApp() {
    var fab = document.querySelector('.fab[data-whatsapp]');
    if (!fab) return;
    // International number; replace with the real number when you have it
    fab.setAttribute('href', 'https://wa.me/491234567890');
    fab.setAttribute('target', '_blank');
    fab.setAttribute('rel', 'noopener');
  }

  // ---- Year in footer ----
  function initYear() {
    var el = document.querySelector('[data-year]');
    if (el) el.textContent = new Date().getFullYear();
  }

  // ---- Retreats page filters ----
  // Three filter groups, all client-side, all combined with AND:
  //   month       — radio-style; one value or '' for all
  //   tag         — radio-style; one value or '' for all
  //   hideSoldOut — toggle; when true, filters out cards with data-soldout="true"
  // Filter chips have data-filter-group="<group>" data-filter-value="<value>"
  // for the radio groups, or data-filter-toggle="hide-soldout" for the toggle.
  function initRetreatFilters() {
    var bar = document.querySelector('[data-retreats-filters]');
    var grid = document.querySelector('[data-retreats-grid]');
    if (!bar || !grid) return;

    var empty = document.querySelector('[data-retreats-empty]');
    var clearBtn = empty ? empty.querySelector('[data-retreats-clear]') : null;

    var state = { month: '', tag: '', hideSoldOut: false };

    function setRadio(group, value) {
      state[group] = value;
      var chips = bar.querySelectorAll('[data-filter-group="' + group + '"]');
      for (var i = 0; i < chips.length; i++) {
        var chip = chips[i];
        var on = chip.getAttribute('data-filter-value') === value;
        chip.classList.toggle('is-active', on);
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }

    function apply() {
      var cards = grid.querySelectorAll('.retreat-card');
      var visible = 0;
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var monthOk = !state.month || card.getAttribute('data-month') === state.month;
        var cardTags = (card.getAttribute('data-tags') || '').split(/\s+/);
        var tagOk = !state.tag || cardTags.indexOf(state.tag) !== -1;
        var soldOk = !state.hideSoldOut || card.getAttribute('data-soldout') !== 'true';
        var show = monthOk && tagOk && soldOk;
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      }
      if (empty) empty.hidden = visible !== 0;
      grid.style.display = visible === 0 ? 'none' : '';
    }

    function clearAll() {
      setRadio('month', '');
      setRadio('tag', '');
      setToggleByName('hideSoldOut', false);
      apply();
    }

    function setToggleByName(name, on) {
      state[name] = !!on;
      var attr = name === 'hideSoldOut' ? 'hide-soldout' : name;
      var btn = bar.querySelector('[data-filter-toggle="' + attr + '"]');
      if (btn) {
        btn.classList.toggle('is-active', !!on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }

    bar.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.chip') : null;
      if (!btn) return;
      var group = btn.getAttribute('data-filter-group');
      var toggle = btn.getAttribute('data-filter-toggle');
      if (group) {
        setRadio(group, btn.getAttribute('data-filter-value') || '');
      } else if (toggle === 'hide-soldout') {
        setToggleByName('hideSoldOut', !state.hideSoldOut);
      }
      apply();
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', clearAll);
    }
  }

  // ---- Boot ----
  document.addEventListener('DOMContentLoaded', function () {
    initNavScroll();
    initMobileMenu();
    initLangToggle();
    initContactForm();
    initBookingModal();
    initWhatsApp();
    initYear();
    initRetreatFilters();
    var lang = getLang();
    applyTranslations(lang);
    updateLangButtons(lang);
    document.documentElement.lang = lang;
  });
})();
