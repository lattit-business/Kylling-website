/* =============================================================================
   BARE KYLLING — INTERAKSJON
   Ingen rammeverk, ingen avhengigheter. All innholdsdata kommer fra content.js.
   ============================================================================= */
(function () {
  'use strict';

  var BK   = window.BK || {};
  var CFG  = BK.config || {};
  var DEV  = CFG.devModus === true;
  var $    = function (s, c) { return (c || document).querySelector(s); };
  var $$   = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var lite = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------------
     1. BILDER SOM MANGLER → NAVNGITT PLASSHOLDER
     Legger du inn filen på riktig sti, forsvinner plassholderen av seg selv.
     --------------------------------------------------------------------------- */
  function markMissing(img) {
    var fig = img.closest('.media');
    if (!fig) { return; }

    fig.classList.add('is-missing');
  }
  $$('.media__img').forEach(function (img) {
    img.addEventListener('error', function () { markMissing(img); });
    if (img.complete && img.naturalWidth === 0) { markMissing(img); }
  });

  /* ---------------------------------------------------------------------------
     2. NAVIGASJON
     --------------------------------------------------------------------------- */
  var nav = $('#nav');
  var burger = $('#burger');
  var menu = $('#meny');
  var menuOpen = false;

  function onScrollNav() {
    if (nav) { nav.classList.toggle('is-stuck', window.scrollY > 24); }
  }

  function setMenu(open) {
    if (!menu || !burger) { return; }
    menuOpen = open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Lukk meny' : 'Åpne meny');
    document.body.style.overflow = open ? 'hidden' : '';
    document.body.classList.toggle('meny-apen', open);

    if (open) {
      menu.hidden = false;
      requestAnimationFrame(function () { menu.classList.add('is-open'); });
      var first = $('a', menu);
      if (first) { first.focus(); }
    } else {
      menu.classList.remove('is-open');
      window.setTimeout(function () { if (!menuOpen) { menu.hidden = true; } }, lite ? 0 : 280);
    }
  }

  if (burger) { burger.addEventListener('click', function () { setMenu(!menuOpen); }); }
  if (menu) {
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) { setMenu(false); }
    });
  }
  document.addEventListener('keydown', function (e) {
    if (!menuOpen) { return; }
    if (e.key === 'Escape') { setMenu(false); burger.focus(); return; }
    if (e.key !== 'Tab') { return; }
    var f = $$('a, button', menu).filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) { return; }
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* Aktiv side i menyene. Sidene setter aria-current="page" selv i HTML-en;
     dette er bare et sikkerhetsnett hvis noen glemmer det.                  */
  var side = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (!$('.nav__links [aria-current]')) {
    $$('.nav__links a, .menu__inner > a:not(.menu__cta)').forEach(function (a) {
      var mal = (a.getAttribute('href') || '').split('#')[0].toLowerCase();
      if (mal === side) { a.setAttribute('aria-current', 'page'); }
    });
  }

  /* ---------------------------------------------------------------------------
     3. SCROLL-AVSLØRING + PARALLAX + STICKY CTA
     --------------------------------------------------------------------------- */
  if (!lite && 'IntersectionObserver' in window) {
    var targets = [];
    [
      '.hero__copy > *', '.hero__stage',
      '.subhero__copy > *', '.subhero__stage',
      '.problem__h2', '.problem__intro > *', '.versus__col', '.perk', '.problem__more',
      '.lei__h2', '.lei__lead', '.lei__item', '.lei__turn', '.lei .mascot',
      '.ben__inner > *',
      '.flavors__h2', '.flavor__inner > *', '.card',
      '.how__h2', '.step', '.how__end', '.how__link',
      '.uses__h2', '.tile',
      '.compare__h2', '.compare__scroll',
      '.trans__h2', '.ing', '.trans__stamp',
      '.story__grid > *', '.about__head > *', '.about__body > *', '.value', '.fun li', '.about__foot > *',
      '.launch__h2', '.launch__lead', '.form', '.launch .mascot', '.launch .btn--lg',
      '.faq__h2', '.faq__group', '.qa',
      '.oops__grid > *',
      '.foot__mark'
    ].forEach(function (sel) { targets = targets.concat($$(sel)); });

    var groups = new Map();
    targets.forEach(function (el) {
      el.setAttribute('data-reveal', '');
      var key = el.parentElement;
      var i = groups.get(key) || 0;
      groups.set(key, i + 1);
      el.style.setProperty('--d', Math.min(i, 5) * 70 + 'ms');
    });

    var reveal = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); obs.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(function (el) { reveal.observe(el); });
  }

  var stage = $('[data-parallax]');
  var sticky = $('.sticky-cta');
  var hero = $('.hero, .subhero, .launch--page, .oops');

  /* Knappen skal ikke ligge over skjemaet den peker til */
  var iLansering = false;
  var lansering = $('#lansering');
  if (lansering && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      iLansering = e[0].isIntersecting;
      if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    }, { threshold: 0 }).observe(lansering);
  }
  var canParallax = !lite && stage && window.matchMedia('(min-width: 900px) and (pointer: fine)').matches;
  var ticking = false;

  function frame() {
    ticking = false;
    var y = window.scrollY;
    if (canParallax) {
      var shift = Math.max(-40, Math.min(40, (y - (hero ? hero.offsetTop : 0)) * 0.055));
      stage.style.transform = 'translate3d(0,' + shift.toFixed(2) + 'px,0)';
    }
    if (sticky && hero) {
      var past = y > hero.offsetTop + hero.offsetHeight * 0.85;
      var atEnd = y + window.innerHeight > document.body.scrollHeight - 320;
      sticky.classList.toggle('is-on', past && !atEnd && !iLansering);
    }
    onScrollNav();
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }, { passive: true });
  frame();

  /* ---------------------------------------------------------------------------
     4. INNHOLD FRA content.js
     --------------------------------------------------------------------------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  function unverifiedBox(tittel, tekst) {
    var box = el('div', 'unverified');
    box.appendChild(el('span', 'unverified__tag', 'Må verifiseres før lansering'));
    if (tittel) { box.appendChild(el('p', null, tittel)); }
    if (tekst) { box.appendChild(el('p', 'unverified__note', tekst)); }
    return box;
  }

  /* 4a. Smaksnoter som chips */
  $$('[data-chips]').forEach(function (ul) {
    var smak = (BK.smaker || {})[ul.getAttribute('data-chips')];
    if (!smak) { return; }
    (smak.smaksnoter || []).forEach(function (note) { ul.appendChild(el('li', null, note)); });
  });

  /* 4b. Ingredienslister */
  var listeMal = $('[data-ingredienser]');
  if (listeMal) {
    Object.keys(BK.smaker || {}).forEach(function (key) {
      var s = BK.smaker[key];
      var ing = s.ingredienser || {};
      var art = el('article', 'ing');
      art.appendChild(el('h3', 'ing__navn', s.navn));

      if (ing.bekreftet) {
        art.appendChild(el('p', 'ing__tekst', ing.tekst));
      } else {
        art.appendChild(el('p', 'ing__tekst', ing.base + ', krydderblanding. Full deklarasjon publiseres når resepten er låst.'));
        if (DEV) { art.appendChild(unverifiedBox('Foreslått deklarasjon: ' + ing.tekst, ing.notat)); }
      }
      listeMal.appendChild(art);
    });
  }

  /* 4c. Innholdsstempel */
  var claim = $('[data-claim="rentKjott"]');
  if (claim && BK.rentKjott) {
    var rk = BK.rentKjott;
    var note = $('.trans__stamp-note');
    claim.textContent = rk.bekreftet ? rk.tekst : rk.reserve;
    if (note) { note.textContent = rk.bekreftet ? rk.note : rk.reserveNote; }
    if (!rk.bekreftet && DEV) {
      claim.parentNode.appendChild(unverifiedBox('Ønsket tekst: ' + rk.tekst, 'Krever dokumentert kjøttinnhold før den kan brukes offentlig.'));
    }
  }

  /* 4d. Næringstall og merker — vises kun når de er bekreftet */
  var facts = $('[data-naering]');
  if (facts) {
    var n = BK.naering || {};
    var ubekreftedeMerker = (BK.merker || []).filter(function (m) { return !m.bekreftet; });

    if (n.bekreftet) {
      var rad = el('div', 'trans__facts-row');
      (n.verdier || []).forEach(function (v) {
        var b = el('div', 'fact');
        b.appendChild(el('span', 'fact__v', v.verdi));
        b.appendChild(el('span', 'fact__k', v.navn + ' ' + v.per));
        rad.appendChild(b);
      });
      facts.appendChild(rad);
    } else if (DEV) {
      var tall = (n.verdier || []).map(function (v) { return v.navn + ': ' + v.verdi + ' ' + v.per; }).join(' · ');
      var merker = ubekreftedeMerker.map(function (m) { return m.navn; }).join(' · ');
      facts.appendChild(unverifiedBox(
        'Skjult på siden: ' + tall + (merker ? ' · ' + merker : ''),
        'Kilde: ' + (n.kilde || 'ukjent') + ' Sett bekreftet: true i js/content.js når dokumentasjonen foreligger.'
      ));
    }
  }

  /* 4d2. Footer-lenker: ekte URL om den finnes, ellers «kommer» — aldri en falsk lenke */
  var lenker = CFG.lenker || {};
  $$('[data-link]').forEach(function (node) {
    var url = lenker[node.getAttribute('data-link')];
    if (!url) { node.className = 'foot__pending'; return; }
    var a = el('a', null, node.textContent);
    a.href = url;
    if (/^https?:/.test(url)) { a.rel = 'noopener'; a.target = '_blank'; }
    node.replaceWith(a);
  });

  /* 4e. CTA-er bytter tekst når butikken åpner */
  if (CFG.cta) {
    var c = CFG.butikkAktiv ? CFG.cta.medButikk : CFG.cta.utenButikk;
    if (c) {
      $$('.nav__cta, .menu__cta, .sticky-cta').forEach(function (a) {
        a.textContent = c.tekst;
        a.setAttribute('href', c.href);
      });
    }
  }

  /* ---------------------------------------------------------------------------
     5. VENTELISTE
     Uten konfigurert endepunkt lagres INGENTING, og siden sier det rett ut.
     --------------------------------------------------------------------------- */
  var form = $('#venteliste');
  if (form) {
    var input = $('#epost', form);
    var status = $('#form-status', form);
    var gyldig = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function si(tekst, type, html) {
      status.className = 'form__status is-' + type;
      if (html) { status.innerHTML = tekst; } else { status.textContent = tekst; }
    }

    function ferdig(tekst) {
      form.classList.add('is-done');
      status.className = 'form__status is-ok';
      status.textContent = '';
      var d = el('p', 'form__done', tekst);
      status.appendChild(d);
    }

    /* Uten både endepunkt og e-post er skjemaet en blindvei. Si fra i dev-modus
       slik at det ikke rekker å gå i produksjon i den tilstanden.              */
    if (DEV && !CFG.ventelisteEndepunkt && !CFG.kontaktEpost) {
      form.appendChild(unverifiedBox(
        'Skjemaet er ikke koblet til noe. Ingen påmeldinger blir tatt vare på.',
        'Sett config.ventelisteEndepunkt (Formspree, Supabase, Mailchimp) eller config.kontaktEpost i js/content.js før lansering.'
      ));
    }

    input.addEventListener('input', function () {
      input.removeAttribute('aria-invalid');
      if (status.classList.contains('is-error')) { si('', 'info'); }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var verdi = input.value.trim();

      if (!gyldig.test(verdi)) {
        input.setAttribute('aria-invalid', 'true');
        si('Skriv inn en gyldig e-postadresse.', 'error');
        input.focus();
        return;
      }

      if (!CFG.ventelisteEndepunkt) {
        /* Ingen backend konfigurert. Vi later ikke som at adressen er lagret. */
        if (CFG.kontaktEpost) {
          si('Påmeldingen er ikke koblet til noe system ennå, så adressen ble ikke lagret. ' +
             'Send den til <a href="mailto:' + CFG.kontaktEpost + '?subject=Sett%20meg%20p%C3%A5%20lista">' +
             CFG.kontaktEpost + '</a>, så legger vi deg på lista manuelt.', 'info', true);
        } else {
          si('Påmeldingen er ikke åpen ennå, så adressen ble ikke lagret. ' +
             'Vi åpner lista så snart påmeldingen er på plass.', 'info');
        }
        return;
      }

      var knapp = $('button[type="submit"]', form);
      knapp.disabled = true;
      si('Sender …', 'info');

      fetch(CFG.ventelisteEndepunkt, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ epost: verdi })
      })
        .then(function (r) {
          if (!r.ok) { throw new Error('HTTP ' + r.status); }
          ferdig('Du står på lista.');
        })
        .catch(function () {
          knapp.disabled = false;
          si('Noe gikk galt. Prøv igjen, eller send e-post til <a href="mailto:' +
             CFG.kontaktEpost + '">' + CFG.kontaktEpost + '</a>.', 'error', true);
        });
    });
  }

  /* ---------------------------------------------------------------------------
     6. FAQ — kun én åpen om gangen
     --------------------------------------------------------------------------- */
  var qas = $$('.qa');
  qas.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) { return; }
      qas.forEach(function (o) { if (o !== d) { o.open = false; } });
    });
  });
})();
