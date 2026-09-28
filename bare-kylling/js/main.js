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
    'Psst … e-posten din går i feltet der borte.'
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
    '.benefit', '.moment', '.duo__card', '.qitem', '.decl', '.faq__list .qa', '.faq__more',
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

  /* 5c. Bilder som lastes lat, toner inn i stedet for å dukke opp brått */
  $$('img[loading="lazy"]').forEach(function (img) {
    if (img.complete) { return; }
    img.classList.add('laster');
    function vis() { img.classList.remove('laster'); img.classList.add('lastet'); }
    img.addEventListener('load', vis, { once: true });
    img.addEventListener('error', vis, { once: true });
  });
})();
