/* Monopoly edition data: Parker Brothers 1935 (first edition). Plain data only (no code). Copied from part 1's research file by BG_audit/sprint/monoeditions/build-editions.js;
   format: BG_audit/games/monopoly/editions/FORMAT.md */
(self.MONO_EDITIONS = self.MONO_EDITIONS || {})["parker-1935"] = {
 "format": 1,
 "id": "parker-1935",
 "name": "Parker Brothers 1935 (first edition)",
 "officialName": "Monopoly",
 "maker": "Parker Brothers",
 "country": "US",
 "countryName": "United States",
 "year": 1935,
 "years": "1935",
 "language": "en-US",
 "era": "first",
 "ruleset": "monopoly",
 "status": "PARTLY INFERRED",
 "inferred": [
  {
   "field": "spaces.38.amount",
   "why": "Luxury Tax $75: every source gives $75 for all US boards before 2008; no photo of a 1935 board's Luxury Tax space was found."
  },
  {
   "field": "money.startingNotes",
   "why": "WoM documents the Darrow / early Parker split (1x500, 5x100, 5x50, 5x20, 10x10, 8x5, 10x1) and a later 1935 split; matching it to the Late Patent Pending card printing is my inference."
  },
  {
   "field": "spaces[*].n",
   "why": "Printed 1935 board names not checked against a 1935 board photo (the Atlantic City names have not changed 1935-2024, WoM property list)."
  }
 ],
 "currency": {
  "symbol": "$",
  "position": "before",
  "space": false,
  "code": "USD",
  "word": {
   "one": "dollar",
   "many": "dollars"
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
  "hotels": 12,
  "startingNotes": {
   "1": 10,
   "5": 8,
   "10": 10,
   "20": 5,
   "50": 5,
   "100": 5,
   "500": 1
  },
  "noteColours": {
   "1": "white",
   "5": "pink",
   "10": "yellow",
   "20": "green",
   "50": "grey",
   "100": "salmon",
   "500": "goldenrod"
  }
 },
 "groups": {
  "brown": {
   "name": "Dark Purple",
   "printed": "dark purple (brown from 2008)",
   "hex": "#5b2c6f"
  },
  "light_blue": {
   "name": "Light Blue",
   "printed": "light blue",
   "hex": "#9fd0ef"
  },
  "pink": {
   "name": "Violet",
   "printed": "violet / magenta (sources name it differently)",
   "hex": "#b03a8c"
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
  "word": "Railroad",
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
   "n": "Mediterranean Avenue",
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
   "n": "Baltic Avenue",
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
   "amount": 300,
   "pct": 10,
   "printed": "INCOME TAX  PAY 10% OR $300"
  },
  {
   "n": "Reading Railroad",
   "t": "rr",
   "price": 200,
   "mort": 100
  },
  {
   "n": "Oriental Avenue",
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
   "n": "Vermont Avenue",
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
   "n": "Connecticut Avenue",
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
   "n": "St. Charles Place",
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
   "n": "States Avenue",
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
   "n": "Virginia Avenue",
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
   "n": "Pennsylvania Railroad",
   "t": "rr",
   "price": 200,
   "mort": 100
  },
  {
   "n": "St. James Place",
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
   "n": "Tennessee Avenue",
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
   "n": "New York Avenue",
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
   "n": "Kentucky Avenue",
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
   "n": "Indiana Avenue",
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
   "n": "Illinois Avenue",
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
   "n": "B&O Railroad",
   "t": "rr",
   "price": 200,
   "mort": 100,
   "printed": "B. & O. RAILROAD"
  },
  {
   "n": "Atlantic Avenue",
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
   "n": "Ventnor Avenue",
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
   "n": "Marvin Gardens",
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
   "n": "Pacific Avenue",
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
   "n": "North Carolina Avenue",
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
   "n": "Pennsylvania Avenue",
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
   "n": "Short Line",
   "t": "rr",
   "price": 200,
   "mort": 100
  },
  {
   "n": "Chance",
   "t": "chance"
  },
  {
   "n": "Park Place",
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
   "n": "Luxury Tax",
   "t": "tax",
   "tax": "luxury",
   "amount": 75,
   "printed": "LUXURY TAX  PAY $75.00"
  },
  {
   "n": "Boardwalk",
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
 "cardsNote": "1935 Late Patent Pending printing: plain-text cards, amounts printed with cents ($200.00). The earliest Parker sets (to early single-patent) had these two Community Chest cards 'Go back to Baltic Avenue' and 'Pay your insurance premium'; later 1935 sets replaced them with two 'nearest Railroad' cards (WoM 1935 page).",
 "chance": [
  {
   "text": "Advance to \"Go\".",
   "fx": "move",
   "a": 0
  },
  {
   "text": "Advance to Illinois Avenue. If you pass \"Go\" collect $200.00.",
   "fx": "move",
   "a": 24
  },
  {
   "text": "Advance to St. Charles Place. If you pass \"Go\" collect $200.00.",
   "fx": "move",
   "a": 11
  },
  {
   "text": "Bank pays you dividend of $50.00.",
   "fx": "gain",
   "a": 50
  },
  {
   "text": "Get out of Jail free. This card may be kept until needed or sold.",
   "fx": "joker"
  },
  {
   "text": "Go back three spaces.",
   "fx": "back3"
  },
  {
   "text": "Go to Jail. Move directly to Jail. Do not pass \"Go\". Do not collect $200.00.",
   "fx": "jail"
  },
  {
   "text": "Make general repairs on all of your houses. For each house pay $25.00. For each hotel pay $100.00.",
   "fx": "repairs",
   "a": [
    25,
    100
   ]
  },
  {
   "text": "Parking fine $15.00.",
   "fx": "pay",
   "a": 15
  },
  {
   "text": "Pay poor tax of $12.00.",
   "fx": "pay",
   "a": 12
  },
  {
   "text": "Pay school tax of $150.00.",
   "fx": "pay",
   "a": 150
  },
  {
   "text": "Take a ride on the Reading. Advance token and if you pass \"Go\" collect $200.00.",
   "fx": "move",
   "a": 5
  },
  {
   "text": "Take a walk on the Boardwalk.",
   "fx": "move",
   "a": 39
  },
  {
   "text": "You are assessed for street repairs. $40.00 per house. $115.00 per hotel.",
   "fx": "repairs",
   "a": [
    40,
    115
   ]
  },
  {
   "text": "Your building and loan matures. Receive $150.00.",
   "fx": "gain",
   "a": 150
  },
  {
   "text": "Your Xmas fund matures. Collect $100.00.",
   "fx": "gain",
   "a": 100
  }
 ],
 "chest": [
  {
   "text": "Advance to \"Go\".",
   "fx": "move",
   "a": 0
  },
  {
   "text": "Bank error in your favor. Collect $200.00.",
   "fx": "gain",
   "a": 200
  },
  {
   "text": "Doctor's fee. Pay $50.00.",
   "fx": "pay",
   "a": 50
  },
  {
   "text": "From sale of stock you get $45.00.",
   "fx": "gain",
   "a": 45
  },
  {
   "text": "Get out of Jail free. This card may be kept until needed or sold.",
   "fx": "joker"
  },
  {
   "text": "Go back to Baltic Avenue.",
   "fx": "moveBack",
   "a": 3
  },
  {
   "text": "Go to Jail. Move directly to Jail. Do not pass \"Go\". Do not collect $200.00.",
   "fx": "jail"
  },
  {
   "text": "Income tax refund. Collect $20.00.",
   "fx": "gain",
   "a": 20
  },
  {
   "text": "Life insurance matures. Collect $100.00.",
   "fx": "gain",
   "a": 100
  },
  {
   "text": "Pay a $10.00 fine or take a \"Chance\".",
   "fx": "fineOrChance",
   "a": 10
  },
  {
   "text": "Pay hospital $100.00.",
   "fx": "pay",
   "a": 100
  },
  {
   "text": "Pay your insurance premium $50.00.",
   "fx": "pay",
   "a": 50
  },
  {
   "text": "Receive for services $25.00.",
   "fx": "gain",
   "a": 25
  },
  {
   "text": "You have won second prize in a beauty contest. Collect $11.00.",
   "fx": "gain",
   "a": 11
  },
  {
   "text": "You inherit $100.00.",
   "fx": "gain",
   "a": 100
  },
  {
   "text": "We're off the gold standard. Collect $50.00.",
   "fx": "gain",
   "a": 50
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
   "id": "thimble",
   "name": "Thimble",
   "what": "a sewing thimble with a dimpled surface",
   "emoji": "🧵"
  },
  {
   "id": "shoe",
   "name": "Shoe",
   "what": "a laced ankle boot (the 1930s 'shoe' token)"
  },
  {
   "id": "battleship",
   "name": "Battleship",
   "what": "a grey battleship with gun turrets, side view",
   "emoji": "🚢"
  },
  {
   "id": "cannon",
   "name": "Cannon",
   "what": "a short field cannon on two wheels"
  },
  {
   "id": "iron",
   "name": "Iron",
   "what": "an old flat iron (sad iron) with a handle"
  },
  {
   "id": "car-1935",
   "name": "Roadster",
   "what": "a 1930s open roadster, side view",
   "added": "from the 1935 Deluxe set"
  },
  {
   "id": "lantern",
   "name": "Lantern",
   "what": "an old hand lantern with a ring handle",
   "added": "from the 1935 Deluxe set"
  }
 ],
 "tokensNote": "1935 #7 standard set: six die-cast metal tokens. Darrow's own sets had no tokens.",
 "rules": {
  "incomeTaxChoice": true,
  "luxury75": true
 },
 "ruleNotes": [
  "Income Tax: estimate your tax at $300, or pay 10% of your total worth (decide before counting). The build must read the $300 from the space (`amount`), not the $200 the engine uses today."
 ],
 "variants": [
  {
   "id": "deluxe-9",
   "name": "1935 Deluxe #9 tokens",
   "years": "1935",
   "tokens": [
    {
     "id": "top-hat",
     "name": "Top Hat",
     "what": "a tall silk top hat with a band",
     "emoji": "🎩"
    },
    {
     "id": "thimble",
     "name": "Thimble",
     "what": "a sewing thimble with a dimpled surface",
     "emoji": "🧵"
    },
    {
     "id": "shoe",
     "name": "Shoe",
     "what": "a laced ankle boot (the 1930s 'shoe' token)"
    },
    {
     "id": "battleship",
     "name": "Battleship",
     "what": "a grey battleship with gun turrets, side view",
     "emoji": "🚢"
    },
    {
     "id": "cannon",
     "name": "Cannon",
     "what": "a short field cannon on two wheels"
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
     "id": "lantern",
     "name": "Lantern",
     "what": "an old hand lantern with a ring handle"
    },
    {
     "id": "rocking-horse",
     "name": "Rocking Horse",
     "what": "a child's wooden rocking horse"
    },
    {
     "id": "purse",
     "name": "Purse",
     "what": "a clasp purse (coin purse)"
    }
   ],
   "src": [
    "wom-tokens",
    "wom-us-1935"
   ]
  },
  {
   "id": "anniv-1985-commemorative",
   "name": "1985 '1935 Commemorative' edition (antique brass replicas of the 1935 deluxe tokens)",
   "years": "1985",
   "tokens": [
    {
     "id": "top-hat",
     "name": "Top Hat",
     "what": "a tall silk top hat with a band",
     "emoji": "🎩"
    },
    {
     "id": "thimble",
     "name": "Thimble",
     "what": "a sewing thimble with a dimpled surface",
     "emoji": "🧵"
    },
    {
     "id": "shoe",
     "name": "Shoe",
     "what": "a laced ankle boot (the 1930s 'shoe' token)"
    },
    {
     "id": "battleship",
     "name": "Battleship",
     "what": "a grey battleship with gun turrets, side view",
     "emoji": "🚢"
    },
    {
     "id": "cannon",
     "name": "Cannon",
     "what": "a short field cannon on two wheels"
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
     "id": "lantern",
     "name": "Lantern",
     "what": "an old hand lantern with a ring handle"
    },
    {
     "id": "rocking-horse",
     "name": "Rocking Horse",
     "what": "a child's wooden rocking horse"
    },
    {
     "id": "purse",
     "name": "Purse",
     "what": "a clasp purse (coin purse)"
    }
   ],
   "src": [
    "wom-tokens"
   ]
  }
 ],
 "sources": [
  {
   "id": "wom-cards-1935",
   "title": "World of Monopoly: 1935 Late Patent Pending Chance & Community Chest - photos of all 32 cards",
   "url": "https://www.worldofmonopoly.com/northamerica/usa/gamehistory/candcc-1935.php"
  },
  {
   "id": "wom-us-1935",
   "title": "World of Monopoly: Classic 1935 (USA) - 1935 sets, plain-text cards, #7 tokens",
   "url": "https://www.worldofmonopoly.com/northamerica/usa/country/classic/1935.php"
  },
  {
   "id": "wom-card-chart",
   "title": "World of Monopoly: Chance & Community Chest variations chart (Darrow to 2008)",
   "url": "https://www.worldofmonopoly.com/northamerica/usa/gamehistory/candcc-index.php"
  },
  {
   "id": "wm-1935-booklet",
   "title": "Winning Moves 1935 Commemorative (No. 9 reissue) rule booklet: Income Tax $300 or 10% (archived PDF)",
   "url": "http://web.archive.org/web/2010/http://www.winning-moves.com/images/mono35bookweb.pdf"
  },
  {
   "id": "wom-rules-1933",
   "title": "World of Monopoly: Rules 1933-1935 (USA) - $300-or-10% income tax option, note splits",
   "url": "https://www.worldofmonopoly.com/northamerica/usa/gamehistory/rules-1933.php"
  },
  {
   "id": "fandom-tax",
   "title": "Monopoly Wiki: Income Tax / Luxury Tax ($75 before 2008; 1935 $300)",
   "url": "https://monopoly.fandom.com/wiki/Income_Tax"
  },
  {
   "id": "wom-deeds",
   "title": "World of Monopoly: Title Deeds - the differences (incl. Marvin Gardens $22 typo to 1951/52; deed photos)",
   "url": "https://www.worldofmonopoly.com/northamerica/usa/gamehistory/titledeeds.php"
  },
  {
   "id": "wom-props",
   "title": "World of Monopoly: USA property list (Atlantic City; Rhode Island Avenue from 2025)",
   "url": "https://www.worldofmonopoly.com/northamerica/usa/gamehistory/properties.php"
  },
  {
   "id": "wom-money",
   "title": "World of Monopoly: Money (USA) - note colours by era",
   "url": "https://www.worldofmonopoly.com/northamerica/usa/gamehistory/money.php"
  },
  {
   "id": "wom-tokens",
   "title": "World of Monopoly: Tokens (USA) and token chart by edition",
   "url": "https://www.worldofmonopoly.com/northamerica/usa/gamehistory/tokenchart.php"
  },
  {
   "id": "bsd-monop",
   "title": "BSD monop (Berkeley, 1980): brd.dat, prop.dat, cards.inp - an independent transcription of the pre-2008 US board and cards",
   "url": "https://github.com/openbsd/src/tree/master/games/monop"
  }
 ],
 "sourceMap": {
  "board": [
   "wom-deeds",
   "bsd-monop"
  ],
  "taxes": [
   "wm-1935-booklet",
   "wom-rules-1933",
   "fandom-tax"
  ],
  "chance": [
   "wom-cards-1935",
   "wom-card-chart"
  ],
  "chest": [
   "wom-cards-1935",
   "wom-card-chart",
   "wom-us-1935"
  ],
  "tokens": [
   "wom-us-1935",
   "wom-tokens"
  ],
  "money": [
   "wom-rules-1933",
   "wom-money"
  ]
 },
 "tokensAddedNote": "The box held 6 tokens; the game seats 8, so roadster and lantern were added (from the 1935 Deluxe set)."
};
