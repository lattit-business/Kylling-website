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
  var side = (location.pathname.split('/').pop() || './').toLowerCase().replace(/\.html$/, '');
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
      if (past && !sticky.classList.contains('vrikk')) { sticky.classList.add('vrikk'); }
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
      h.appendChild(el('span', 'dot dot--' + (key === 'original' ? 'original' : 'paprika')));
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
      feir(status);
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
        lenke.href = 'om-oss#status';
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

  /* ---------------------------------------------------------------------------
     4b. KONFETTI – en liten feiring når noen står på lista. Bare pynt: hoppes
         over ved redusert bevegelse eller i nettlesere uten Web Animations.
     --------------------------------------------------------------------------- */
  function feir(fra) {
    var h = document.documentElement;
    if (!h.classList.contains('anim') || h.classList.contains('anim--myk') || !Element.prototype.animate) { return; }
    var r = fra.getBoundingClientRect();
    var x0 = r.left + Math.min(r.width, 320) / 2, y0 = r.top + 16;
    var farger = ['#F1B240', '#A8492A', '#334D29', '#FAF8F3', '#11110F', '#D99A26'];
    var boks = el('div', 'konfetti');
    boks.setAttribute('aria-hidden', 'true');
    document.body.appendChild(boks);
    for (var i = 0; i < 40; i++) {
      var bit = el('i');
      bit.style.background = farger[i % farger.length];
      if (i % 3 === 0) { bit.style.borderRadius = '50%'; }
      if (i % 4 === 1) { bit.style.width = '6px'; bit.style.height = '14px'; }
      boks.appendChild(bit);
      var vinkel = -Math.PI * (0.1 + Math.random() * 0.8);      /* oppover, i vifte */
      var fart = 160 + Math.random() * 260;
      var dx = Math.cos(vinkel) * fart, dy = Math.sin(vinkel) * fart;
      var snurr = (Math.random() < .5 ? -1 : 1) * (360 + Math.random() * 540);
      bit.animate([
        { transform: 'translate(' + x0 + 'px,' + y0 + 'px) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + (x0 + dx) + 'px,' + (y0 + dy) + 'px) rotate(' + snurr / 2 + 'deg)', opacity: 1, offset: 0.5 },
        { transform: 'translate(' + (x0 + dx * 1.25) + 'px,' + (y0 + dy + 340) + 'px) rotate(' + snurr + 'deg)', opacity: 0 }
      ], { duration: 1500 + Math.random() * 700, easing: 'cubic-bezier(.2,.6,.35,1)', fill: 'forwards' });
    }
    window.setTimeout(function () { boks.remove(); }, 2500);
  }

  /* ---------------------------------------------------------------------------
     4c. KYLLINGEN SOM SNAKKER – trykk på maskoten i CTA-båndet, så hopper den
         og sier noe nytt. Boblen er aria-live, så skjermlesere får det med.
     --------------------------------------------------------------------------- */
  var replikker = [
    'Vi maser ikke. Vi sier bare fra.',
    'Pok pok!',
    'Kyllingen kom først. Bare så det er sagt.',
    'Åpne. Spis. Fortsett dagen.',
    'Jeg er ikke en bar. Jeg er ekte mat.',
    'Ferdigstekt og klar. Er du?',
    'Psst … e-posten din går i feltet der borte.',
    'Psst … det ligger et spill nederst på siden.'
  ];
  $$('.mascot__knapp').forEach(function (knapp) {
    var boble = $('[data-kakle]', knapp.parentNode);
    var nr = 0;
    knapp.addEventListener('click', function () {
      nr = (nr + 1) % replikker.length;
      if (boble) {
        boble.textContent = replikker[nr];
        boble.classList.remove('ny'); void boble.offsetWidth; boble.classList.add('ny');
      }
      knapp.classList.remove('hopp'); void knapp.offsetWidth; knapp.classList.add('hopp');
    });
  });

  /* ---------------------------------------------------------------------------
     4d. PIKSELSMULER – en liten sky av pikselruter (f.eks. når noen trykker på
         en knapp eller finner Bare Kylling i sekken). Bare pynt: hoppes over
         ved redusert bevegelse eller i nettlesere uten Web Animations.
     --------------------------------------------------------------------------- */
  function kanBevege() {
    var h = document.documentElement;
    return h.classList.contains('anim') && !h.classList.contains('anim--myk') && !!Element.prototype.animate;
  }

  function piksler(x, y, antall, farger) {
    if (!kanBevege()) { return; }
    farger = farger || ['#F1B240', '#11110F', '#D99A26', '#FAF8F3'];
    var boks = el('div', 'konfetti');
    boks.setAttribute('aria-hidden', 'true');
    document.body.appendChild(boks);
    for (var i = 0; i < (antall || 10); i++) {
      var bit = el('i', 'piksel');
      var str = 4 + (i % 3) * 2;
      bit.style.width = str + 'px';
      bit.style.height = str + 'px';
      bit.style.background = farger[i % farger.length];
      boks.appendChild(bit);
      var v = Math.random() * Math.PI * 2, d = 24 + Math.random() * 34;
      bit.animate([
        { transform: 'translate(' + x + 'px,' + y + 'px)', opacity: 1 },
        { transform: 'translate(' + (x + Math.cos(v) * d) + 'px,' + (y + Math.sin(v) * d - 12) + 'px)', opacity: 1, offset: 0.6 },
        { transform: 'translate(' + (x + Math.cos(v) * d * 1.15) + 'px,' + (y + Math.sin(v) * d + 20) + 'px)', opacity: 0 }
      ], { duration: 520 + Math.random() * 260, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    }
    window.setTimeout(function () { boks.remove(); }, 900);
  }

  /* ---------------------------------------------------------------------------
     4e. BRYTEREN i «Problemet» – to faner (role="tab") som ser ut som én
         bryter: «Hva er i sekken?» (vises først) og «Snu pakken». Rekkefølgen
         følger fanene i HTML-en. Begge visningene ligger i
         samme rute (se C3 i css), så høyden står stille når man bytter.
         .er-klar settes først når alt er koblet opp – uten JavaScript står
         begge visningene under hverandre, og bryteren er skjult.
     --------------------------------------------------------------------------- */
  var velgVisning = function () {};
  var bryter = $('.bryter');
  var scene = $('.scene');
  if (bryter && scene) {
    var faner = $$('[role="tab"]', bryter);
    var visninger = faner.map(function (f) { return document.getElementById(f.getAttribute('aria-controls')); });
    var valgt = 0;
    var pakkeFane = Math.max(0, faner.indexOf(document.getElementById('fane-pakke')));

    velgVisning = function (i, fokus) {
      var fra = valgt;
      valgt = i;
      faner.forEach(function (f, n) {
        var paa = n === i;
        f.setAttribute('aria-selected', String(paa));
        f.tabIndex = paa ? 0 : -1;
        visninger[n].classList.toggle('er-valgt', paa);
        if (paa) { visninger[n].removeAttribute('inert'); } else { visninger[n].setAttribute('inert', ''); }
      });
      bryter.setAttribute('data-valgt', String(i));
      if (i !== fra) {
        /* kyllingen på knotten ser dit den skal, og hopper */
        bryter.classList.toggle('mot-venstre', i < fra);
        bryter.classList.remove('hopp'); void bryter.offsetWidth; bryter.classList.add('hopp');
      }
      if (fokus) { faner[i].focus(); }
    };

    faner.forEach(function (f, n) {
      f.addEventListener('click', function () { velgVisning(n); });
      f.addEventListener('keydown', function (e) {
        var maal = { ArrowRight: n + 1, ArrowLeft: n - 1, Home: 0, End: faner.length - 1 }[e.key];
        if (maal === undefined) { return; }
        e.preventDefault();
        velgVisning((maal + faner.length) % faner.length, true);
      });
    });
    bryter.hidden = false;
    velgVisning(0);
    scene.classList.add('er-klar');
  }

  /* Visning 2: snu pakken – knappen og selve pakken snur den */
  $$('.snu').forEach(function (snu) {
    var knapp = $('.snu__knapp', snu);
    var kort = $('.snu__kort', snu);
    var tekst = $('.snu__tekst', snu);
    var ord = $('.snu__ord', snu);
    if (!knapp || !kort) { return; }
    function snuPakken() {
      var snudd = !snu.classList.contains('er-snudd');
      snu.classList.toggle('er-snudd', snudd);
      knapp.setAttribute('aria-pressed', String(snudd));
      if (ord) { ord.textContent = snudd ? 'Snu tilbake' : 'Snu pakken'; }
      if (tekst) { tekst.textContent = snudd ? 'Baksiden av Bare Kylling.' : 'En vanlig proteinbar.'; }
      if (snudd) {
        window.setTimeout(function () {
          var r = kort.getBoundingClientRect();
          piksler(r.left + r.width * 0.8, r.top + r.height * 0.22, 12);
        }, 750);
      }
    }
    knapp.hidden = false;
    knapp.addEventListener('click', snuPakken);
    kort.addEventListener('click', snuPakken);
    snu.classList.add('er-klar');
  });

  /* Visning 1: hva er i sekken? – tingen løftes opp, dommen står i boblen */
  var domBoble = $('[data-dom-boble]');
  var ting = $$('.ting');
  ting.forEach(function (t) {
    t.addEventListener('click', function () {
      ting.forEach(function (x) {
        var paa = x === t;
        x.classList.toggle('er-oppe', paa);
        x.setAttribute('aria-pressed', String(paa));
      });
      if (!domBoble) { return; }
      domBoble.textContent = '';
      domBoble.appendChild(el('b', null, t.getAttribute('data-navn') + ':'));
      domBoble.appendChild(document.createTextNode(' ' + t.getAttribute('data-dom')));
      /* Proteinbaren: «Snu den» tar deg til den andre visningen og snur den */
      if (t.getAttribute('data-lenke') === 'pakke' && bryter) {
        var lenke = el('button', 'sekk__lenke', 'Snu den →');
        lenke.type = 'button';
        lenke.addEventListener('click', function () {
          velgVisning(pakkeFane, true);
          var snu = $('.snu');
          if (snu && !snu.classList.contains('er-snudd')) { $('.snu__knapp', snu).click(); }
        });
        domBoble.appendChild(document.createTextNode(' '));
        domBoble.appendChild(lenke);
      }
      domBoble.classList.remove('ny'); void domBoble.offsetWidth; domBoble.classList.add('ny');
      if (t.hasAttribute('data-feir')) {
        var r = t.getBoundingClientRect();
        piksler(r.left + r.width / 2, r.top + 8, 14);
      }
    });
  });

  /* ---------------------------------------------------------------------------
     4f. EN DAG SOM GÅR FORT (Fordeler)
         Fra 768 px: hvor langt du har dratt i sporet, er tiden på dagen. Den
         styrer himmelen (--himmel, --p, --bue, .er-kveld, .er-natt), hvilket
         stopp som er aktivt, og telleren. Pilene og musa flytter ett stopp.
         Mobil: stoppet som passerer midten av skjermen er «nå», og merket øverst
         viser tiden på dagen (morgen … kveld) med sol eller måne. Uten JavaScript er tidslinjen bare en vanlig liste.
     --------------------------------------------------------------------------- */
  var dag = $('.dag');
  if (dag) {
    var spor = $('.dag__spor', dag);
    var stopp = $$('.stop', dag);
    var styr = $('.dag__styr', dag);
    var piler = $$('.dag__pil', dag);
    var nrEl = $('[data-dag-nr]', dag);
    var delEl = $('[data-dag-del]', dag);
    var bred = window.matchMedia('(min-width: 768px)');
    var aktiv = -1;
    /* Himmelen gjennom dagen: daggry → formiddag → middag → ettermiddag → solnedgang → kveld */
    var himmel = [[0, [248, 235, 200]], [0.2, [246, 215, 142]], [0.45, [241, 178, 64]],
                  [0.65, [217, 154, 38]], [0.82, [168, 73, 42]], [1, [36, 55, 29]]];

    var blandet = function (p) {
      for (var i = 1; i < himmel.length; i++) {
        if (p <= himmel[i][0]) {
          var a = himmel[i - 1], b = himmel[i], t = (p - a[0]) / (b[0] - a[0]);
          return 'rgb(' + a[1].map(function (c, k) { return Math.round(c + (b[1][k] - c) * t); }).join(',') + ')';
        }
      }
      return 'rgb(36,55,29)';
    };

    var settDag = function (p, i) {
      dag.style.setProperty('--p', p.toFixed(4));
      dag.style.setProperty('--bue', Math.sin(p * Math.PI).toFixed(4));
      dag.style.setProperty('--himmel', blandet(p));
      dag.classList.toggle('er-kveld', p > 0.78);
      dag.classList.toggle('er-natt', p > 0.93);
      if (i === aktiv || !stopp[i]) { return; }
      if (stopp[aktiv]) { stopp[aktiv].classList.remove('er-aktiv'); }
      aktiv = i;
      stopp[i].classList.add('er-aktiv');
      if (nrEl) { nrEl.textContent = String(i + 1); }
      if (delEl) { delEl.textContent = stopp[i].getAttribute('data-del'); }
      if (piler.length === 2) {
        piler[0].disabled = i === 0;
        piler[1].disabled = i === stopp.length - 1;
      }
    };

    var steg = function () {
      return stopp.length > 1 ? stopp[1].offsetLeft - stopp[0].offsetLeft : spor.clientWidth;
    };

    var ramme = 0;
    var lesSpor = function () {
      ramme = 0;
      if (!bred.matches) { return; }
      var maks = steg() * (stopp.length - 1);
      var p = maks > 0 ? Math.min(1, Math.max(0, spor.scrollLeft / maks)) : 0;
      settDag(p, Math.round(p * (stopp.length - 1)));
    };
    spor.addEventListener('scroll', function () {
      if (!ramme) { ramme = requestAnimationFrame(lesSpor); }
    }, { passive: true });

    piler.forEach(function (pil) {
      pil.addEventListener('click', function () {
        var maal = Math.max(0, Math.min(stopp.length - 1, aktiv + Number(pil.getAttribute('data-retning'))));
        spor.scrollTo({ left: maal * steg(), behavior: lite ? 'auto' : 'smooth' });
      });
    });

    /* Dra med musa (berøring og styreflate scroller som vanlig) */
    var drar = null;
    spor.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !bred.matches) { return; }
      drar = { x: e.clientX, start: spor.scrollLeft, flyttet: false };
    });
    window.addEventListener('pointermove', function (e) {
      if (!drar) { return; }
      var dx = e.clientX - drar.x;
      if (!drar.flyttet && Math.abs(dx) > 4) { drar.flyttet = true; spor.classList.add('drar'); }
      if (drar.flyttet) { spor.scrollLeft = drar.start - dx; }
    });
    window.addEventListener('pointerup', function () {
      if (!drar) { return; }
      var flyttet = drar.flyttet;
      drar = null;
      if (!flyttet) { return; }
      spor.classList.remove('drar');
      spor.scrollTo({ left: Math.round(spor.scrollLeft / steg()) * steg(), behavior: lite ? 'auto' : 'smooth' });
    });

    /* Mobil: det stoppet som krysser midten av skjermen, er «nå» */
    if ('IntersectionObserver' in window) {
      var midten = new IntersectionObserver(function (oppf) {
        if (bred.matches) { return; }
        oppf.forEach(function (o) {
          if (!o.isIntersecting) { return; }
          var i = stopp.indexOf(o.target);
          settDag(stopp.length > 1 ? i / (stopp.length - 1) : 0, i);
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      stopp.forEach(function (st) { midten.observe(st); });
    }

    var byttModus = function () { if (bred.matches) { lesSpor(); } };
    if (bred.addEventListener) { bred.addEventListener('change', byttModus); } else { bred.addListener(byttModus); }
    if (styr) { styr.hidden = false; }
    settDag(0, 0);
  }

  /* ---------------------------------------------------------------------------
     4g. SMÅ DETALJER
         – Fylte knapper drysser noen pikselsmuler der du trykker.
         – Kyllingen i bunnen hopper når du trykker på den, og etter fem trykk
           legger den et egg. (Den har tross alt svart på FAQ-spørsmålet.)
     --------------------------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var knapp = e.target.closest && e.target.closest('.btn--ink, .btn--honey, .sticky-cta');
    if (!knapp) { return; }
    var x = e.clientX, y = e.clientY;
    if (!e.detail) {                     /* tastatur: midt på knappen */
      var r = knapp.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top + r.height / 2;
    }
    piksler(x, y, 9);
  });

  var fotMerke = $('.foot__mark');
  if (fotMerke) {
    var klukk = 0, klukkTid = 0, harEgg = false;
    fotMerke.addEventListener('click', function () {
      fotMerke.classList.remove('klukk'); void fotMerke.offsetWidth; fotMerke.classList.add('klukk');
      klukk += 1;
      window.clearTimeout(klukkTid);
      klukkTid = window.setTimeout(function () { klukk = 0; }, 2500);
      if (klukk < 5 || harEgg) { return; }
      klukk = 0;
      harEgg = true;
      var egg = el('span', 'egg');
      var boble = el('p', 'bubble egg__boble ny', 'Kyllingen kom først.');
      fotMerke.appendChild(egg);
      fotMerke.appendChild(boble);
      window.setTimeout(function () { egg.remove(); boble.remove(); harEgg = false; }, 3800);
    });
  }

  /* ---------------------------------------------------------------------------
     5. ANIMASJONER
     Klassen .anim settes på <html> av et lite skript i <head> (felles
     hode-blokk) når nettleseren støtter IntersectionObserver og brukeren ikke
     har bedt om redusert bevegelse. Uten den er alt synlig og i ro.
     Alle animasjoner er pynt: innholdet er komplett uten dem.
     --------------------------------------------------------------------------- */
  var html = document.documentElement;
  if (!html.classList.contains('anim')) { return; }
  var myk = html.classList.contains('anim--myk');

  /* 5-0. Hero- og ventelistebildet animeres inn først når de er lastet
          (onload i HTML-en setter .klar). Dette er en ekstra sikring, så
          bildet aldri blir stående skjult.                                  */
  $$('.hero__img, .launch__cutout img').forEach(function (img) {
    function klar() { img.classList.add('klar'); }
    if (img.complete) { klar(); return; }
    img.addEventListener('load', klar, { once: true });
    img.addEventListener('error', klar, { once: true });
    window.setTimeout(klar, 2500);
  });

  /* 5a. Innhold som toner inn når det kommer til syne. Bare elementer som er
         under skjermkanten ved lasting animeres – det som allerede vises, står
         i ro. Elementer med id (ankermål) animeres aldri, så hopp til #anker
         lander riktig. Etter animasjonen fjernes klassene, så hover-effekter
         på de samme elementene virker som normalt.                          */
  var utvalg = [
    '.sec__head', '.split__media', '.split__body', '.compare__scroll', '.note',
    '.gains__media', '.gain',
    '.problem__head', '.scene', '.problem__slutt', '.dag__head', '.stop', '.moment', '.duo__card', '.qitem', '.decl', '.faq__list .qa', '.faq__more',
    '.launch--band .launch__copy', '.launch__mascot',
    '.media--flavor', '.flavor__inner > *',
    '.ben__body', '.media--ben', '.trans__lists', '.trans__stamp', '.trans__more',
    '.about__grid > *', '.about__body', '.about__h2', '.values .value', '.status__row', '.about__figure', '.about__foot',
    '.step', '.how__link', '.faq__group', '.foot__mark', '.foot__cols > *'
  ].join(',');

  var skjerm = window.innerHeight;
  var kandidater = $$(utvalg).filter(function (el) {
    return !el.id && el.getBoundingClientRect().top > skjerm * 0.92;
  });

  function ferdig(el) {
    el.classList.remove('reveal', 'is-in');
    el.style.removeProperty('--i');
  }

  var vakt = new IntersectionObserver(function (oppf) {
    oppf.forEach(function (o) {
      if (!o.isIntersecting) { return; }
      var el = o.target;
      vakt.unobserve(el);
      el.classList.add('is-in');
      var ms = 1500 + (parseFloat(el.style.getPropertyValue('--i')) || 0) * 90;
      window.setTimeout(function () { ferdig(el); }, ms);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  kandidater.forEach(function (el) {
    /* Forsinkelse etter plass blant søsken i samme rutenett/liste */
    var sosken = Array.prototype.filter.call(el.parentNode.children, function (s) { return kandidater.indexOf(s) > -1; });
    var i = Math.min(sosken.indexOf(el), 5);
    if (i > 0) { el.style.setProperty('--i', i); }
    el.classList.add('reveal');
    vakt.observe(el);
  });

  /* 5b. Tallene i heroen teller opp (bare hele tall, f.eks. «200»). Bredden
         låses først, så enheten ved siden av ikke hopper.                    */
  $$('.hero__stats .stat__v:not(.is-pending) .stat__num').forEach(function (n) {
    var mal = parseInt(n.textContent, 10);
    if (!(mal > 1)) { return; }
    n.style.minWidth = n.getBoundingClientRect().width + 'px';
    n.style.display = 'inline-block';
    n.textContent = '0';
    var start = null, varighet = 1100, forsinkelse = 550;
    function steg(t) {
      if (start === null) { start = t + forsinkelse; }
      var p = Math.min(1, Math.max(0, (t - start) / varighet));
      n.textContent = String(Math.round(mal * (1 - Math.pow(1 - p, 3))));
      if (p < 1) { requestAnimationFrame(steg); }
    }
    requestAnimationFrame(steg);
  });

  /* 5d. Pakkene i heroen vipper litt mot musepekeren (bare mus, og ikke ved
         redusert bevegelse)                                                  */
  var vippe = $('.hero__tilt'), heroFlate = $('.hero');
  if (vippe && heroFlate && !myk && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var ramme = 0, mx = 0, my = 0;
    heroFlate.addEventListener('pointermove', function (e) {
      var r = heroFlate.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width - 0.5;
      my = (e.clientY - r.top) / r.height - 0.5;
      if (ramme) { return; }
      ramme = requestAnimationFrame(function () {
        ramme = 0;
        vippe.style.transform = 'perspective(1000px) rotateY(' + (mx * 9).toFixed(2) + 'deg) rotateX(' +
          (-my * 6).toFixed(2) + 'deg) translate(' + (mx * 12).toFixed(1) + 'px,' + (my * 8).toFixed(1) + 'px)';
      });
    });
    heroFlate.addEventListener('pointerleave', function () { vippe.style.transform = ''; });
  }

  /* 5e. Kyllingen i CTA-båndet lener seg mot musepekeren, og smakskortene
         vipper litt mot den (bare mus, og ikke ved redusert bevegelse)       */
  if (!myk && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var band = $('.launch--band');
    var maskot = $('.launch__mascot .mascot__knapp');
    if (band && maskot) {
      var lenRamme = 0, lenX = 0;
      band.addEventListener('pointermove', function (e) {
        var r = maskot.getBoundingClientRect();
        lenX = (e.clientX - (r.left + r.width / 2)) / 40;
        if (lenRamme) { return; }
        lenRamme = requestAnimationFrame(function () {
          lenRamme = 0;
          maskot.style.transform = 'rotate(' + Math.max(-9, Math.min(9, lenX)).toFixed(1) + 'deg)';
        });
      });
      band.addEventListener('pointerleave', function () { maskot.style.transform = ''; });
    }
    $$('.duo__card').forEach(function (kort) {
      var kRamme = 0, kx = 0, ky = 0;
      kort.addEventListener('pointermove', function (e) {
        var r = kort.getBoundingClientRect();
        kx = (e.clientX - r.left) / r.width - 0.5;
        ky = (e.clientY - r.top) / r.height - 0.5;
        if (kRamme) { return; }
        kRamme = requestAnimationFrame(function () {
          kRamme = 0;
          kort.style.transform = 'perspective(1000px) translateY(-6px) rotateX(' + (-ky * 4).toFixed(2) + 'deg) rotateY(' + (kx * 5).toFixed(2) + 'deg)';
        });
      });
      kort.addEventListener('pointerleave', function () { kort.style.transform = ''; });
    });
  }

  /* 5c. Bilder som lastes lat, toner inn i stedet for å dukke opp brått */
  $$('img[loading="lazy"]').forEach(function (img) {
    if (img.complete) { return; }
    img.classList.add('laster');
    function vis() { img.classList.remove('laster'); img.classList.add('lastet'); }
    img.addEventListener('load', vis, { once: true });
    img.addEventListener('error', vis, { once: true });
  });
})();
