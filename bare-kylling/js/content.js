/* =============================================================================
   BARE KYLLING — INNHOLDSDATA
   -----------------------------------------------------------------------------
   Dette er den ENESTE filen du trenger å redigere for å endre ingredienser,
   næringstall, påstander og CTA-tekster.

   VIKTIG OM PÅSTANDER
   Alt som har "bekreftet: false" er IKKE verifisert og vises derfor ikke på den
   publiserte siden. Det vises kun som en tydelig merket boks når
   config.devModus = true, slik at dere ser hva som gjenstår.

   Slik gjør du et tall/en påstand offentlig:
     1. Skaff dokumentasjon (næringsanalyse, sertifiseringsbevis, resept).
     2. Sett "bekreftet: true" på den aktuelle oppføringen.
     3. Sett config.devModus = false før publisering.
   ============================================================================= */

window.BK = {

  /* ---------------------------------------------------------------------------
     1. KONFIGURASJON
     --------------------------------------------------------------------------- */
  config: {
    /* true  = viser ubekreftet innhold merket som "MÅ VERIFISERES" (for internt bruk)
       false = skjuler alt ubekreftet. SETT DENNE TIL false FØR LANSERING.       */
    devModus: false,

    /* Sett inn URL når skjemaet skal kobles til Formspree, Supabase, Mailchimp
       e.l. Så lenge denne er null lagres INGENTING, og siden sier det ærlig.    */
    ventelisteEndepunkt: null,

    /* Ekte e-postadresse. Så lenge denne er null vises ingen e-postlenke, og
       siden finner ikke på en adresse. Fyll inn når dere har en.               */
    kontaktEpost: null,

    /* Ekte profil-/kontaktlenker. null = vises som «kommer», ikke som lenke.   */
    lenker: {
      instagram: null,
      kontakt: null
    },

    /* Sett til true når nettbutikken er live. Da bytter alle hoved-CTA-er.      */
    butikkAktiv: false,
    cta: {
      medButikk: { tekst: 'Bestill nå',                 href: 'smakene.html'    },
      utenButikk: { tekst: 'Få beskjed ved lansering',  href: 'venteliste.html' }
    }
  },

  /* ---------------------------------------------------------------------------
     2. NÆRINGSINNHOLD  — IKKE BEKREFTET
     Tallene under står på produktmockupen, men er ikke dokumentert gjennom
     næringsanalyse. De vises derfor ikke offentlig.
     --------------------------------------------------------------------------- */
  naering: {
    bekreftet: false,
    kilde: 'Trykket på pakkedesignet. Mangler dokumentert næringsanalyse fra laboratorium.',
    porsjon: '200 g',
    verdier: [
      { navn: 'Protein',   verdi: '36 g',   per: 'per 200 g' },
      { navn: 'Kalorier',  verdi: '185',    per: 'per 200 g' }
    ]
  },

  /* ---------------------------------------------------------------------------
     3. MERKER OG PÅSTANDER — IKKE BEKREFTET
     "Nyt Norge" krever avtale med Matmerk. De øvrige krever dokumentert resept
     og produksjonsprosess. Ingen av dem vises offentlig før bekreftet: true.
     --------------------------------------------------------------------------- */
  merker: [
    { navn: '100 % kylling',          bekreftet: false, krever: 'Dokumentert resept og kjøttinnhold' },
    { navn: 'Ingen tilsatt vann',     bekreftet: false, krever: 'Dokumentert produksjonsprosess'     },
    { navn: 'Uten tilsetningsstoffer', bekreftet: false, krever: 'Full ingrediensdeklarasjon'        },
    { navn: 'Nyt Norge',              bekreftet: false, krever: 'Godkjent avtale med Stiftelsen Matmerk' }
  ],

  /* Teksten i det store innholdsstempelet. Settes automatisk til en nøytral
     variant så lenge "100 % kylling" ikke er bekreftet.                        */
  rentKjott: {
    bekreftet: false,
    tekst: '100 % kylling*',
    note: '* pluss krydderet som gjør at den faktisk smaker godt.',
    reserve: 'Kylling. Og krydder.',
    reserveNote: 'Det er hele lista. Full ingrediensdeklarasjon publiseres når resepten er låst.'
  },

  /* ---------------------------------------------------------------------------
     4. SMAKENE
     smaksnoter  = smakskomponenter fra briefen. Vises på siden.
     ingredienser = juridisk ingrediensdeklarasjon. IKKE bekreftet ennå.
     --------------------------------------------------------------------------- */
  smaker: {
    'brown-sugar-paprika': {
      navn: 'Brown Sugar Paprika',
      smaksnoter: ['Brunt sukker', 'Paprika', 'Oregano', 'Hvitløk', 'Sort pepper'],
      ingredienser: {
        /* Hentet fra teksten på pakkedesignet. Selve deklarasjonen med mengder,
           allergener og saltinnhold må bekreftes mot endelig resept.            */
        bekreftet: false,
        base: 'Kyllingfilet',
        tekst: 'Kyllingfilet, brunt sukker, paprika, tørket oregano, hvitløkspulver, salt, sort pepper.',
        notat: 'Står slik på pakkedesignet. Mangler mengdeangivelser, allergenmerking og saltinnhold fra endelig resept.'
      }
    },
    'smoky-chili-lime': {
      navn: 'Smoky Chili Lime',
      smaksnoter: ['Røkt chili', 'Lime'],
      ingredienser: {
        bekreftet: false,
        base: 'Kyllingfilet',
        tekst: 'Kyllingfilet, røkt chili, lime.',
        notat: 'Står slik på pakkedesignet. Mangler mengdeangivelser, allergenmerking og saltinnhold fra endelig resept.'
      }
    },
    'sitron-og-urter': {
      navn: 'Sitron & Urter',
      smaksnoter: ['Sitron', 'Urter'],
      ingredienser: {
        bekreftet: false,
        base: 'Kyllingfilet',
        tekst: 'Kyllingfilet, sitron, urter.',
        notat: 'Denne pakken har ingen ingrediensliste trykket på seg, i motsetning til de to andre. Hvilke urter som inngår må fastsettes og skrives ut før publisering.'
      }
    }
  }
};
