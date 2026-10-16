/* Monopoly edition data: London (Waddingtons, 1936-2007). Plain data only (no code). Copied from part 1's research file by BG_audit/sprint/monoeditions/build-editions.js;
   format: BG_audit/games/monopoly/editions/FORMAT.md */
(self.MONO_EDITIONS = self.MONO_EDITIONS || {})["uk-1936"] = {
 "format": 1,
 "id": "uk-1936",
 "name": "London (Waddingtons, 1936-2007)",
 "officialName": "Monopoly",
 "maker": "John Waddington Ltd (Waddingtons)",
 "country": "GB",
 "countryName": "United Kingdom",
 "year": 1936,
 "years": "1936-2007",
 "language": "en-GB",
 "era": "classic",
 "ruleset": "monopoly",
 "status": "VERIFIED",
 "inferred": [],
 "currency": {
  "symbol": "£",
  "position": "before",
  "space": false,
  "code": "GBP",
  "word": {
   "one": "pound",
   "many": "pounds"
  }
 },
 "money": {
  "salary": 200,
  "startingCash": 1500,
  "notes": [
   1,
   5,
   10,
   20,
   50,
   100,
   500
  ],
  "jailFine": 50,
  "houses": 32,
  "hotels": 12
 },
 "moneyNote": "Waddingtons notes: £1, 5, 10, 20, 50, 100, 500 (WoM). The starting split of £1500 is not documented in the sources found.",
 "groups": {
  "brown": {
   "name": "Brown",
   "printed": "brown",
   "hex": "#8b5a2b"
  },
  "light_blue": {
   "name": "Light Blue",
   "printed": "light blue",
   "hex": "#9fd0ef"
  },
  "pink": {
   "name": "Pink",
   "printed": "pink / purple (sources name it differently)",
   "hex": "#c0479a"
  },
  "orange": {
   "name": "Orange",
   "printed": "orange",
   "hex": "#f08d1c"
  },
  "red": {
   "name": "Red",
   "printed": "red",
   "hex": "#e23b3b"
  },
  "yellow": {
   "name": "Yellow",
   "printed": "yellow",
   "hex": "#f3d41b"
  },
  "green": {
   "name": "Green",
   "printed": "green",
   "hex": "#1f9d54"
  },
  "dark_blue": {
   "name": "Dark Blue",
   "printed": "dark blue",
   "hex": "#2b4fe0"
  }
 },
 "railroad": {
  "word": "Station",
  "rent": [
   25,
   50,
   100,
   200
  ]
 },
 "utility": {
  "mult": [
   4,
   10
  ]
 },
 "spaces": [
  {
   "n": "GO",
   "t": "go"
  },
  {
   "n": "Old Kent Road",
   "t": "prop",
   "g": "brown",
   "price": 60,
   "rent": [
    2,
    10,
    30,
    90,
    160,
    250
   ],
   "house": 50,
   "mort": 30
  },
  {
   "n": "Community Chest",
   "t": "cc"
  },
  {
   "n": "Whitechapel Road",
   "t": "prop",
   "g": "brown",
   "price": 60,
   "rent": [
    4,
    20,
    60,
    180,
    320,
    450
   ],
   "house": 50,
   "mort": 30
  },
  {
   "n": "Income Tax",
   "t": "tax",
   "tax": "income",
   "amount": 200
  },
  {
   "n": "King's Cross Station",
   "t": "rr",
   "price": 200,
   "mort": 100
  },
  {
   "n": "The Angel Islington",
   "t": "prop",
   "g": "light_blue",
   "price": 100,
   "rent": [
    6,
    30,
    90,
    270,
    400,
    550
   ],
   "house": 50,
   "mort": 50
  },
  {
   "n": "Chance",
   "t": "chance"
  },
  {
   "n": "Euston Road",
   "t": "prop",
   "g": "light_blue",
   "price": 100,
   "rent": [
    6,
    30,
    90,
    270,
    400,
    550
   ],
   "house": 50,
   "mort": 50
  },
  {
   "n": "Pentonville Road",
   "t": "prop",
   "g": "light_blue",
   "price": 120,
   "rent": [
    8,
    40,
    100,
    300,
    450,
    600
   ],
   "house": 50,
   "mort": 60
  },
  {
   "n": "Jail / Just Visiting",
   "t": "jail",
   "printed": "IN JAIL / JUST VISITING"
  },
  {
   "n": "Pall Mall",
   "t": "prop",
   "g": "pink",
   "price": 140,
   "rent": [
    10,
    50,
    150,
    450,
    625,
    750
   ],
   "house": 100,
   "mort": 70
  },
  {
   "n": "Electric Company",
   "t": "util",
   "price": 150,
   "mort": 75
  },
  {
   "n": "Whitehall",
   "t": "prop",
   "g": "pink",
   "price": 140,
   "rent": [
    10,
    50,
    150,
    450,
    625,
    750
   ],
   "house": 100,
   "mort": 70
  },
  {
   "n": "Northumberland Avenue",
   "t": "prop",
   "g": "pink",
   "price": 160,
   "rent": [
    12,
    60,
    180,
    500,
    700,
    900
   ],
   "house": 100,
   "mort": 80
  },
  {
   "n": "Marylebone Station",
   "t": "rr",
   "price": 200,
   "mort": 100
  },
  {
   "n": "Bow Street",
   "t": "prop",
   "g": "orange",
   "price": 180,
   "rent": [
    14,
    70,
    200,
    550,
    750,
    950
   ],
   "house": 100,
   "mort": 90
  },
  {
   "n": "Community Chest",
   "t": "cc"
  },
  {
   "n": "Marlborough Street",
   "t": "prop",
   "g": "orange",
   "price": 180,
   "rent": [
    14,
    70,
    200,
    550,
    750,
    950
   ],
   "house": 100,
   "mort": 90
  },
  {
   "n": "Vine Street",
   "t": "prop",
   "g": "orange",
   "price": 200,
   "rent": [
    16,
    80,
    220,
    600,
    800,
    1000
   ],
   "house": 100,
   "mort": 100
  },
  {
   "n": "Free Parking",
   "t": "fp"
  },
  {
   "n": "Strand",
   "t": "prop",
   "g": "red",
   "price": 220,
   "rent": [
    18,
    90,
    250,
    700,
    875,
    1050
   ],
   "house": 150,
   "mort": 110
  },
  {
   "n": "Chance",
   "t": "chance"
  },
  {
   "n": "Fleet Street",
   "t": "prop",
   "g": "red",
   "price": 220,
   "rent": [
    18,
    90,
    250,
    700,
    875,
    1050
   ],
   "house": 150,
   "mort": 110
  },
  {
   "n": "Trafalgar Square",
   "t": "prop",
   "g": "red",
   "price": 240,
   "rent": [
    20,
    100,
    300,
    750,
    925,
    1100
   ],
   "house": 150,
   "mort": 120
  },
  {
   "n": "Fenchurch St. Station",
   "t": "rr",
   "price": 200,
   "mort": 100
  },
  {
   "n": "Leicester Square",
   "t": "prop",
   "g": "yellow",
   "price": 260,
   "rent": [
    22,
    110,
    330,
    800,
    975,
    1150
   ],
   "house": 150,
   "mort": 130
  },
  {
   "n": "Coventry Street",
   "t": "prop",
   "g": "yellow",
   "price": 260,
   "rent": [
    22,
    110,
    330,
    800,
    975,
    1150
   ],
   "house": 150,
   "mort": 130
  },
  {
   "n": "Water Works",
   "t": "util",
   "price": 150,
   "mort": 75
  },
  {
   "n": "Piccadilly",
   "t": "prop",
   "g": "yellow",
   "price": 280,
   "rent": [
    22,
    120,
    360,
    850,
    1025,
    1200
   ],
   "house": 150,
   "mort": 140
  },
  {
   "n": "Go To Jail",
   "t": "gotojail"
  },
  {
   "n": "Regent Street",
   "t": "prop",
   "g": "green",
   "price": 300,
   "rent": [
    26,
    130,
    390,
    900,
    1100,
    1275
   ],
   "house": 200,
   "mort": 150
  },
  {
   "n": "Oxford Street",
   "t": "prop",
   "g": "green",
   "price": 300,
   "rent": [
    26,
    130,
    390,
    900,
    1100,
    1275
   ],
   "house": 200,
   "mort": 150
  },
  {
   "n": "Community Chest",
   "t": "cc"
  },
  {
   "n": "Bond Street",
   "t": "prop",
   "g": "green",
   "price": 320,
   "rent": [
    28,
    150,
    450,
    1000,
    1200,
    1400
   ],
   "house": 200,
   "mort": 160
  },
  {
   "n": "Liverpool St. Station",
   "t": "rr",
   "price": 200,
   "mort": 100
  },
  {
   "n": "Chance",
   "t": "chance"
  },
  {
   "n": "Park Lane",
   "t": "prop",
   "g": "dark_blue",
   "price": 350,
   "rent": [
    35,
    175,
    500,
    1100,
    1300,
    1500
   ],
   "house": 200,
   "mort": 175
  },
  {
   "n": "Super Tax",
   "t": "tax",
   "tax": "luxury",
   "amount": 100
  },
  {
   "n": "Mayfair",
   "t": "prop",
   "g": "dark_blue",
   "price": 400,
   "rent": [
    50,
    200,
    600,
    1400,
    1700,
    2000
   ],
   "house": 200,
   "mort": 200
  }
 ],
 "deckNames": {
  "chance": "Chance",
  "chest": "Community Chest"
 },
 "cardsNote": "Traditional London deck: text from a full 2008 transcription (jumbloid) and checked against a photo of a 1937-39 set (Rich Uncle Pennybags); the photo reads 'Your building and loan matures - receive £150'. Card amounts are the same in both.",
 "chance": [
  {
   "text": "Advance to \"Go\".",
   "fx": "move",
   "a": 0
  },
  {
   "text": "Go to jail. Move directly to jail. Do not pass \"Go\". Do not collect £200.",
   "fx": "jail"
  },
  {
   "text": "Advance to Pall Mall. If you pass \"Go\" collect £200.",
   "fx": "move",
   "a": 11
  },
  {
   "text": "Take a trip to Marylebone Station and if you pass \"Go\" collect £200.",
   "fx": "move",
   "a": 15
  },
  {
   "text": "Advance to Trafalgar Square. If you pass \"Go\" collect £200.",
   "fx": "move",
   "a": 24
  },
  {
   "text": "Advance to Mayfair.",
   "fx": "move",
   "a": 39
  },
  {
   "text": "Go back three spaces.",
   "fx": "back3"
  },
  {
   "text": "Make general repairs on all of your houses. For each house pay £25. For each hotel pay £100.",
   "fx": "repairs",
   "a": [
    25,
    100
   ]
  },
  {
   "text": "You are assessed for street repairs: £40 per house, £115 per hotel.",
   "fx": "repairs",
   "a": [
    40,
    115
   ]
  },
  {
   "text": "Pay school fees of £150.",
   "fx": "pay",
   "a": 150
  },
  {
   "text": "\"Drunk in charge\" fine £20.",
   "fx": "pay",
   "a": 20
  },
  {
   "text": "Speeding fine £15.",
   "fx": "pay",
   "a": 15
  },
  {
   "text": "Your building loan matures. Receive £150.",
   "fx": "gain",
   "a": 150
  },
  {
   "text": "You have won a crossword competition. Collect £100.",
   "fx": "gain",
   "a": 100
  },
  {
   "text": "Bank pays you dividend of £50.",
   "fx": "gain",
   "a": 50
  },
  {
   "text": "Get out of jail free. This card may be kept until needed or sold.",
   "fx": "joker"
  }
 ],
 "chest": [
  {
   "text": "Advance to \"Go\".",
   "fx": "move",
   "a": 0
  },
  {
   "text": "Go back to Old Kent Road.",
   "fx": "moveBack",
   "a": 1
  },
  {
   "text": "Go to jail. Move directly to jail. Do not pass \"Go\". Do not collect £200.",
   "fx": "jail"
  },
  {
   "text": "Pay hospital £100.",
   "fx": "pay",
   "a": 100
  },
  {
   "text": "Doctor's fee. Pay £50.",
   "fx": "pay",
   "a": 50
  },
  {
   "text": "Pay your insurance premium £50.",
   "fx": "pay",
   "a": 50
  },
  {
   "text": "Bank error in your favour. Collect £200.",
   "fx": "gain",
   "a": 200
  },
  {
   "text": "Annuity matures. Collect £100.",
   "fx": "gain",
   "a": 100
  },
  {
   "text": "You inherit £100.",
   "fx": "gain",
   "a": 100
  },
  {
   "text": "From sale of stock you get £50.",
   "fx": "gain",
   "a": 50
  },
  {
   "text": "Receive interest on 7% preference shares: £25.",
   "fx": "gain",
   "a": 25
  },
  {
   "text": "Income tax refund. Collect £20.",
   "fx": "gain",
   "a": 20
  },
  {
   "text": "You have won second prize in a beauty contest. Collect £10.",
   "fx": "gain",
   "a": 10
  },
  {
   "text": "It is your birthday. Collect £10 from each player.",
   "fx": "collecteach",
   "a": 10
  },
  {
   "text": "Get out of jail free. This card may be kept until needed or sold.",
   "fx": "joker"
  },
  {
   "text": "Pay a £10 fine or take a \"Chance\".",
   "fx": "fineOrChance",
   "a": 10
  }
 ],
 "tokens": [
  {
   "id": "top-hat",
   "name": "Top Hat",
   "what": "a tall silk top hat with a band",
   "emoji": "🎩"
  },
  {
   "id": "iron",
   "name": "Iron",
   "what": "an old flat iron (sad iron) with a handle"
  },
  {
   "id": "car-1935",
   "name": "Car",
   "what": "a 1930s roadster (the first car token, before the race car)"
  },
  {
   "id": "battleship",
   "name": "Battleship",
   "what": "a grey battleship with gun turrets, side view",
   "emoji": "🚢"
  },
  {
   "id": "shoe",
   "name": "Shoe",
   "what": "a laced ankle boot (the 1930s 'shoe' token)"
  },
  {
   "id": "thimble",
   "name": "Thimble",
   "what": "a sewing thimble with a dimpled surface",
   "emoji": "🧵"
  },
  {
   "id": "lantern",
   "name": "Lantern",
   "what": "an old hand lantern with a ring handle",
   "added": "a 1930s object"
  },
  {
   "id": "purse",
   "name": "Purse",
   "what": "a clasp purse with a kiss-lock frame",
   "added": "a 1930s object"
  }
 ],
 "tokensNote": "1936: six metal tokens - hat, iron, car, boat, shoe, thimble (WoM UK 1936).",
 "rules": {},
 "ruleNotes": [
  "Income Tax is a flat £200 (no 10% option on UK boards); the luxury space is Super Tax £100."
 ],
 "variants": [
  {
   "id": "uk-tokens-1957",
   "name": "1957-1993 long red box tokens",
   "years": "1957-1993",
   "tokens": [
    {
     "id": "battleship",
     "name": "Battleship",
     "what": "a grey battleship with gun turrets, side view",
     "emoji": "🚢"
    },
    {
     "id": "shoe",
     "name": "Shoe",
     "what": "a laced ankle boot (the 1930s 'shoe' token)"
    },
    {
     "id": "race-car",
     "name": "Race Car",
     "what": "a 1930s open-wheel racing car, side view",
     "emoji": "🏎️"
    },
    {
     "id": "top-hat",
     "name": "Top Hat",
     "what": "a tall silk top hat with a band",
     "emoji": "🎩"
    },
    {
     "id": "scottie-dog",
     "name": "Scottie Dog",
     "what": "a Scottish terrier standing, side view",
     "emoji": "🐕"
    },
    {
     "id": "iron",
     "name": "Iron",
     "what": "an old flat iron (sad iron) with a handle"
    }
   ],
   "src": [
    "wom-uk-1984"
   ]
  },
  {
   "id": "uk-tokens-1995",
   "name": "1995-2007 ten pewter tokens",
   "years": "1995-2007",
   "tokens": [
    {
     "id": "top-hat",
     "name": "Top Hat",
     "what": "a tall silk top hat with a band",
     "emoji": "🎩"
    },
    {
     "id": "shoe",
     "name": "Shoe",
     "what": "a laced ankle boot (the 1930s 'shoe' token)"
    },
    {
     "id": "race-car",
     "name": "Race Car",
     "what": "a 1930s open-wheel racing car, side view",
     "emoji": "🏎️"
    },
    {
     "id": "battleship",
     "name": "Battleship",
     "what": "a grey battleship with gun turrets, side view",
     "emoji": "🚢"
    },
    {
     "id": "scottie-dog",
     "name": "Scottie Dog",
     "what": "a Scottish terrier standing, side view",
     "emoji": "🐕"
    },
    {
     "id": "wheelbarrow",
     "name": "Wheelbarrow",
     "what": "a one-wheeled garden wheelbarrow",
     "emoji": "🛒"
    },
    {
     "id": "horse-rider",
     "name": "Horse & Rider",
     "what": "a rider on a rearing horse",
     "emoji": "🐎"
    },
    {
     "id": "thimble",
     "name": "Thimble",
     "what": "a sewing thimble with a dimpled surface",
     "emoji": "🧵"
    },
    {
     "id": "iron",
     "name": "Iron",
     "what": "an old flat iron (sad iron) with a handle"
    },
    {
     "id": "cannon",
     "name": "Cannon",
     "what": "a short field cannon on two wheels"
    }
   ],
   "src": [
    "wom-uk-1996"
   ]
  },
  {
   "id": "uk-picc-24",
   "name": "Later printings with Piccadilly rent £24 and 'The Strand' (1993)",
   "years": "date disputed (WoM: 'about 1961' and 'still £22 in 1984-1987 sets')",
   "set": {
    "spaces.29.rent.0": 24,
    "spaces.21.n": "The Strand"
   },
   "src": [
    "wom-uk-1936",
    "wom-uk-1984",
    "wom-uk-history"
   ]
  }
 ],
 "sources": [
  {
   "id": "rup-1937",
   "title": "Rich Uncle Pennybags (UK collector): 1937-1939 set - photos of all 28 deeds and all 32 cards",
   "url": "https://richunclepennybags.co.uk/1937-1939-pre-war-era"
  },
  {
   "id": "jumbloid-2008",
   "title": "Odds and Ends blog (June 2008): full transcription of the traditional London cards",
   "url": "http://jumbloid.blogspot.com/2008/06/monopoly-cards.html"
  },
  {
   "id": "wiki-cards",
   "title": "Wikipedia (2010 mirror): Chance and Community Chest cards - US changes and UK-only cards",
   "url": "https://en-academic.com/dic.nsf/enwiki/7021822"
  },
  {
   "id": "wom-uk-history",
   "title": "World of Monopoly: UK condensed history (London streets, flat income tax, £100 Super Tax, Strand -> The Strand 1993)",
   "url": "https://www.worldofmonopoly.com/europe/uk/gamehistory/ukhistory.php"
  },
  {
   "id": "wom-uk-1936",
   "title": "World of Monopoly: UK classic 1936 (6 metal tokens; Piccadilly rent £22; L.N.E.R. stations)",
   "url": "https://www.worldofmonopoly.com/europe/uk/country/classic/1936.php"
  },
  {
   "id": "wom-uk-1984",
   "title": "World of Monopoly: UK 1984-1995 (Piccadilly still £22; 6 tokens incl. dog)",
   "url": "https://www.worldofmonopoly.com/europe/uk/country/classic/1984.php"
  },
  {
   "id": "wom-uk-1996",
   "title": "World of Monopoly: UK 1996-2006 (10 tokens)",
   "url": "https://www.worldofmonopoly.com/europe/uk/country/classic/1996.php"
  },
  {
   "id": "fandom-uk",
   "title": "Monopoly Wiki: Monopoly (UK) board table",
   "url": "https://monopoly.fandom.com/wiki/Monopoly_(UK)"
  },
  {
   "id": "fandom-chance",
   "title": "Monopoly Wiki: Chance (current text with older US and UK differences)",
   "url": "https://monopoly.fandom.com/wiki/Chance"
  }
 ],
 "sourceMap": {
  "board": [
   "fandom-uk",
   "rup-1937",
   "wom-uk-1936"
  ],
  "taxes": [
   "wom-uk-history",
   "fandom-uk"
  ],
  "chance": [
   "jumbloid-2008",
   "rup-1937",
   "wiki-cards"
  ],
  "chest": [
   "jumbloid-2008",
   "rup-1937",
   "wiki-cards"
  ],
  "tokens": [
   "wom-uk-1936",
   "wom-uk-1984"
  ],
  "money": [
   "wom-uk-1936"
  ]
 },
 "tokensAddedNote": "The box held 6 tokens; the game seats 8, so lantern and purse were added (a 1930s object)."
};
