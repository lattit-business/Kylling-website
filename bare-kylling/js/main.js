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
     0. NY SIDE STARTER ØVERST
     Nettlesere åpner en ny side øverst av seg selv, men innebygde visninger
     (f.eks. forhåndsvisninger i iframe) kan ta med scrollposisjonen fra
     forrige side. Rett etter lasting flyttes siden derfor tilbake til toppen,
     eller til #ankeret lenken peker på, hvis noe annet enn brukeren har
     scrollet den. Tilbake/fram og oppdatering beholder posisjonen som vanlig,
     og vakten slår seg av så snart brukeren scroller, trykker eller taster.
     --------------------------------------------------------------------------- */
  (function () {
    var nav = window.performance && performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    if (nav && nav.type !== 'navigate') { return; }

    var root = document.documentElement;
    var aktiv = true;
    var hendelser = ['wheel', 'touchstart', 'pointerdown', 'keydown'];

    function mal() {
      var id = decodeURIComponent(location.hash.slice(1));
      var el = id ? document.getElementById(id) : null;
      if (!el) { return 0; }
      var pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
      return Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - pad));
    }
    function rett() {
      if (!aktiv) { return; }
      var y = mal();
      if (Math.abs(window.scrollY - y) > 2) { window.scrollTo(0, y); }
    }
    function stopp() {
      if (!aktiv) { return; }
      aktiv = false;
      root.style.scrollBehavior = '';
      window.removeEventListener('scroll', rett);
      hendelser.forEach(function (t) { window.removeEventListener(t, stopp, true); });
    }

    root.style.scrollBehavior = 'auto';   /* hopp direkte, ikke animert */
    hendelser.forEach(function (t) { window.addEventListener(t, stopp, { capture: true, passive: true }); });
    window.addEventListener('scroll', rett, { passive: true });
    window.addEventListener('load', function () { rett(); window.setTimeout(stopp, 1500); });
  })();

  /* ---------------------------------------------------------------------------
     1. NAVIGASJON
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
      window.setTimeout(function () { if (!menuOpen) { menu.hidden = true; } }, lite ? 0 : 250);
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
     2. STICKY CTA (mobil) – vises etter heroen, skjules ved skjemaet og bunnen
     --------------------------------------------------------------------------- */
  var sticky = $('.sticky-cta');
  var hero = $('.hero, .subhero, .launch--page, .oops');
  var lansering = $('#lansering');
  var iLansering = false;
  var ticking = false;

  if (lansering && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      iLansering = e[0].isIntersecting;
      if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    }, { threshold: 0 }).observe(lansering);
  }

  function frame() {
    ticking = false;
    var y = window.scrollY;
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
     3. INNHOLD FRA content.js
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

  function chips(liste) {
    var ul = el('ul', 'chips');
    (liste || []).forEach(function (note) { ul.appendChild(el('li', null, note)); });
    return ul;
  }

  function fmt(n, des) {
    return Number(n).toFixed(des).replace('.', ',');
  }

  /* 3a. Nøkkeltall i heroen og i sammenligningstabellen. HTML-en viser
         plassholdere; de byttes ut først når tallene er bekreftet.          */
  var nk = BK.nokkeltall || {};
  $$('[data-nokkeltall]').forEach(function (stat) {
    var tall = nk[stat.getAttribute('data-nokkeltall')];
    if (!tall) { return; }
    var v = $('.stat__v', stat);
    if (nk.bekreftet) {
      v.classList.remove('is-pending');
      $$('[aria-hidden]', v).forEach(function (n) { n.removeAttribute('aria-hidden'); });
      $('.stat__num', v).textContent = tall.verdi;
      $('.stat__unit', v).textContent = tall.enhet;
      var merknad = $('.stat__note', stat);
      if (merknad) { merknad.remove(); }
    } else if (DEV) {
      stat.appendChild(unverifiedBox('Skjult: ' + tall.verdi + ' ' + tall.enhet, 'Kilde: ' + (nk.kilde || 'ukjent')));
    }
  });
  if (nk.bekreftet) {
    $$('[data-nokkeltall-tekst]').forEach(function (n) {
      var tall = nk[n.getAttribute('data-nokkeltall-tekst')];
      if (!tall) { return; }
      n.textContent = tall.verdi + ' ' + tall.enhet;
      n.classList.remove('pending');
    });
  }

  /* 3b. Næringsdeklarasjon, ingredienser og allergener per smak. Per pakke
         regnes ut fra pakkevekten, så det holder å fylle inn per 100 g.     */
  var vekt = BK.pakkevekt || 200;
  $$('details.decl[data-smak]').forEach(function (decl) {
    var smak = (BK.smaker || {})[decl.getAttribute('data-smak')];
    if (!smak) { return; }
    var n = smak.naering || {};
    if (n.bekreftet && n.per100) {
      $$('td[data-n]', decl).forEach(function (td) {
        var key = td.getAttribute('data-n');
        var faktor = td.getAttribute('data-per') === 'pakke' ? vekt / 100 : 1;
        var p = n.per100;
        if (key === 'energi') {
          if (p.energiKj == null || p.energiKcal == null) { return; }
          td.textContent = Math.round(p.energiKj * faktor) + ' kJ / ' + Math.round(p.energiKcal * faktor) + ' kcal';
        } else if (p[key] != null) {
          td.textContent = fmt(p[key] * faktor, key === 'salt' ? 2 : 1) + ' g';
        }
      });
      var vent = $('[data-decl-pending]', decl);
      if (vent) { vent.remove(); }
    }
  });
  $$('[data-ingredienser-for]').forEach(function (p) {
    var smak = (BK.smaker || {})[p.getAttribute('data-ingredienser-for')];
    var ing = smak && smak.ingredienser;
    if (!ing) { return; }
    if (ing.bekreftet && ing.tekst) { p.textContent = ing.tekst; }
    else if (DEV) { p.parentNode.insertBefore(unverifiedBox('Ingrediensliste mangler', ing.notat), p.nextSibling); }
  });
  $$('[data-allergener-for]').forEach(function (p) {
    var smak = (BK.smaker || {})[p.getAttribute('data-allergener-for')];
    var al = smak && smak.allergener;
    if (!al) { return; }
    if (al.bekreftet && al.tekst) { p.textContent = al.tekst; }
    else if (DEV) { p.parentNode.insertBefore(unverifiedBox('Allergener mangler', al.notat), p.nextSibling); }
  });

  /* 3c. Opprinnelse, kvalitetskontroll, holdbarhet og oppbevaring */
  $$('[data-info]').forEach(function (p) {
    var info = BK[p.getAttribute('data-info')];
    if (!info) { return; }
    if (info.bekreftet && info.tekst) {
      p.textContent = info.tekst;
    } else if (DEV) {
      p.parentNode.appendChild(unverifiedBox(null, 'Krever: ' + info.krever));
    }
  });
  $$('[data-info-tag]').forEach(function (tag) {
    var info = BK[tag.getAttribute('data-info-tag')];
    if (info && info.bekreftet && info.tekst) { tag.remove(); }
  });

  /* 3d. Hva er i pakken (hvorfor.html). Bekreftet deklarasjon vises som tekst;
         ellers vises smaksnotene, som er det vi faktisk kan si noe om.        */
  var listeMal = $('[data-ingredienser]');
  if (listeMal) {
    Object.keys(BK.smaker || {}).forEach(function (key) {
      var s = BK.smaker[key];
      var ing = s.ingredienser || {};
      var art = el('article', 'ing');
      var h = el('h3', 'ing__navn');
      h.appendChild(el('span', 'dot dot--' + (key === 'original' ? 'salt' : 'paprika')));
      h.appendChild(document.createTextNode(s.navn));
      art.appendChild(h);

      if (ing.bekreftet && ing.tekst) {
        art.appendChild(el('p', 'ing__tekst', ing.tekst));
      } else {
        art.appendChild(chips([ing.base || 'Kyllingfilet'].concat(s.smaksnoter || [])));
        if (DEV) { art.appendChild(unverifiedBox('Ingrediensliste mangler', ing.notat)); }
      }
      listeMal.appendChild(art);
    });
  }

  /* 3e. Innholdsstempel (hvorfor.html) */
  var claim = $('[data-claim="rentKjott"]');
  if (claim && BK.rentKjott) {
    var rk = BK.rentKjott;
    var note = $('.trans__stamp-note');
    claim.textContent = rk.bekreftet ? rk.tekst : rk.reserve;
    if (note) { note.textContent = rk.bekreftet ? rk.note : rk.reserveNote; }
    if (!rk.bekreftet && DEV) {
      var merker = (BK.merker || []).filter(function (m) { return !m.bekreftet; }).map(function (m) { return m.navn; }).join(' · ');
      claim.parentNode.appendChild(unverifiedBox('Ønsket tekst: ' + rk.tekst, 'Ubekreftede merker på pakken: ' + merker));
    }
  }

  /* 3f. Kontakt i footer: ekte lenker når de finnes i content.js, ellers
         beholdes setningen som står i HTML-en.                             */
  var kontakt = $('[data-kontakt]');
  var lenker = CFG.lenker || {};
  if (kontakt && (CFG.kontaktEpost || lenker.instagram)) {
    $$('p:not(.foot__h)', kontakt).forEach(function (p) { p.remove(); });
    if (CFG.kontaktEpost) {
      var m = el('a', null, CFG.kontaktEpost);
      m.href = 'mailto:' + CFG.kontaktEpost;
      kontakt.appendChild(m);
    }
    if (lenker.instagram) {
      var ig = el('a', null, 'Instagram');
      ig.href = lenker.instagram; ig.rel = 'noopener'; ig.target = '_blank';
      kontakt.appendChild(ig);
    }
  }

  /* 3g. CTA-er bytter tekst når butikken åpner */
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
     4. VENTELISTE
     Uten konfigurert endepunkt lagres ingenting. Da sier siden det før folk
     rekker å skrive inn adressen – ikke etterpå.
     --------------------------------------------------------------------------- */
  var form = $('#venteliste');
  if (form) {
    var input = $('#epost', form);
    var status = $('#form-status', form);
    var knapp = $('button[type="submit"]', form);
    var gyldig = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var koblet = !!CFG.ventelisteEndepunkt;

    function si(tekst, type, html) {
      status.className = 'form__status is-' + type;
      if (html) { status.innerHTML = tekst; } else { status.textContent = tekst; }
    }

    function ferdig(tekst) {
      form.classList.add('is-done');
      status.className = 'form__status is-ok';
      status.textContent = '';
      status.appendChild(el('p', 'form__done', tekst));
    }

    if (!koblet) {
      var lead = $('.launch__lead');
      var notice = el('div', 'form__notice');
      if (CFG.kontaktEpost) {
        notice.innerHTML = 'Skjemaet er ikke koblet til ennå. Send en e-post til <a href="mailto:' + CFG.kontaktEpost +
          '?subject=Sett%20meg%20p%C3%A5%20lista">' + CFG.kontaktEpost + '</a>, så legger vi deg på lista manuelt.';
      } else {
        if (lead) {
          lead.textContent = 'Første batch er under arbeid. Påmeldingen åpner om kort tid – da kan du legge igjen ' +
            'e-posten din her og få beskjed først når kyllingen er klar.';
        }
        notice.appendChild(el('p', null, 'Fram til da kan du se hvor langt vi er kommet med resept, produksjon og lansering.'));
        var lenke = el('a', 'btn btn--ink', 'Se status på Om oss');
        lenke.href = 'om-oss.html#status';
        notice.appendChild(lenke);
      }
      $('.form__row', form).hidden = true;
      $('.form__fine', form).hidden = true;
      form.appendChild(notice);
      if (DEV) {
        form.appendChild(unverifiedBox(
          'Skjemaet er ikke koblet til noe. Ingen påmeldinger blir tatt vare på.',
          'Sett config.ventelisteEndepunkt (Formspree, Supabase, Mailchimp) i js/content.js før lansering.'
        ));
      }
    }

    input.addEventListener('input', function () {
      input.removeAttribute('aria-invalid');
      if (status.classList.contains('is-error')) { si('', 'info'); }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!koblet) { return; }
      var verdi = input.value.trim();

      if (!gyldig.test(verdi)) {
        input.setAttribute('aria-invalid', 'true');
        si('Skriv inn en gyldig e-postadresse.', 'error');
        input.focus();
        return;
      }

      knapp.disabled = true;
      si('Sender …', 'info');

      fetch(CFG.ventelisteEndepunkt, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: verdi, kilde: 'venteliste' })
      })
        .then(function (r) {
          if (!r.ok) { throw new Error('HTTP ' + r.status); }
          ferdig('Du står på lista.');
        })
        .catch(function () {
          knapp.disabled = false;
          si('Noe gikk galt. Prøv igjen om litt.' + (CFG.kontaktEpost
            ? ' Eller send e-post til <a href="mailto:' + CFG.kontaktEpost + '">' + CFG.kontaktEpost + '</a>.'
            : ''), 'error', true);
        });
    });
  }
})();
