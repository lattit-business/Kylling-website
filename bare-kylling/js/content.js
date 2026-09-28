/* =============================================================================
   BARE KYLLING — INNHOLDSDATA
   -----------------------------------------------------------------------------
   Dette er den ENESTE filen du trenger å redigere for å endre ingredienser,
   næringstall, allergener, opprinnelse og CTA-tekster.

   VIKTIG OM PÅSTANDER
   Alt som har "bekreftet: false" er IKKE verifisert og vises derfor ikke på den
   publiserte siden. I stedet står det en tydelig plassholder («Oppgis etter
   næringsanalyse» o.l.). Når config.devModus = true vises i tillegg den
   ubekreftede verdien i en stiplet boks, slik at dere ser hva som gjenstår.

   Slik gjør du et tall/en opplysning offentlig:
     1. Skaff dokumentasjon (næringsanalyse, resept, leverandøravtale).
     2. Fyll inn verdien og sett "bekreftet: true" på den aktuelle oppføringen.
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
    ventelisteEndepunkt: 'https://formspree.io/f/xgaveyzd',

    /* Ekte e-postadresse. Så lenge denne er null vises ingen e-postlenke, og
       siden finner ikke på en adresse. Fyll inn når dere har en.               */
    kontaktEpost: null,

    /* Ekte profil-/kontaktlenker. null = vises som «kommer», ikke som lenke.   */
    lenker: {
      instagram: null,
      kontakt: null
    },

    /* Sett til true når produktet er i salg. Da bytter alle hoved-CTA-er til
       teksten i cta.medButikk. Nettsiden har ingen handlekurv – lenken bør gå
       til en side som forteller hvor produktet selges.                        */
    butikkAktiv: false,
    cta: {
      medButikk: { tekst: 'Se hvor du får kjøpt den', href: 'faq.html#kjop' },
      utenButikk: { tekst: 'Få beskjed ved lansering', href: 'venteliste.html' }
    }
  },

  /* ---------------------------------------------------------------------------
     2. NØKKELTALL I HEROEN — IKKE BEKREFTET
     Tallene under står på pakkedesignet, men er ikke dokumentert gjennom
     næringsanalyse. Heroen viser derfor plassholdere til bekreftet: true.
     Tallene gjelder én hel pakke (200 g). Avviker smakene, skriv et spenn,
     f.eks. '36–38'.
     «0 min tilberedning» og «200 g» står fast i HTML-en, fordi det følger av
     at kyllingen er ferdigstekt og av pakkestørrelsen.
     --------------------------------------------------------------------------- */
  nokkeltall: {
    bekreftet: false,
    kilde: 'Trykket på pakkedesignet. Mangler dokumentert næringsanalyse fra laboratorium.',
    protein: { verdi: '36',  enhet: 'g'    },
    energi:  { verdi: '185', enhet: 'kcal' }
  },

  /* ---------------------------------------------------------------------------
     3. MERKER OG PÅSTANDER — IKKE BEKREFTET
     Står på pakkedesignet. "Nyt Norge" krever avtale med Matmerk. De øvrige
     krever dokumentert resept og produksjonsprosess.
     --------------------------------------------------------------------------- */
  merker: [
    { navn: '100 % kylling',           bekreftet: false, krever: 'Dokumentert resept og kjøttinnhold' },
    { navn: 'Ingen tilsatt vann',      bekreftet: false, krever: 'Dokumentert produksjonsprosess'     },
    { navn: 'Uten tilsetningsstoffer', bekreftet: false, krever: 'Full ingrediensdeklarasjon'         },
    { navn: 'Nyt Norge',               bekreftet: false, krever: 'Godkjent avtale med Stiftelsen Matmerk' }
  ],

  /* Teksten i innholdsstempelet (hvorfor.html). Settes automatisk til en
     nøytral variant så lenge "100 % kylling" ikke er bekreftet.               */
  rentKjott: {
    bekreftet: false,
    tekst: '100 % kylling*',
    note: '* pluss krydderet som gjør at den faktisk smaker godt.',
    reserve: 'Kylling og krydder',
    reserveNote: 'Det er det som er i pakken. Mengder, salt og allergener kommer i den fullstendige deklarasjonen.'
  },

  /* ---------------------------------------------------------------------------
     4. OPPRINNELSE, KVALITET, HOLDBARHET OG OPPBEVARING — IKKE BEKREFTET
     tekst = det som skal stå på siden når opplysningen er bekreftet.
     --------------------------------------------------------------------------- */
  opprinnelse: {
    bekreftet: false,
    tekst: null,            /* f.eks. 'Kyllingen kommer fra … i …' */
    krever: 'Avtale med kyllingleverandør, med opprinnelsesland'
  },
  kvalitetskontroll: {
    bekreftet: false,
    tekst: null,
    krever: 'Beskrivelse av produksjonssted, internkontroll og eventuelle sertifiseringer'
  },
  holdbarhet: {
    bekreftet: false,
    tekst: null,            /* f.eks. 'Uåpnet: … dager. Åpnet: spises innen …' */
    krever: 'Holdbarhetstest fra produksjonen'
  },
  oppbevaring: {
    bekreftet: false,
    tekst: null,            /* f.eks. 'Oppbevares kjølig, 0–4 °C.' */
    krever: 'Fastsatt oppbevaringsanvisning fra produksjonen'
  },

  /* ---------------------------------------------------------------------------
     5. SMAKENE
     smaksnoter   = smakskomponenter. Vises på siden.
     ingredienser = juridisk ingrediensdeklarasjon. IKKE bekreftet ennå.
     allergener   = allergener som skal utheves. IKKE bekreftet ennå.
     naering      = næringsdeklarasjon per 100 g. IKKE bekreftet ennå.
                    Per pakke regnes ut automatisk fra pakkevekten (200 g).
     --------------------------------------------------------------------------- */
  pakkevekt: 200,

  smaker: {
    'original': {
      navn: 'Original',
      smaksnoter: ['Salt', 'Pepper', 'Urter'],
      ingredienser: {
        bekreftet: false,
        base: 'Kyllingfilet',
        tekst: null,
        notat: 'Fullt navn: «Original – Salt, Pepper & Urter». Hvilke urter som inngår, og ingrediensliste med mengder, må fastsettes.'
      },
      allergener: {
        bekreftet: false,
        tekst: null,
        notat: 'Allergener fastsettes ut fra endelig resept og krydderleverandørens spesifikasjon.'
      },
      naering: {
        bekreftet: false,
        per100: { energiKj: null, energiKcal: null, fett: null, mettet: null, karbohydrat: null, sukkerarter: null, protein: null, salt: null }
      }
    },
    'sweet-paprika': {
      navn: 'Sweet Paprika',
      smaksnoter: ['Søt paprika'],
      ingredienser: {
        bekreftet: false,
        base: 'Kyllingfilet',
        tekst: null,
        notat: 'Pakkedesignet på bildene heter bare «Paprika», mens produktnavnet er «Sweet Paprika». Ingrediensliste med mengder må fastsettes.'
      },
      allergener: {
        bekreftet: false,
        tekst: null,
        notat: 'Allergener fastsettes ut fra endelig resept og krydderleverandørens spesifikasjon.'
      },
      naering: {
        bekreftet: false,
        per100: { energiKj: null, energiKcal: null, fett: null, mettet: null, karbohydrat: null, sukkerarter: null, protein: null, salt: null }
      }
    }
  }
};
