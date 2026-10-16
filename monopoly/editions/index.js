/* Monopoly editions: the catalogue list (id, name, maker, country, year, era group, file). Written by
   BG_audit/sprint/monoeditions/build-editions.js from the edition files; the files themselves load on demand (monopoly/edition.js). */
self.MONO_EDITION_LIST = [
 {
  "id": "parker-1935",
  "name": "Parker Brothers 1935 (first edition)",
  "officialName": "Monopoly",
  "maker": "Parker Brothers",
  "country": "US",
  "countryName": "United States",
  "year": 1935,
  "years": "1935",
  "era": "first",
  "group": "The first edition · United States",
  "eraOrder": 1,
  "status": "PARTLY INFERRED",
  "inferred": [
   "the Luxury Tax amount",
   "the starting-note split",
   "the printed street names"
  ],
  "file": "editions/parker-1935.js",
  "facts": "$200 salary · Income Tax 10% or $300 · Luxury Tax $75 · 8 tokens (2 added)"
 },
 {
  "id": "uk-1936",
  "name": "London (Waddingtons, 1936-2007)",
  "officialName": "Monopoly",
  "maker": "John Waddington Ltd (Waddingtons)",
  "country": "GB",
  "countryName": "United Kingdom",
  "year": 1936,
  "years": "1936-2007",
  "era": "classic",
  "group": "Classic editions · United Kingdom",
  "eraOrder": 2,
  "status": "VERIFIED",
  "inferred": [],
  "file": "editions/uk-1936.js",
  "facts": "£200 salary · Income Tax £200 · Super Tax £100 · 8 tokens (2 added)"
 },
 {
  "id": "classic-us-1936",
  "name": "Classic US (1936-2007)",
  "officialName": "Monopoly",
  "maker": "Parker Brothers",
  "country": "US",
  "countryName": "United States",
  "year": 1936,
  "years": "1936-2007",
  "era": "classic",
  "group": "Classic editions · United States",
  "eraOrder": 2,
  "status": "VERIFIED",
  "inferred": [],
  "file": "editions/classic-us-1936.js",
  "facts": "$200 salary · Income Tax 10% or $200 · Luxury Tax $75 · 10 tokens"
 },
 {
  "id": "uk-2008",
  "name": "London (2008 update)",
  "officialName": "Monopoly",
  "maker": "Parker Brothers / Hasbro",
  "country": "GB",
  "countryName": "United Kingdom",
  "year": 2008,
  "years": "2008-2020",
  "era": "modern",
  "group": "Modern editions · United Kingdom",
  "eraOrder": 3,
  "status": "PARTLY INFERRED",
  "inferred": [
   "the card texts",
   "a printed colour name"
  ],
  "file": "editions/uk-2008.js",
  "facts": "£200 salary · Income Tax £200 · Super Tax £100 · 8 tokens"
 },
 {
  "id": "classic-us-2008",
  "name": "Classic US (2008 update)",
  "officialName": "Monopoly",
  "maker": "Parker Brothers / Hasbro",
  "country": "US",
  "countryName": "United States",
  "year": 2008,
  "years": "2008-2020",
  "era": "modern",
  "group": "Modern editions · United States",
  "eraOrder": 3,
  "status": "VERIFIED",
  "inferred": [],
  "file": "editions/classic-us-2008.js",
  "facts": "$200 salary · Income Tax $200 · Luxury Tax $100 · 8 tokens"
 }
];
