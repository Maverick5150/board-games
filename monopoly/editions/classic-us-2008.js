/* Monopoly edition data: Classic US (2008 update). Plain data only (no code). Copied from part 1's research file by BG_audit/sprint/monoeditions/build-editions.js;
   format: BG_audit/games/monopoly/editions/FORMAT.md */
(self.MONO_EDITIONS = self.MONO_EDITIONS || {})["classic-us-2008"] = {
 "format": 1,
 "id": "classic-us-2008",
 "name": "Classic US (2008 update)",
 "officialName": "Monopoly",
 "maker": "Parker Brothers / Hasbro",
 "country": "US",
 "countryName": "United States",
 "year": 2008,
 "years": "2008-2020",
 "language": "en-US",
 "era": "modern",
 "ruleset": "monopoly",
 "status": "VERIFIED",
 "inferred": [],
 "matchesToday": "This is the edition today's game (monopoly/index.html BOARD, CHANCE, CHEST) plays: the US standard edition after the September 2008 worldwide standardisation (cards photo-checked; card wording in `text` is the game's, the printed wording is in `printed` where it differs).",
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
   "1": 5,
   "5": 1,
   "10": 2,
   "20": 1,
   "50": 1,
   "100": 4,
   "500": 2
  },
  "noteColours": {
   "1": "white",
   "5": "pink",
   "10": "blue",
   "20": "lime green",
   "50": "purple (lavender)",
   "100": "peach",
   "500": "goldenrod"
  }
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
   "printed": "pink (magenta)",
   "hex": "#d93a96"
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
   "amount": 200,
   "printed": "INCOME TAX  PAY $200"
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
   "amount": 100,
   "printed": "LUXURY TAX  PAY $100"
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
 "chance": [
  {
   "text": "Advance to Boardwalk.",
   "fx": "move",
   "a": 39
  },
  {
   "text": "Advance to Go (Collect $200).",
   "fx": "move",
   "a": 0,
   "printed": "Advance to \"Go\". (Collect $200)"
  },
  {
   "text": "Advance to Illinois Avenue. If you pass Go, collect $200.",
   "fx": "move",
   "a": 24,
   "printed": "Advance to Illinois Avenue. If you pass \"Go\" collect $200."
  },
  {
   "text": "Advance to St. Charles Place. If you pass Go, collect $200.",
   "fx": "move",
   "a": 11,
   "printed": "Advance to St. Charles Place. If you pass \"Go\" collect $200."
  },
  {
   "text": "Advance to the nearest Railroad. If unowned, you may buy it from the Bank. If owned, pay owner twice the rental to which they are otherwise entitled.",
   "fx": "nearRR"
  },
  {
   "text": "Advance to the nearest Railroad. If unowned, you may buy it from the Bank. If owned, pay owner twice the rental to which they are otherwise entitled.",
   "fx": "nearRR"
  },
  {
   "text": "Advance token to nearest Utility. If unowned, you may buy it from the Bank. If owned, throw dice and pay owner a total ten times the amount thrown.",
   "fx": "nearUtil",
   "printed": "Advance to the nearest Utility. If unowned, you may buy it from the Bank. If owned, throw dice and pay owner a total ten times amount thrown."
  },
  {
   "text": "Bank pays you dividend of $50.",
   "fx": "gain",
   "a": 50
  },
  {
   "text": "Get Out of Jail Free. This card may be kept until needed or sold.",
   "fx": "joker",
   "printed": "Get Out of Jail Free. This card may be kept until needed or traded."
  },
  {
   "text": "Go Back 3 Spaces.",
   "fx": "back3",
   "printed": "Go Back Three Spaces."
  },
  {
   "text": "Go to Jail. Go directly to Jail, do not pass Go, do not collect $200.",
   "fx": "jail",
   "printed": "Go to Jail. Go directly to Jail, do not pass \"Go\", do not collect $200."
  },
  {
   "text": "Make general repairs on all your property. For each house pay $25. For each hotel pay $100.",
   "fx": "repairs",
   "a": [
    25,
    100
   ],
   "printed": "Make general repairs on all your property: For each house pay $25, For each hotel pay $100."
  },
  {
   "text": "Speeding fine $15.",
   "fx": "pay",
   "a": 15
  },
  {
   "text": "Take a trip to Reading Railroad. If you pass Go, collect $200.",
   "fx": "move",
   "a": 5,
   "printed": "Take a trip to Reading Railroad. If you pass \"Go\" collect $200."
  },
  {
   "text": "You have been elected Chairman of the Board. Pay each player $50.",
   "fx": "payeach",
   "a": 50
  },
  {
   "text": "Your building loan matures. Collect $150.",
   "fx": "gain",
   "a": 150
  }
 ],
 "chest": [
  {
   "text": "Advance to Go (Collect $200).",
   "fx": "move",
   "a": 0,
   "printed": "Advance to Go. (Collect $200)"
  },
  {
   "text": "Bank error in your favor. Collect $200.",
   "fx": "gain",
   "a": 200
  },
  {
   "text": "Doctor's fee. Pay $50.",
   "fx": "pay",
   "a": 50,
   "printed": "Doctor's fees. Pay $50."
  },
  {
   "text": "From sale of stock you get $50.",
   "fx": "gain",
   "a": 50
  },
  {
   "text": "Get Out of Jail Free. This card may be kept until needed or sold.",
   "fx": "joker",
   "printed": "Get Out of Jail Free. This card may be kept until needed or traded."
  },
  {
   "text": "Go to Jail. Go directly to jail, do not pass Go, do not collect $200.",
   "fx": "jail",
   "printed": "Go to Jail. Go directly to Jail, do not pass \"Go\", do not collect $200."
  },
  {
   "text": "Holiday fund matures. Receive $100.",
   "fx": "gain",
   "a": 100
  },
  {
   "text": "Income tax refund. Collect $20.",
   "fx": "gain",
   "a": 20
  },
  {
   "text": "It is your birthday. Collect $10 from every player.",
   "fx": "collecteach",
   "a": 10
  },
  {
   "text": "Life insurance matures. Collect $100.",
   "fx": "gain",
   "a": 100
  },
  {
   "text": "Pay hospital fees of $100.",
   "fx": "pay",
   "a": 100
  },
  {
   "text": "Pay school fees of $50.",
   "fx": "pay",
   "a": 50
  },
  {
   "text": "Receive $25 consultancy fee.",
   "fx": "gain",
   "a": 25
  },
  {
   "text": "You are assessed for street repair. $40 per house. $115 per hotel.",
   "fx": "repairs",
   "a": [
    40,
    115
   ],
   "printed": "You are assessed for street repairs: $40 per house, $115 per hotel."
  },
  {
   "text": "You have won second prize in a beauty contest. Collect $10.",
   "fx": "gain",
   "a": 10
  },
  {
   "text": "You inherit $100.",
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
 "tokensLegacy": [
  {
   "e": "🎩",
   "n": "Top Hat"
  },
  {
   "e": "🏎️",
   "n": "Race Car"
  },
  {
   "e": "🐕",
   "n": "Dog"
  },
  {
   "e": "🚢",
   "n": "Battleship"
  },
  {
   "e": "👢",
   "n": "Boot"
  },
  {
   "e": "🧵",
   "n": "Thimble"
  },
  {
   "e": "🛒",
   "n": "Wheelbarrow"
  },
  {
   "e": "🐎",
   "n": "Horse & Rider"
  }
 ],
 "tokensNote": "The 2008 box had 8 tokens: top hat, race car, Scottie dog, battleship, boot, thimble, wheelbarrow, iron (cannon, horse & rider and money bag were dropped). Today's game shows Horse & Rider in place of the Iron; `tokensLegacy` keeps today's exact 8 so old saves and the default stay unchanged.",
 "rules": {},
 "ruleNotes": [
  "Income Tax is a flat $200 and Luxury Tax $100 from 2008 (today's defaults: incomeTaxChoice false, luxury75 false)."
 ],
 "variants": [
  {
   "id": "tokens-2013",
   "name": "2013-2016 tokens (cat replaces the iron)",
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
    "fandom-tokens",
    "wom-uk-2008"
   ]
  },
  {
   "id": "tokens-2017",
   "name": "2017 vote tokens (rubber duck, T-rex, penguin)",
   "years": "2017-2021",
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
    "fandom-tokens",
    "wom-uk-2015"
   ]
  },
  {
   "id": "tokens-2022",
   "name": "Thimble returns (replaces the T-rex)",
   "years": "2022/2024 (sources differ)",
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
     "id": "thimble",
     "name": "Thimble",
     "what": "a sewing thimble with a dimpled surface",
     "emoji": "🧵"
    },
    {
     "id": "penguin",
     "name": "Penguin",
     "what": "a penguin wearing a scarf"
    }
   ],
   "src": [
    "fandom-tokens"
   ]
  },
  {
   "id": "anniv-80",
   "name": "80th Anniversary Edition (2015) tokens",
   "years": "2015",
   "tokens": [
    {
     "id": "lantern",
     "name": "Lantern",
     "what": "an old hand lantern with a ring handle"
    },
    {
     "id": "bathtub",
     "name": "Bathtub",
     "what": "a clawfoot bathtub"
    },
    {
     "id": "cannon",
     "name": "Cannon",
     "what": "a short field cannon on two wheels"
    },
    {
     "id": "horse-rider",
     "name": "Horse & Rider",
     "what": "a rider on a rearing horse",
     "emoji": "🐎"
    },
    {
     "id": "pillar-car",
     "name": "Race Car on a Pillar",
     "what": "a race car standing on a short pillar (1970s design)"
    },
    {
     "id": "train",
     "name": "Train",
     "what": "a steam locomotive, side view"
    },
    {
     "id": "money-bag",
     "name": "Money Bag",
     "what": "a tied sack of money marked with a currency sign"
    },
    {
     "id": "cat",
     "name": "Cat",
     "what": "a sitting cat, side view"
    }
   ],
   "src": [
    "fandom-tokens"
   ]
  },
  {
   "id": "anniv-85",
   "name": "85th Anniversary Edition (2020) golden tokens",
   "years": "2020",
   "tokens": [
    {
     "id": "race-car",
     "name": "Race Car",
     "what": "a 1930s open-wheel racing car, side view",
     "emoji": "🏎️"
    },
    {
     "id": "sunglasses",
     "name": "Sunglasses",
     "what": "a pair of sunglasses"
    },
    {
     "id": "yacht",
     "name": "Yacht",
     "what": "a motor yacht"
    },
    {
     "id": "bow-tie",
     "name": "Bow Tie",
     "what": "a bow tie"
    },
    {
     "id": "jet",
     "name": "Jet",
     "what": "a passenger jet"
    },
    {
     "id": "helicopter",
     "name": "Helicopter",
     "what": "a helicopter"
    },
    {
     "id": "wristwatch",
     "name": "Wristwatch",
     "what": "a wristwatch"
    },
    {
     "id": "top-hat",
     "name": "Top Hat",
     "what": "a tall silk top hat with a band",
     "emoji": "🎩"
    }
   ],
   "src": [
    "fandom-tokens"
   ]
  }
 ],
 "sources": [
  {
   "id": "wom-cards-2008",
   "title": "World of Monopoly: Chance & Community Chest (USA) 2008 - photos of all 32 cards",
   "url": "https://www.worldofmonopoly.com/northamerica/usa/gamehistory/candcc-2008.php"
  },
  {
   "id": "wom-us-2008",
   "title": "World of Monopoly: Classic 2008-2012 (USA) - 8 tokens, $200 income tax, $100 luxury tax, new note split",
   "url": "https://www.worldofmonopoly.com/northamerica/usa/country/classic/2008.php"
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
   "id": "bsd-monop",
   "title": "BSD monop (Berkeley, 1980): brd.dat, prop.dat, cards.inp - an independent transcription of the pre-2008 US board and cards",
   "url": "https://github.com/openbsd/src/tree/master/games/monop"
  },
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
   "id": "fandom-tokens",
   "title": "Monopoly Wiki: Tokens (dates of every standard token)",
   "url": "https://monopoly.fandom.com/wiki/Tokens"
  },
  {
   "id": "wom-money",
   "title": "World of Monopoly: Money (USA) - note colours by era",
   "url": "https://www.worldofmonopoly.com/northamerica/usa/gamehistory/money.php"
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
  }
 ],
 "sourceMap": {
  "board": [
   "wom-deeds",
   "wom-props",
   "bsd-monop"
  ],
  "taxes": [
   "wom-us-2008"
  ],
  "chance": [
   "wom-cards-2008",
   "cardlist-2008"
  ],
  "chest": [
   "wom-cards-2008",
   "cardlist-2008"
  ],
  "tokens": [
   "wom-us-2008",
   "fandom-tokens"
  ],
  "money": [
   "wom-us-2008",
   "wom-money"
  ]
 },
 "notes": "Board numbers have not changed since 1935 (except the Marvin Gardens typo fixed in 1951/52). The 2008 update changed the cards (Poor Tax -> Speeding Fine, Grand Opera -> Birthday $10, stock $45 -> $50, school tax $150 -> school fees $50, services -> consultancy fee, Xmas -> Holiday fund), the taxes ($200 flat, $100 luxury), the brown colour, the tokens and the note split."
};
