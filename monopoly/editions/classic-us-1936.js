/* Monopoly edition data: Classic US (1936-2007). Plain data only (no code). Copied from part 1's research file by BG_audit/sprint/monoeditions/build-editions.js;
   format: BG_audit/games/monopoly/editions/FORMAT.md */
(self.MONO_EDITIONS = self.MONO_EDITIONS || {})["classic-us-1936"] = {
 "format": 1,
 "id": "classic-us-1936",
 "name": "Classic US (1936-2007)",
 "officialName": "Monopoly",
 "maker": "Parker Brothers",
 "country": "US",
 "countryName": "United States",
 "year": 1936,
 "years": "1936-2007",
 "language": "en-US",
 "era": "classic",
 "ruleset": "monopoly",
 "status": "VERIFIED",
 "inferred": [],
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
   "5": 5,
   "10": 5,
   "20": 6,
   "50": 2,
   "100": 2,
   "500": 2
  },
  "noteColours": {
   "1": "white",
   "5": "pink",
   "10": "yellow",
   "20": "green",
   "50": "blue",
   "100": "tan",
   "500": "goldenrod"
  },
  "notesNote": "Note split 2/2/2/6/5/5/5 from the 1952 rules until 2008; colours from the early 1940s until 2008. 1936-1951: see variant us-1936-1951."
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
   "amount": 200,
   "pct": 10,
   "printed": "INCOME TAX  PAY 10% OR $200"
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
 "cardsNote": "Card text transcribed from the 1938-1954 printing (photos, case normalised). The effects and amounts stayed the same until 2008 (BSD monop 1980 data; Monopoly Wiki brace notes); later printings changed wording only (e.g. 'Board Walk' -> 'Boardwalk', 'Grand Opera Night').",
 "chance": [
  {
   "text": "Advance to Go (Collect $200).",
   "fx": "move",
   "a": 0
  },
  {
   "text": "Advance to Illinois Ave.",
   "fx": "move",
   "a": 24
  },
  {
   "text": "Advance to St. Charles Place. If you pass Go, collect $200.",
   "fx": "move",
   "a": 11
  },
  {
   "text": "Advance token to the nearest Railroad and pay owner Twice the Rental to which he is otherwise entitled. If Railroad is unowned, you may buy it from the Bank.",
   "fx": "nearRR"
  },
  {
   "text": "Advance token to the nearest Railroad and pay owner Twice the Rental to which he is otherwise entitled. If Railroad is unowned, you may buy it from the Bank.",
   "fx": "nearRR"
  },
  {
   "text": "Advance token to nearest Utility. If unowned you may buy it from bank. If owned, throw dice and pay owner a total ten times the amount thrown.",
   "fx": "nearUtil"
  },
  {
   "text": "Bank pays you dividend of $50.",
   "fx": "gain",
   "a": 50
  },
  {
   "text": "Get out of Jail free. This card may be kept until needed or sold.",
   "fx": "joker"
  },
  {
   "text": "Go back 3 spaces.",
   "fx": "back3"
  },
  {
   "text": "Go directly to Jail. Do not pass Go, do not collect $200.",
   "fx": "jail"
  },
  {
   "text": "Make general repairs on all your property. For each house pay $25. For each hotel $100.",
   "fx": "repairs",
   "a": [
    25,
    100
   ]
  },
  {
   "text": "Pay poor tax of $15.",
   "fx": "pay",
   "a": 15
  },
  {
   "text": "Take a ride on the Reading. If you pass Go, collect $200.",
   "fx": "move",
   "a": 5
  },
  {
   "text": "Take a walk on the Board Walk. Advance token to Board Walk.",
   "fx": "move",
   "a": 39
  },
  {
   "text": "Your building and loan matures. Collect $150.",
   "fx": "gain",
   "a": 150
  },
  {
   "text": "You have been elected Chairman of the Board. Pay each player $50.",
   "fx": "payeach",
   "a": 50
  }
 ],
 "chest": [
  {
   "text": "Advance to Go (Collect $200).",
   "fx": "move",
   "a": 0
  },
  {
   "text": "Bank error in your favor. Collect $200.",
   "fx": "gain",
   "a": 200
  },
  {
   "text": "Doctor's fee. Pay $50.",
   "fx": "pay",
   "a": 50
  },
  {
   "text": "From sale of stock you get $45.",
   "fx": "gain",
   "a": 45
  },
  {
   "text": "Get out of Jail, free. This card may be kept until needed or sold.",
   "fx": "joker"
  },
  {
   "text": "Go to Jail. Go directly to Jail. Do not pass Go. Do not collect $200.",
   "fx": "jail"
  },
  {
   "text": "Grand Opera Opening. Collect $50 from every player for opening night seats.",
   "fx": "collecteach",
   "a": 50
  },
  {
   "text": "Income tax refund. Collect $20.",
   "fx": "gain",
   "a": 20
  },
  {
   "text": "Life insurance matures. Collect $100.",
   "fx": "gain",
   "a": 100
  },
  {
   "text": "Pay hospital $100.",
   "fx": "pay",
   "a": 100
  },
  {
   "text": "Pay school tax of $150.",
   "fx": "pay",
   "a": 150
  },
  {
   "text": "Receive for services $25.",
   "fx": "gain",
   "a": 25
  },
  {
   "text": "You are assessed for street repairs. $40 per house. $115 per hotel.",
   "fx": "repairs",
   "a": [
    40,
    115
   ]
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
  },
  {
   "text": "Xmas fund matures. Collect $100.",
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
   "id": "long-cannon",
   "name": "Long Cannon (Howitzer)",
   "what": "a long-barrelled field gun on two wheels"
  },
  {
   "id": "iron",
   "name": "Iron",
   "what": "an old flat iron (sad iron) with a handle"
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
   "id": "horse-rider",
   "name": "Horse & Rider",
   "what": "a rider on a rearing horse",
   "emoji": "🐎"
  },
  {
   "id": "wheelbarrow",
   "name": "Wheelbarrow",
   "what": "a one-wheeled garden wheelbarrow",
   "emoji": "🛒"
  }
 ],
 "tokensNote": "Default = the ten-token #9 set of 1985-1998 (WoM token chart). Other periods are token variants.",
 "rules": {
  "incomeTaxChoice": true,
  "luxury75": true
 },
 "ruleNotes": [
  "Income Tax: pay 10% of your total worth or $200 (choose before counting).",
  "Luxury Tax $75."
 ],
 "variants": [
  {
   "id": "us-1936-1951",
   "name": "1936-1951 printing (Marvin Gardens typo, 1936 note split, 7 tokens)",
   "years": "1936-1951",
   "set": {
    "spaces.29.rent.0": 22,
    "money.startingNotes": {
     "1": 5,
     "5": 5,
     "10": 7,
     "20": 5,
     "50": 2,
     "100": 7,
     "500": 1
    }
   },
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
    }
   ],
   "src": [
    "wom-deeds",
    "wom-rules-1936",
    "wom-tokens"
   ],
   "note": "Deeds printed Marvin Gardens rent $22 until 1951/52; the 1936 single-star rules split $1500 as 1x500, 7x100, 2x50, 5x20, 7x10, 5x5, 5x1."
  },
  {
   "id": "tokens-1946",
   "name": "1946-1951 #9 tokens",
   "years": "1946-1951",
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
     "id": "long-cannon",
     "name": "Long Cannon (Howitzer)",
     "what": "a long-barrelled field gun on two wheels"
    },
    {
     "id": "iron",
     "name": "Iron",
     "what": "an old flat iron (sad iron) with a handle"
    },
    {
     "id": "car-driver",
     "name": "Car with Driver",
     "what": "a small open touring car with a driver at the wheel"
    },
    {
     "id": "scottie-dog",
     "name": "Scottie Dog",
     "what": "a Scottish terrier standing, side view",
     "emoji": "🐕"
    },
    {
     "id": "horse-rider",
     "name": "Horse & Rider",
     "what": "a rider on a rearing horse",
     "emoji": "🐎"
    },
    {
     "id": "wheelbarrow",
     "name": "Wheelbarrow",
     "what": "a one-wheeled garden wheelbarrow",
     "emoji": "🛒"
    }
   ],
   "src": [
    "wom-tokens"
   ]
  },
  {
   "id": "tokens-1964",
   "name": "1964-1984 #9 tokens",
   "years": "1964-1984",
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
     "id": "iron",
     "name": "Iron",
     "what": "an old flat iron (sad iron) with a handle"
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
     "id": "horse-rider",
     "name": "Horse & Rider",
     "what": "a rider on a rearing horse",
     "emoji": "🐎"
    },
    {
     "id": "wheelbarrow",
     "name": "Wheelbarrow",
     "what": "a one-wheeled garden wheelbarrow",
     "emoji": "🛒"
    }
   ],
   "src": [
    "wom-tokens"
   ]
  },
  {
   "id": "anniv-25",
   "name": "25th Anniversary Edition (1960) gilt tokens",
   "years": "1960",
   "tokens": [
    {
     "id": "flower-basket",
     "name": "Basket of Flowers",
     "what": "a small basket of flowers"
    },
    {
     "id": "shoe",
     "name": "Shoe",
     "what": "a laced ankle boot (the 1930s 'shoe' token)"
    },
    {
     "id": "typewriter",
     "name": "Typewriter",
     "what": "an old desk typewriter"
    },
    {
     "id": "globe",
     "name": "World Globe",
     "what": "a world globe on a stand"
    },
    {
     "id": "telephone",
     "name": "Telephone",
     "what": "an old candlestick or desk telephone"
    },
    {
     "id": "horse-head",
     "name": "Horse Head",
     "what": "a horse's head (chess-knight style)"
    }
   ],
   "src": [
    "fandom-25th"
   ]
  },
  {
   "id": "anniv-40",
   "name": "40th Anniversary Edition (1975)",
   "years": "1975",
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
     "id": "long-cannon",
     "name": "Long Cannon (Howitzer)",
     "what": "a long-barrelled field gun on two wheels"
    },
    {
     "id": "iron",
     "name": "Iron",
     "what": "an old flat iron (sad iron) with a handle"
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
     "id": "horse-rider",
     "name": "Horse & Rider",
     "what": "a rider on a rearing horse",
     "emoji": "🐎"
    },
    {
     "id": "wheelbarrow",
     "name": "Wheelbarrow",
     "what": "a one-wheeled garden wheelbarrow",
     "emoji": "🛒"
    }
   ],
   "src": [
    "wom-tokens"
   ]
  },
  {
   "id": "anniv-50",
   "name": "50th Anniversary Deluxe Edition (1985, gold, with the train)",
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
     "id": "long-cannon",
     "name": "Long Cannon (Howitzer)",
     "what": "a long-barrelled field gun on two wheels"
    },
    {
     "id": "iron",
     "name": "Iron",
     "what": "an old flat iron (sad iron) with a handle"
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
     "id": "train",
     "name": "Train",
     "what": "a steam locomotive, side view"
    },
    {
     "id": "horse-rider",
     "name": "Horse & Rider",
     "what": "a rider on a rearing horse",
     "emoji": "🐎"
    },
    {
     "id": "wheelbarrow",
     "name": "Wheelbarrow",
     "what": "a one-wheeled garden wheelbarrow",
     "emoji": "🛒"
    }
   ],
   "src": [
    "wom-tokens"
   ]
  },
  {
   "id": "tokens-1999",
   "name": "1999-2007 #9 tokens (money bag added)",
   "years": "1999-2007",
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
     "id": "long-cannon",
     "name": "Long Cannon (Howitzer)",
     "what": "a long-barrelled field gun on two wheels"
    },
    {
     "id": "iron",
     "name": "Iron",
     "what": "an old flat iron (sad iron) with a handle"
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
     "id": "money-bag",
     "name": "Money Bag",
     "what": "a tied sack of money marked with a currency sign"
    },
    {
     "id": "horse-rider",
     "name": "Horse & Rider",
     "what": "a rider on a rearing horse",
     "emoji": "🐎"
    },
    {
     "id": "wheelbarrow",
     "name": "Wheelbarrow",
     "what": "a one-wheeled garden wheelbarrow",
     "emoji": "🛒"
    }
   ],
   "src": [
    "wom-tokens",
    "fandom-tokens"
   ]
  }
 ],
 "sources": [
  {
   "id": "wom-cards-1938",
   "title": "World of Monopoly: Chance & Community Chest (USA) 1938-1954 - photos of all 32 cards",
   "url": "https://www.worldofmonopoly.com/northamerica/usa/gamehistory/candcc-19381954.php"
  },
  {
   "id": "bsd-monop",
   "title": "BSD monop (Berkeley, 1980): brd.dat, prop.dat, cards.inp - an independent transcription of the pre-2008 US board and cards",
   "url": "https://github.com/openbsd/src/tree/master/games/monop"
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
   "id": "wiki-cards",
   "title": "Wikipedia (2010 mirror): Chance and Community Chest cards - US changes and UK-only cards",
   "url": "https://en-academic.com/dic.nsf/enwiki/7021822"
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
   "id": "fandom-tax",
   "title": "Monopoly Wiki: Income Tax / Luxury Tax ($75 before 2008; 1935 $300)",
   "url": "https://monopoly.fandom.com/wiki/Income_Tax"
  },
  {
   "id": "wom-us-2008",
   "title": "World of Monopoly: Classic 2008-2012 (USA) - 8 tokens, $200 income tax, $100 luxury tax, new note split",
   "url": "https://www.worldofmonopoly.com/northamerica/usa/country/classic/2008.php"
  },
  {
   "id": "wom-rules-1952",
   "title": "World of Monopoly: Rules 1952-1972 (USA) - note split used until 2008",
   "url": "https://www.worldofmonopoly.com/northamerica/usa/gamehistory/rules-1952.php"
  },
  {
   "id": "wom-rules-1936",
   "title": "World of Monopoly: Rules 1936-1939 (USA) - 1936 note split",
   "url": "https://www.worldofmonopoly.com/northamerica/usa/gamehistory/rules-1936.php"
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
   "id": "fandom-tokens",
   "title": "Monopoly Wiki: Tokens (dates of every standard token)",
   "url": "https://monopoly.fandom.com/wiki/Tokens"
  },
  {
   "id": "fandom-25th",
   "title": "Monopoly Wiki: 25th Anniversary Edition (1960) tokens",
   "url": "https://monopoly.fandom.com/wiki/25th_Anniversary_Edition"
  }
 ],
 "sourceMap": {
  "board": [
   "wom-deeds",
   "bsd-monop",
   "wom-props"
  ],
  "taxes": [
   "fandom-tax",
   "wom-us-2008"
  ],
  "chance": [
   "wom-cards-1938",
   "bsd-monop",
   "fandom-chance"
  ],
  "chest": [
   "wom-cards-1938",
   "bsd-monop",
   "fandom-chest"
  ],
  "tokens": [
   "wom-tokens",
   "fandom-tokens"
  ],
  "money": [
   "wom-rules-1952",
   "wom-us-2008",
   "wom-money"
  ]
 }
};
