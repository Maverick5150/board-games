/* Monopoly edition data: London (2008 update). Plain data only (no code). Copied from part 1's research file by BG_audit/sprint/monoeditions/build-editions.js;
   format: BG_audit/games/monopoly/editions/FORMAT.md */
(self.MONO_EDITIONS = self.MONO_EDITIONS || {})["uk-2008"] = {
 "format": 1,
 "id": "uk-2008",
 "name": "London (2008 update)",
 "officialName": "Monopoly",
 "maker": "Parker Brothers / Hasbro",
 "country": "GB",
 "countryName": "United Kingdom",
 "year": 2008,
 "years": "2008-2020",
 "language": "en-GB",
 "era": "modern",
 "ruleset": "monopoly",
 "status": "PARTLY INFERRED",
 "inferred": [
  {
   "field": "chance, chest",
   "why": "Card texts come from two secondary lists (Monopoly Wiki brackets; monopolyland 2008-2021 UK list). No photo of the 2008 UK cards was found; the US 2008 deck they mirror is photo-checked."
  },
  {
   "field": "groups.pink.printed",
   "why": "Printed colour names are approximations."
  }
 ],
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
   "n": "The Strand",
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
    24,
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
 "cardsNote": "Worldwide standard deck of 2008 with London names (same effects and amounts as classic-us-2008).",
 "chance": [
  {
   "text": "Advance to Mayfair.",
   "fx": "move",
   "a": 39
  },
  {
   "text": "Advance to Go (Collect £200).",
   "fx": "move",
   "a": 0
  },
  {
   "text": "Advance to Trafalgar Square. If you pass Go, collect £200.",
   "fx": "move",
   "a": 24
  },
  {
   "text": "Advance to Pall Mall. If you pass Go, collect £200.",
   "fx": "move",
   "a": 11
  },
  {
   "text": "Advance to the nearest Station. If unowned, you may buy it from the Bank. If owned, pay owner twice the rental to which they are otherwise entitled.",
   "fx": "nearRR"
  },
  {
   "text": "Advance to the nearest Station. If unowned, you may buy it from the Bank. If owned, pay owner twice the rental to which they are otherwise entitled.",
   "fx": "nearRR"
  },
  {
   "text": "Advance token to nearest Utility. If unowned, you may buy it from the Bank. If owned, throw dice and pay owner a total ten times amount thrown.",
   "fx": "nearUtil"
  },
  {
   "text": "Bank pays you dividend of £50.",
   "fx": "gain",
   "a": 50
  },
  {
   "text": "Get Out of Jail Free.",
   "fx": "joker"
  },
  {
   "text": "Go Back 3 Spaces.",
   "fx": "back3"
  },
  {
   "text": "Go to Jail. Go directly to Jail, do not pass Go, do not collect £200.",
   "fx": "jail"
  },
  {
   "text": "Make general repairs on all your property. For each house pay £25. For each hotel pay £100.",
   "fx": "repairs",
   "a": [
    25,
    100
   ]
  },
  {
   "text": "Speeding fine £15.",
   "fx": "pay",
   "a": 15
  },
  {
   "text": "Take a trip to Kings Cross Station. If you pass Go, collect £200.",
   "fx": "move",
   "a": 5
  },
  {
   "text": "You have been elected Chairman of the Board. Pay each player £50.",
   "fx": "payeach",
   "a": 50
  },
  {
   "text": "Your building loan matures. Collect £150.",
   "fx": "gain",
   "a": 150
  }
 ],
 "chest": [
  {
   "text": "Advance to Go (Collect £200).",
   "fx": "move",
   "a": 0
  },
  {
   "text": "Bank error in your favour. Collect £200.",
   "fx": "gain",
   "a": 200
  },
  {
   "text": "Doctor's fee. Pay £50.",
   "fx": "pay",
   "a": 50
  },
  {
   "text": "From sale of stock you get £50.",
   "fx": "gain",
   "a": 50
  },
  {
   "text": "Get Out of Jail Free.",
   "fx": "joker"
  },
  {
   "text": "Go to Jail. Go directly to jail, do not pass Go, do not collect £200.",
   "fx": "jail"
  },
  {
   "text": "Holiday fund matures. Receive £100.",
   "fx": "gain",
   "a": 100
  },
  {
   "text": "Income tax refund. Collect £20.",
   "fx": "gain",
   "a": 20
  },
  {
   "text": "It is your birthday. Collect £10 from every player.",
   "fx": "collecteach",
   "a": 10
  },
  {
   "text": "Life insurance matures. Collect £100.",
   "fx": "gain",
   "a": 100
  },
  {
   "text": "Pay hospital fees of £100.",
   "fx": "pay",
   "a": 100
  },
  {
   "text": "Pay school fees of £50.",
   "fx": "pay",
   "a": 50
  },
  {
   "text": "Receive £25 consultancy fee.",
   "fx": "gain",
   "a": 25
  },
  {
   "text": "You are assessed for street repairs. £40 per house. £115 per hotel.",
   "fx": "repairs",
   "a": [
    40,
    115
   ]
  },
  {
   "text": "You have won second prize in a beauty contest. Collect £10.",
   "fx": "gain",
   "a": 10
  },
  {
   "text": "You inherit £100.",
   "fx": "gain",
   "a": 100
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
   "id": "race-car",
   "name": "Race Car",
   "what": "a 1930s open-wheel racing car, side view",
   "emoji": "🏎️"
  },
  {
   "id": "scottie-dog",
   "name": "Scottie Dog",
   "what": "a Scottish terrier standing, side view",
   "emoji": "🐕"
  },
  {
   "id": "battleship",
   "name": "Battleship",
   "what": "a grey battleship with gun turrets, side view",
   "emoji": "🚢"
  },
  {
   "id": "boot",
   "name": "Boot",
   "what": "a laced ankle boot / old shoe",
   "emoji": "👢"
  },
  {
   "id": "thimble",
   "name": "Thimble",
   "what": "a sewing thimble with a dimpled surface",
   "emoji": "🧵"
  },
  {
   "id": "wheelbarrow",
   "name": "Wheelbarrow",
   "what": "a one-wheeled garden wheelbarrow",
   "emoji": "🛒"
  },
  {
   "id": "iron",
   "name": "Iron",
   "what": "an old flat iron (sad iron) with a handle"
  }
 ],
 "tokensNote": "2008 standard 8 tokens (WoM: cat replaced the iron in 2013; the 2017 vote replaced thimble, wheelbarrow and boot).",
 "rules": {},
 "ruleNotes": [
  "Income Tax is a flat £200 (no 10% option on UK boards); the luxury space is Super Tax £100."
 ],
 "variants": [
  {
   "id": "uk-golden-2012",
   "name": "2012 'Golden Token Bonus' set (13 tokens)",
   "years": "2012-2013",
   "tokens": [
    {
     "id": "top-hat",
     "name": "Top Hat",
     "what": "a tall silk top hat with a band",
     "emoji": "🎩"
    },
    {
     "id": "race-car",
     "name": "Race Car",
     "what": "a 1930s open-wheel racing car, side view",
     "emoji": "🏎️"
    },
    {
     "id": "scottie-dog",
     "name": "Scottie Dog",
     "what": "a Scottish terrier standing, side view",
     "emoji": "🐕"
    },
    {
     "id": "battleship",
     "name": "Battleship",
     "what": "a grey battleship with gun turrets, side view",
     "emoji": "🚢"
    },
    {
     "id": "boot",
     "name": "Boot",
     "what": "a laced ankle boot / old shoe",
     "emoji": "👢"
    },
    {
     "id": "thimble",
     "name": "Thimble",
     "what": "a sewing thimble with a dimpled surface",
     "emoji": "🧵"
    },
    {
     "id": "wheelbarrow",
     "name": "Wheelbarrow",
     "what": "a one-wheeled garden wheelbarrow",
     "emoji": "🛒"
    },
    {
     "id": "iron",
     "name": "Iron",
     "what": "an old flat iron (sad iron) with a handle"
    },
    {
     "id": "cat",
     "name": "Cat",
     "what": "a sitting cat, side view"
    },
    {
     "id": "ring",
     "name": "Diamond Ring",
     "what": "a ring with a stone"
    },
    {
     "id": "robot",
     "name": "Robot",
     "what": "a toy robot"
    },
    {
     "id": "guitar",
     "name": "Guitar",
     "what": "a guitar"
    },
    {
     "id": "helicopter",
     "name": "Helicopter",
     "what": "a helicopter"
    }
   ],
   "src": [
    "wom-uk-2008"
   ]
  },
  {
   "id": "uk-tokens-2013",
   "name": "2013 cat replaces the iron",
   "years": "2013-2016",
   "tokens": [
    {
     "id": "top-hat",
     "name": "Top Hat",
     "what": "a tall silk top hat with a band",
     "emoji": "🎩"
    },
    {
     "id": "race-car",
     "name": "Race Car",
     "what": "a 1930s open-wheel racing car, side view",
     "emoji": "🏎️"
    },
    {
     "id": "scottie-dog",
     "name": "Scottie Dog",
     "what": "a Scottish terrier standing, side view",
     "emoji": "🐕"
    },
    {
     "id": "battleship",
     "name": "Battleship",
     "what": "a grey battleship with gun turrets, side view",
     "emoji": "🚢"
    },
    {
     "id": "boot",
     "name": "Boot",
     "what": "a laced ankle boot / old shoe",
     "emoji": "👢"
    },
    {
     "id": "thimble",
     "name": "Thimble",
     "what": "a sewing thimble with a dimpled surface",
     "emoji": "🧵"
    },
    {
     "id": "wheelbarrow",
     "name": "Wheelbarrow",
     "what": "a one-wheeled garden wheelbarrow",
     "emoji": "🛒"
    },
    {
     "id": "cat",
     "name": "Cat",
     "what": "a sitting cat, side view"
    }
   ],
   "src": [
    "wom-uk-2008"
   ]
  },
  {
   "id": "uk-tokens-2017",
   "name": "2017 token line-up",
   "years": "2017-",
   "tokens": [
    {
     "id": "top-hat",
     "name": "Top Hat",
     "what": "a tall silk top hat with a band",
     "emoji": "🎩"
    },
    {
     "id": "race-car",
     "name": "Race Car",
     "what": "a 1930s open-wheel racing car, side view",
     "emoji": "🏎️"
    },
    {
     "id": "scottie-dog",
     "name": "Scottie Dog",
     "what": "a Scottish terrier standing, side view",
     "emoji": "🐕"
    },
    {
     "id": "battleship",
     "name": "Battleship",
     "what": "a grey battleship with gun turrets, side view",
     "emoji": "🚢"
    },
    {
     "id": "cat",
     "name": "Cat",
     "what": "a sitting cat, side view"
    },
    {
     "id": "rubber-duck",
     "name": "Rubber Duck",
     "what": "a bath-time rubber duck"
    },
    {
     "id": "t-rex",
     "name": "T-Rex",
     "what": "a Tyrannosaurus rex standing"
    },
    {
     "id": "penguin",
     "name": "Penguin",
     "what": "a penguin wearing a scarf"
    }
   ],
   "src": [
    "wom-uk-2015"
   ]
  }
 ],
 "sources": [
  {
   "id": "cardlist-2008",
   "title": "Card list 2008-2021, US and UK (monopolyland.com list, mirrored at zpag.net)",
   "url": "https://www.zpag.net/Jeux/list_of_all_monopoly_Chance_Community_Chest.html"
  },
  {
   "id": "fandom-chance",
   "title": "Monopoly Wiki: Chance (current text with older US and UK differences)",
   "url": "https://monopoly.fandom.com/wiki/Chance"
  },
  {
   "id": "fandom-chest",
   "title": "Monopoly Wiki: Community Chest",
   "url": "https://monopoly.fandom.com/wiki/Community_Chest"
  },
  {
   "id": "wom-uk-history",
   "title": "World of Monopoly: UK condensed history (London streets, flat income tax, £100 Super Tax, Strand -> The Strand 1993)",
   "url": "https://www.worldofmonopoly.com/europe/uk/gamehistory/ukhistory.php"
  },
  {
   "id": "wom-uk-2008",
   "title": "World of Monopoly: UK 2008-2014 (new design; 2012 golden tokens; 2013 cat replaces iron)",
   "url": "https://www.worldofmonopoly.com/europe/uk/country/classic/2008.php"
  },
  {
   "id": "wom-uk-2015",
   "title": "World of Monopoly: UK 2015-2018 (2017 token line-up)",
   "url": "https://www.worldofmonopoly.com/europe/uk/country/classic/2015.php"
  },
  {
   "id": "fandom-uk",
   "title": "Monopoly Wiki: Monopoly (UK) board table",
   "url": "https://monopoly.fandom.com/wiki/Monopoly_(UK)"
  },
  {
   "id": "wom-cards-2008",
   "title": "World of Monopoly: Chance & Community Chest (USA) 2008 - photos of all 32 cards",
   "url": "https://www.worldofmonopoly.com/northamerica/usa/gamehistory/candcc-2008.php"
  }
 ],
 "sourceMap": {
  "board": [
   "fandom-uk",
   "wom-uk-history"
  ],
  "taxes": [
   "wom-uk-history"
  ],
  "chance": [
   "cardlist-2008",
   "fandom-chance"
  ],
  "chest": [
   "cardlist-2008",
   "fandom-chest"
  ],
  "tokens": [
   "wom-uk-2008",
   "wom-uk-2015"
  ],
  "money": [
   "wom-uk-history"
  ]
 }
};
