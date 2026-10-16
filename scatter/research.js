/* Scattergories — the answer research behind a challenge (step 10). Loaded after engine.js and brain.js (index.html; tests: require()).
   A challenged answer is looked up LIVE with free, keyless, CORS-enabled sources, each with a 4 s time limit:
     - Wikipedia: the REST summary of the answer, then the search API (origin=*) with a category hint word, and the summaries of the
       best two matching titles (en.wikipedia.org/api/rest_v1/page/summary/<title>, /w/api.php?action=query&list=search);
     - the dictionary for one-word answers: Wiktionary (en.wiktionary.org/api/rest_v1/page/definition/<word>), and api.dictionaryapi.dev
       when Wiktionary does not answer (it is not waited for when Wikipedia or Datamuse already shows the fit);
     - Datamuse (api.datamuse.com/words?sp=…&md=df): is it a word, and its WordNet definitions;
     - the game's own lists (bank.js).
   Google is not used: its search API needs a paid key, which cannot sit in a public page.
   research(q) always settles (never throws, never hangs): offline, without fetch or after a source failure the ruling falls back to
   bank.js and, when that is not enough, to the players' vote. The ruling:
     {v:"good"|"bad"|"vote", lead, quote, cite, url, src:[{n,s}], cls, offline, ms}
   Category fit is judged with care: every category has hint words (what an answer of that category is called in a source) and the
   kinds of thing it accepts (A animal, G plant, F food or drink, P person, L place, T title of a work, N a name, O any other thing,
   * anything). An answer counts when a source that names it uses a hint word. It is ruled out for the category only when the source
   clearly says it is a kind of thing the category does not take ("a zebra is an animal": not Something in a kitchen); anything less
   clear is "too close to call" and goes to the vote. */
(function(g){
"use strict";
var Sc=g.Scatter=g.Scatter||{}, E=Sc.Engine;
if(!E||Sc.Research) return;
var TIMEOUT=4000, CAP=10000, WIKI="https://en.wikipedia.org", WIKT="https://en.wiktionary.org/api/rest_v1/page/definition/", DICT="https://api.dictionaryapi.dev/api/v2/entries/en/", MUSE="https://api.datamuse.com/words";

/* ---------- what a source calls each kind of thing (searched in the short description, or the first sentence) ---------- */
var CLS={
  A:/\b(animals?|mammals?|birds?|fish(es)?|reptiles?|amphibians?|insects?|equines?|felines?|canines?|rodents?|primates?|marsupials?|ungulates?|crustaceans?|mollus[ck]s?|arachnids?|spiders?|snakes?|lizards?|beetles?|songbirds?|seabirds?|parrots?|whales?|sharks?|dog breed|cat breed|breed of (dog|cat|horse|cattle|chicken|sheep|pig))\b/i,
  G:/\b(plants?|trees?|shrubs?|flowering|flowers?|vines?|grass(es)?|fungus|fungi|mushrooms?|moss(es)?|conifers?|palms?|cultivars?|genus of plants)\b/i,
  F:/\b(foods?|dish(es)?|fruits?|vegetables?|berr(y|ies)|drinks?|beverages?|edible|cuisine|snacks?|desserts?|pastr(y|ies)|cakes?|breads?|sauces?|condiments?|spices?|cheeses?|cand(y|ies)|confections?(ery)?|soups?|sandwich(es)?|meats?|cocktails?|juices?|soft drinks?|cereals?|ingredients?|sweets?)\b/i,
  P:/(\(born\b|\bborn \d|\b(actor|actress|singer|rapper|musician|politician|statesman|athletes?|footballer|scientist|inventor|physicist|chemist|biologist|mathematician|astronomer|writer|author|poet|painter|businessman|businesswoman|entrepreneur|philosopher|composer|explorer|emperor|monarch|comedian|television presenter|basketball player|baseball player|tennis player|golfer|boxer|swimmer|sprinter|racing driver)\b|\b1[0-9]{3}\s*[–-]\s*(1|2)[0-9]{3}\b)/i,
  L:/\b(city|cities|town|village|country|countries|capital city|state in|state of the united states|u\.s\. state|province|island|river|lake|mountain|municipality|county|borough|commune|archipelago|peninsula|national park|neighbou?rhood|sovereign state|region of)\b/i,
  T:/\b([0-9]{4} (american |british |japanese |canadian )?(film|song|single|album|video game|television series|novel|animated film)|film directed|television series|tv series|sitcom|video game|board game|card game|novel by|musical group|rock band|pop band|boy band|girl group|comic book|media franchise|cartoon character|animated (film|series|television)|fictional character|book series|game show|studio album)\b/i,
  N:/\b(given name|surname|first name|family name|masculine name|feminine name|unisex name|personal name|nickname)\b/i
};
var CLSNAME={A:"an animal",G:"a plant",F:"a food or drink",P:"a person",L:"a place",T:"a title (a film, song, show, game or book)",N:"a name"};
var CLSORDER="PATGFLN";   // a description can match several (\"fast food restaurant chain\"): all are kept

/* ---------- each category: [search hint, the kinds it takes ("*" = anything), hint words] ---------- */
var NM="given name|masculine|feminine|unisex|male|female|name", ANI="animal|mammal|species|genus|creature";
var H={
p01:["name","NP","given name|masculine|male|boy|boys|name"], p02:["name","NP","given name|feminine|female|girl|girls|name"],
p03:["occupation","PO","occupation|profession|job|worker|person who|someone who|employ|trade|career|practitioner|specialist|officer|tradesman|tradesperson"],
p04:["clothing","O","garment|clothing|clothes|wear|worn|apparel|dress|jewel|accessor|fashion|shoe|textile|fabric|outfit|uniform|headwear|footwear"],
p05:["anatomy","O","body|anatom|organ|limb|bone|muscle|tissue|gland|joint|skin|human"],
p06:["","PN","born|american|british|actor|actress|singer|politician|known|famous|surname|family name"],
p07:["emotion","O","emotion|feeling|mood|state of mind|affect|sentiment|mental state|anger|fear|joy|sadness|happiness|distress|pleasure"],
p08:["school subject","O","subject|discipline|study|studies|science|language|academic|education|course|field of|mathemat|history|literature|art"],
p09:["nickname","*","nickname|slang|informal|term of endearment|name"],
p10:["shoe","O","shoe|boot|footwear|sandal|slipper|sneaker|heel|foot|feet|worn|clog|loafer"],
p11:["hat","O","hat|cap|headwear|headgear|helmet|worn on the head|head|crown|hood|bonnet|beret|scarf|bandana|veil|turban"],
p12:["hair","O","hair|hairstyle|haircut|comb|brush|shampoo|beard|braid|wig|curl|salon|barber|moustache|mustache"],
p13:["anatomy","O","bone|organ|gland|vessel|artery|vein|nerve|muscle|tissue|anatom|body|skelet|intestin|cartilage|ligament"],
p14:["president","PN","president of the united states|president|politician|statesman"],
p15:["holiday","O","holiday|celebrat|festival|observance|feast|day|anniversary|party|ceremony|tradition|commemorat"],
p16:["school supply","O","school|stationery|pen|pencil|paper|book|notebook|eraser|ruler|binder|calculator|folder|writing|crayon|marker|glue|scissors|lunch|textbook"],
p17:["athlete","PN","athlete|player|footballer|sprinter|boxer|swimmer|tennis|golfer|olympi|sport|champion|basketball|baseball|soccer|hockey|nfl|nba|mlb|racing|gymnast|quarterback|pitcher"],
p18:["scientist","PN","scientist|inventor|invent|physicist|chemist|biologist|mathematician|astronomer|engineer|naturalist|discover|science"],
p19:["surname","NP","surname|family name|last name|name"], p20:["name","NP",NM],
p21:["title","ON","title|honorific|rank|form of address|courtesy|style|mister|doctor|professor|officer|clergy|military|noble|nobility"],
p22:["medicine","PO","physician|doctor|medical|medicine|nurse|surgeon|specialist|health|clinic|practitioner|therapist|therapy|dentist"],
p23:["baby","OF","baby|babies|infant|child|toddler|newborn|nursery|diaper|nappy|feeding|toy"],
p24:["personality","O","adjective|personality|trait|character|quality|behavio|temperament|disposition|describ|person|having|showing"],
p25:["movement","O","movement|motion|move|exercise|dance|walk|jump|run|gesture|posture|stretch|sport|gymnast|step|body"],
p26:["garment","O","shirt|jacket|coat|sweater|top|blouse|garment|cloth|worn|upper body|vest|hoodie|jersey|cardigan|tunic"],
p27:["garment","O","trousers|pants|shorts|skirt|garment|cloth|worn|legs|waist|lower body|jeans|leggings|kilt"],
p28:["costume","*","costume|character|monster|fictional|disguise|dress"],
p29:["anatomy","O","head|face|neck|facial|skull|eye|ear|nose|mouth|lip|cheek|chin|jaw|forehead|brow|throat|anatom|body"],
p30:["person","OPN","person|people|human|individual|someone|one who|man|woman|child|boy|girl"],
p31:["school","OL","school|room|classroom|hall|building|library|gym|office|cafeteria|area|field|laboratory|playground"],
p32:["","PN","born|died|was a|was an|emperor|king|queen|leader|president|general|explorer|historical|history|ruler|philosopher|reformer|pharaoh"],
f01:["fruit","FG","fruit|vegetable|berry|berries|edible|crop|produce|citrus|melon|squash|legume|tuber|root|cultivar|eaten|food"],
f02:["food","F","breakfast|food|dish|cereal|bread|egg|pancake|toast|morning|meal|pastry|porridge|eaten|drink|beverage|fruit"],
f03:["restaurant","FO","restaurant|chain|fast food|fast-food|franchise|diner|pizzeria|coffeehouse|steakhouse|eatery|café|cafe"],
f04:["farm","*","farm|agricultur|livestock|crop|barn|tractor|cattle|animal|poultry|harvest|field|plough|plow|domestic"],
f05:["dog","A","dog|breed|canine|hound|terrier|spaniel|retriever|shepherd|poodle|sheepdog"],
f06:["food","FG","pizza|topping|food|cheese|meat|vegetable|sausage|sauce|mushroom|pepper|fruit|ingredient|edible|herb|fish"],
f07:["drink","F","drink|beverage|soda|soft drink|juice|tea|water|lemonade|milk|milkshake|shake|smoothie|cocktail|iced|cold|cola|liquid"],
f08:["flower","G","flower|flowering|plant|bloom|blossom|genus|petal|garden|ornamental|lily|rose"],
f09:["bird","A","bird|avian|songbird|raptor|fowl|parrot|passerine|waterfowl|seabird"],
f10:["dessert","F","dessert|cake|pastry|pudding|sweet|confection|pie|cookie|ice cream|tart|custard|chocolate|candy|baked|biscuit"],
f11:["animal","A",ANI+"|bird|reptile|amphibian|zoo|wild|primate|carnivor|herbivor|predator|insect|fish"],
f12:["tree","G","tree|genus|plant|conifer|evergreen|deciduous|wood|timber|forest|palm|shrub"],
f13:["food","FG","sandwich|food|spread|meat|cheese|bread|condiment|sauce|vegetable|ingredient|edible|fish|sausage"],
f14:["candy","F","candy|confection|sweet|chocolate|sugar|lollipop|gum|toffee|caramel|bar|brand of"],
f15:["snack","F","snack|food|chip|crisp|cracker|cookie|nut|popcorn|pretzel|bar|fruit|eaten|edible"],
f16:["spice","FG","spice|herb|seasoning|flavo|culinary|plant|seed|pepper|aromatic|condiment"],
f17:["marine animal","A","sea|marine|ocean|fish|whale|shark|crustacean|mollus|cephalopod|coral|jellyfish|species|aquatic|saltwater"],
f18:["insect","A","insect|bug|beetle|fly|moth|butterfly|ant|bee|wasp|arthropod|arachnid|spider|larva|species"],
f19:["garden","*","garden|plant|flower|tree|shrub|vegetable|tool|soil|lawn|insect|seed|ornamental"],
f20:["sauce","F","sauce|condiment|dressing|dip|relish|spread|ketchup|mustard|mayonnaise|seasoning|paste|gravy|salsa|vinegar"],
f21:["italian food","F","italian|italy|pasta|pizza|dish|cuisine|food|cheese|sausage|bread|dessert|risotto"],
f22:["animal","A","pet|animal|domestic|dog|cat|bird|fish|rodent|reptile|companion|breed|mammal|species"],
f23:["mammal","A","mammal|species|genus|animal|primate|rodent|carnivor|ungulate|marsupial|whale|bat|cetacean|equine|feline|canine|bovine"],
f24:["fish","AF","fish|species|genus|freshwater|saltwater|marine|ray-finned|shark|eel|aquatic|seafood"],
f25:["food","F","bake|baked|baking|oven|bread|cake|pastry|cookie|pie|dish|food|biscuit|muffin|casserole"],
f26:["green","*","green"],
f27:["mexican food","F","mexic|tortilla|dish|cuisine|food|taco|salsa|bean|corn|maize|chili|chile|sauce"],
f28:["asian dish","F","asia|asian|chinese|japanese|korean|thai|vietnam|indian|indonesia|filipino|malaysia|dish|cuisine|food|noodle|rice|soup|dumpling|curry"],
f29:["drink","F","drink|beverage|tea|coffee|cocoa|chocolate|hot|infusion|brew|espresso|cider|toddy|soup|broth"],
f30:["reptile","A","reptile|amphibian|lizard|snake|turtle|tortoise|frog|toad|salamander|newt|crocodil|alligator|gecko|iguana|species"],
f31:["food","FG","salad|vegetable|lettuce|leaf|leafy|fruit|cheese|dressing|edible|ingredient|food|herb|nut|seed|crouton|green"],
f32:["food","F","fried|fry|frying|deep-fried|dish|food|snack|batter"],
g01:["country","L","country|sovereign|nation|republic|kingdom|island country|landlocked"],
g02:["state","L","state of the united states|u\\.s\\. state|state in|state|united states"],
g03:["city","L","city|town|united states|county|municipality|metropoli|village|borough|seat of"],
g04:["city","L","europe|european|england|scotland|wales|ireland|france|germany|italy|spain|portugal|netherlands|belgium|switzerland|austria|poland|czech|greece|sweden|norway|denmark|finland|russia|ukraine|hungary|romania|croatia|serbia|bulgaria|united kingdom|iceland|luxembourg|monaco|slovakia|slovenia|lithuania|latvia|estonia|belarus|bosnia|albania|malta|cyprus"],
g05:["vehicle","O","vehicle|transport|car|boat|ship|aircraft|train|bus|bicycle|travel|passenger|rail|road|vessel|motor|cycle|scooter"],
g06:["ocean","AGO","ocean|sea|marine|fish|whale|coral|reef|wave|salt|underwater|seabed|shell|algae|seaweed|island|ship"],
g07:["mountain","L","mountain|peak|range|summit|volcano|massif|hill|alps|elevation|highest"],
g08:["river","L","river|lake|reservoir|stream|tributary|freshwater|flows|loch|lagoon|water"],
g09:["weather","O","weather|rain|snow|wind|storm|cloud|temperature|climate|meteorolog|precipitation|fog|sun|frost|hail|thunder|lightning|tornado|hurricane|forecast|humid"],
g10:["tourist","LO","tourist|tourism|resort|vacation|holiday|beach|destination|city|country|island|park|visit|attraction|national park"],
g11:["astronomy","OL","space|planet|star|galaxy|moon|comet|asteroid|astronom|orbit|constellation|nebula|solar|satellite|cosmic|universe|spacecraft|rocket|astronaut"],
g12:["building","OL","building|structure|house|tower|construct|architect|church|hall|dwelling|barn|hospital|school|castle|temple|office|store|stadium|warehouse"],
g13:["road trip","*","road|car|travel|trip|map|snack|drive|luggage|gps|fuel"],
g14:["forest","*","forest|wood|tree|plant|animal|fungus|fungi|moss|mammal|bird|wild"],
g15:["capital","L","capital|seat of government"],
g16:["island","L","island|archipelago|isle|atoll|insular"],
g17:["airport","OP","airport|aircraft|airplane|aeroplane|flight|plane|terminal|runway|gate|pilot|luggage|baggage|passenger|ticket|security|aviation|hangar|jet"],
g18:["landmark","LO","landmark|monument|tower|building|statue|bridge|palace|temple|cathedral|park|tourist|attraction|wonder|heritage|memorial|castle|structure"],
g19:["beach","*","beach|sand|sea|ocean|sun|swim|surf|shell|wave|coast|shore|towel"],
g20:["car","O","car|automobile|automaker|vehicle|motor|manufacturer|sedan|hatchback|coupe|suv|pickup|truck|marque"],
g21:["room","O","room|space|area|house|kitchen|bedroom|bathroom|living|dining|basement|attic|hall|cellar|chamber|closet|office|study|garage|interior"],
g22:["travel","*","travel|luggage|cloth|garment|toiletr|wear|pack"],
g23:["farm","*","farm|agricultur|livestock|crop|barn|tractor|cattle|animal|poultry|harvest|field|plough|plow|domestic"],
g24:["city","L","asia|asian|china|chinese|japan|india|korea|thailand|vietnam|indonesia|philippines|pakistan|bangladesh|malaysia|singapore|taiwan|iran|iraq|saudi|israel|turkey|nepal|sri lanka|myanmar|cambodia|laos|mongolia|kazakhstan|uzbekistan|afghanistan|syria|jordan|lebanon|qatar|emirates|kuwait|yemen|oman"],
g25:["city","*","city|urban|street|building|road|traffic|park|store|shop"],
g26:["landform","L","landform|geograph|mountain|valley|hill|plateau|canyon|plain|desert|island|peninsula|delta|cliff|glacier|volcano|dune|cave|basin|bay|gulf|coast|ridge|terrain|fjord|mesa|lagoon|river|lake"],
g27:["tree","G","tree|genus|plant|conifer|evergreen|deciduous|wood|timber|forest|palm|shrub"],
g28:["boat","O","boat|ship|vessel|watercraft|sail|yacht|canoe|kayak|ferry|navy|naval|barge|hull|sailing|craft|raft|submarine|tanker"],
g29:["underground","*","underground|subterran|mine|mineral|soil|rock|cave|tunnel|root|ore|fossil|fuel|burrow"],
g30:["store","OL","store|shop|retail|retailer|chain|supermarket|boutique|market|department|outlet|bakery|pharmacy|merchant|sells|company"],
g31:["amusement ride","O","amusement|ride|roller coaster|carousel|theme park|fair|attraction|carnival|park|game|food"],
g32:["camping","*","camp|tent|outdoor|hiking|fire|sleep|backpack|flashlight|lantern|stove|knife|trail"],
t01:["board game","TO","board game|card game|game|tabletop|dice|cards|player|played"],
t02:["musical instrument","O","instrument|music|musical|percussion|string|wind|brass|keyboard|drum|horn|played|sound"],
t03:["sport","O","sport|game|played|team|ball|athlet|competition|racing|martial art|olympic|league|match"],
t04:["film","T","film|movie|motion picture|directed|starring|animated"],
t05:["cartoon character","T","cartoon|animated|character|fictional|comic|animation|series|disney|looney|mascot"],
t06:["tool","O","garage|tool|car|vehicle|automobile|bicycle|lawn|storage|equipment|paint|oil|ladder|workbench|machine|hardware|motor"],
t07:["toy","OT","toy|game|play|plaything|doll|child|children|puzzle|ball|figure|brand"],
t08:["holiday tradition","OFG","decoration|ornament|holiday|christmas|tradition|custom|celebrat|festiv|light|wreath|easter|halloween|thanksgiving|new year"],
t09:["song","T","song|single|recorded|album|track|written by|ballad|hymn|anthem|music|lyric"],
t10:["dance","O","dance|dancing|ballroom|step|music|rhythm|folk dance|ballet|choreograph"],
t11:["superhero","T","superhero|supervillain|villain|hero|comic|marvel|dc comics|fictional character|character|superpower"],
t12:["hobby","O","hobby|pastime|leisure|activity|craft|collect|recreation|sport|game|art|practice|played"],
t13:["kitchen","OFG","kitchen|cook|cooking|food|utensil|appliance|cutlery|knife|knives|fork|spoon|pan|pot|bowl|plate|dish|cup|mug|oven|stove|bake|baking|refrigerat|fridge|freezer|sink|kettle|blender|mixer|toaster|container|jar|cabinet|cupboard|counter|towel|spice|ingredient|vessel|cookware|tableware|kitchenware|bread|meal|drink|beverage"],
t14:["tool","O","tool|instrument|implement|device|hand tool|power tool|hardware|cutting|used to|used for|equipment|machine|utensil"],
t15:["video game","T","video game|game|character|nintendo|playstation|xbox|sega|console|arcade|franchise|player"],
t16:["band","T","band|musical group|group|duo|trio|quartet|rock|pop|hip hop|singer|music|album|formed in"],
t17:["bathroom","O","bathroom|bath|toilet|shower|sink|soap|towel|toothbrush|toothpaste|shampoo|hygiene|wash|mirror|cosmetic|tub|razor|basin"],
t18:["sports equipment","O","equipment|ball|bat|racket|racquet|club|stick|glove|helmet|net|sport|goal|puck|pad|board|used in"],
t19:["tv series","T","television|tv series|sitcom|series|show|broadcast|aired|episode|program|network|drama|reality"],
t20:["furniture","O","living room|furniture|sofa|couch|chair|table|lamp|television|rug|carpet|shelf|fireplace|cushion|decor|room"],
t22:["villain","TO","villain|monster|antagonist|fictional|character|creature|film|demon|mythical|legend|horror"],
t23:["party","*","birthday|party|cake|balloon|gift|present|candle|game|celebrat|music|food|hat"],
t24:["game","O","game|play|played|playground|children|outdoor|ball|tag|sport|activity|swing|slide|hopscotch|jump"],
t25:["craft","O","craft|art|paper|glue|paint|fabric|yarn|bead|scissors|marker|crayon|ribbon|thread|clay|glitter|tape|material|supply|pencil"],
t26:["olympic sport","O","olympic|event|sport|race|competition|athlet|track|field|swimming|gymnast|game|discipline|medal"],
t27:["cinema","*","cinema|theater|theatre|film|movie|popcorn|screen|seat|ticket|snack|projector|candy|drink"],
t28:["fairy tale","TO","fairy tale|nursery rhyme|fairy|tale|folk|story|character|fictional|grimm|andersen|legend|fable|mother goose"],
t29:["furniture","O","bed|bedroom|sleep|pillow|blanket|furniture|closet|wardrobe|dresser|lamp|mattress|sheet|room|clothes|alarm"],
t30:["cleaning","O","clean|cleaning|wash|soap|detergent|brush|mop|broom|sponge|vacuum|dust|bleach|cloth|wipe|scrub|household"],
t31:["costume","*","costume|halloween|character|monster|ghost|witch|fictional|disguise|creature"],
t32:["furniture","O","furniture|chair|table|sofa|couch|bed|desk|cabinet|shelf|seat|dresser|stool|bench|wardrobe|ottoman|piece"]
};
var SKIPW={something:1,somewhere:1,find:1,found:1,"you'd":1,youd:1,name:1,names:1,type:1,types:1,kind:1,kinds:1,famous:1,word:1,words:1,thing:1,things:1,common:1,could:1,that:1,with:1,your:1,from:1,part:1,piece:1,used:1,goes:1,before:1,person:0};
function stemRe(list){
  var parts=list.filter(Boolean).map(function(s){ s=String(s).toLowerCase(); var lit=s.indexOf("\\")>=0?s:s.replace(/[.*+?^${}()[\]|]/g,"\\$&"); return s.length<=4?lit+"(?:s|es)?\\b":lit; });
  return parts.length?new RegExp("\\b(?:"+parts.join("|")+")","i"):null;
}
var HCACHE={};
/* the hints of a category ({id, text} from bank.js; an unknown category gets the words of its own name and takes anything) */
function hintsOf(cat){
  cat=cat||{}; var id=cat.id||"", key=id||cat.text||"";
  if(HCACHE[key]) return HCACHE[key];
  var h=H[id]||["","*",""], own=E.words(cat.text||"").filter(function(w){ return w.length>=4&&!SKIPW[w]; });
  var list=H[id]?String(h[2]).split("|"):own, q=h[0]||own[0]||"";   // a listed category uses its own hints only ("city" alone would let Boston in as a European city)
  return (HCACHE[key]={q:q,acc:h[1],re:stemRe(list),words:list});
}

/* ---------- small text helpers ---------- */
function stripTags(s){ return String(s||"").replace(/<[^>]*>/g,"").replace(/&quot;/g,"\"").replace(/&#0?39;/g,"'").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">"); }
/* the pronunciation and other bracket asides in a Wikipedia lead ("Zebras (US: /ˈziːbrəz/; …) are …") */
function tidy(s){
  s=String(s||"").replace(/\s+/g," ").trim();
  for(var i=0;i<3;i++) s=s.replace(/\s*\(([^()]*)\)/g,function(m,x){ return /\b(1[0-9]{3}|20[0-9]{2})\b/.test(x)&&!/[\/ˈ]/.test(x)?m:""; });   // asides go (pronunciations, Latin names, "often shortened to …"); dates stay ("(1847 – 1931)")
  return s.replace(/\s+([,.;:])/g,"$1").replace(/\s{2,}/g," ").trim();
}
function sentences(s){ return tidy(s).replace(/([.!?])\s+(?=[A-Z0-9“"'(])/g,"$1\u0001").split("\u0001").map(function(x){ return x.trim(); }).filter(Boolean); }
function clip(s,n){ s=String(s||"").trim(); n=n||240; if(s.length<=n) return s; var c=s.slice(0,n), sp=c.lastIndexOf(" "); return (sp>n*.6?c.slice(0,sp):c).replace(/[,;:\s]+$/,"")+"…"; }
function fold(s){ return E.fold(s); }
function bare(t){ return fold(String(t||"").replace(/\s*\([^)]*\)\s*/g," ")); }
/* a title names the answer: every word of the answer is in the title (plurals aside), and the title has at most one more word */
function titleMatch(title,raw){
  var tw=bare(title).split(" ").filter(Boolean), aw=E.words(raw); if(!tw.length||!aw.length) return false;
  var tc=tw.join("");
  if(tw.length>aw.length+1) return false;
  return aw.every(function(w){ var s=w.length>3&&/s$/.test(w)?w.slice(0,-1):w; return tc.indexOf(w)>=0||tc.indexOf(s)>=0; });
}
function exactTitle(title,raw){ return bare(title)===fold(raw)||E.pluralSame(bare(title),E.keyOf(raw)); }
function classesOf(text){ var out=""; CLSORDER.split("").forEach(function(c){ if(CLS[c].test(text)) out+=c; }); return out; }

/* ---------- the network: one GET of JSON, 4 s, never throws past its promise ---------- */
var net={fetch:null, timeout:TIMEOUT};   // tests replace net.fetch (null = the page's fetch)
function online(){ try{ return !(g.navigator&&g.navigator.onLine===false); }catch(e){ return true; } }
function getJSON(url){
  var f=net.fetch||(typeof g.fetch==="function"?g.fetch.bind(g):null);
  if(!f||!online()) return Promise.reject(new Error("offline"));
  return new Promise(function(res,rej){
    var ac=null; try{ ac=typeof AbortController==="function"?new AbortController():null; }catch(e){}
    var done=false, t=setTimeout(function(){ if(done) return; done=true; try{ if(ac) ac.abort(); }catch(e){} rej(new Error("timeout")); },net.timeout);
    var p; try{ p=f(url,ac?{signal:ac.signal}:{}); }catch(e){ p=Promise.reject(e); }
    Promise.resolve(p).then(function(r){
      if(!r) throw new Error("no response");
      if(r.status===404) return {__nf:true};
      if(!r.ok) throw new Error("http "+r.status);
      return r.json();
    }).then(function(j){ if(done) return; done=true; clearTimeout(t); res(j); },function(e){ if(done) return; done=true; clearTimeout(t); rej(e); });
  });
}
/* a promise that never rejects: {ok:true, v} or {ok:false, e} */
function settle(p){ return Promise.resolve(p).then(function(v){ return {ok:true,v:v}; },function(e){ return {ok:false,e:String(e&&e.message||e)}; }); }
function wikiTitle(raw){ var s=String(raw||"").trim().replace(/\s+/g," "); return encodeURIComponent(s.charAt(0).toUpperCase()+s.slice(1)).replace(/%20/g,"_"); }
function summary(title){ return getJSON(WIKI+"/api/rest_v1/page/summary/"+(/%/.test(title)?title:wikiTitle(title))+"?redirect=true"); }
function search(q){ return getJSON(WIKI+"/w/api.php?action=query&list=search&format=json&origin=*&srlimit=6&srprop=snippet&srsearch="+encodeURIComponent(q)); }
/* the dictionary: Wiktionary's definitions (en.wiktionary.org REST); dictionaryapi.dev only when Wiktionary does not answer.
   Never rejects: {s:"ok"|"none"|"fail", items} */
function dictionary(w,raw){
  w=String(w).toLowerCase();
  return getJSON(WIKT+encodeURIComponent(w)).then(function(j){ return wiktItems(j,raw); },function(){
    return getJSON(DICT+encodeURIComponent(w)).then(function(j){ var it=dictItems(j,raw); return {s:it.length?"ok":"none",items:it}; },function(){ return {s:"fail",items:[]}; });
  }).then(null,function(){ return {s:"fail",items:[]}; });
}
function wiktItems(j,raw){
  if(!j||j.__nf||!Array.isArray(j.en)) return {s:"none",items:[]};
  var out=[];
  j.en.forEach(function(m){ (m.definitions||[]).forEach(function(d){ var t=stripTags(d&&d.definition).replace(/\s+/g," ").trim(); if(t&&out.length<8) out.push({src:"Wiktionary",title:String(raw),desc:"",text:t,pos:m.partOfSpeech||"",url:"https://en.wiktionary.org/wiki/"+encodeURIComponent(String(raw).toLowerCase()),match:true}); }); });
  return {s:out.length?"ok":"none",items:out};
}
function muse(w){ return getJSON(MUSE+"?md=df&max=3&sp="+encodeURIComponent(String(w).toLowerCase())); }

/* ---------- evidence items: {src, title, desc, text, url, kind} ---------- */
function wikiItem(j,raw){
  if(!j||j.__nf||!j.title) return null;
  var url=(j.content_urls&&j.content_urls.desktop&&j.content_urls.desktop.page)||(WIKI+"/wiki/"+encodeURIComponent(String(j.title).replace(/ /g,"_")));
  return {src:"Wikipedia",title:j.title,desc:j.description||"",text:j.extract||"",url:url,dis:j.type==="disambiguation",match:titleMatch(j.title,raw)||titleMatch(j.title.replace(/s$/,""),raw)};
}
function dictItems(j,raw){
  var out=[]; if(!Array.isArray(j)) return out;
  j.slice(0,2).forEach(function(en){ (en.meanings||[]).forEach(function(m){ (m.definitions||[]).slice(0,3).forEach(function(d){ if(d&&d.definition) out.push({src:"dictionaryapi.dev",title:en.word||raw,desc:"",text:d.definition,pos:m.partOfSpeech||"",url:(en.sourceUrls&&en.sourceUrls[0])||"",match:true}); }); }); });
  return out.slice(0,8);
}
function museItems(j,raw){
  if(!Array.isArray(j)||!j.length) return {exact:false,freq:0,items:[]};
  var hit=j.filter(function(x){ return x&&fold(x.word)===fold(raw); })[0]; if(!hit) return {exact:false,freq:0,items:[]};
  var f=0; (hit.tags||[]).forEach(function(t){ var m=/^f:([0-9.]+)/.exec(t); if(m) f=+m[1]; });
  var items=(hit.defs||[]).slice(0,4).map(function(d){ var p=String(d).split("\t"); return {src:"WordNet (Datamuse)",title:hit.word,desc:"",text:(p[1]||p[0]||"").replace(/^\(\w+\)\s*/,""),pos:p[0],url:"",match:true}; });
  return {exact:true,freq:f,items:items};
}
function lead(it){ return (it.desc?it.desc+". ":"")+sentences(it.text).slice(0,2).join(" ")+" "+it.title; }
function fits(it,h){ return !!(h.re&&h.re.test(lead(it))); }
/* the sentence to quote: the first one that uses a hint word (for a fit), else the first one */
function quoteOf(it,h){
  var ss=sentences(it.text); if(!ss.length) return it.desc?it.desc+".":"";
  var pick=ss[0]; if(h&&h.re) for(var i=0;i<Math.min(ss.length,3);i++) if(h.re.test(ss[i])){ pick=ss[i]; break; }
  if(it.src!=="Wikipedia"){ pick=pick.charAt(0).toUpperCase()+pick.slice(1); if(!/[.!?…]$/.test(pick)) pick+="."; }
  return clip(pick,240);
}
function citeOf(it){ return it.src==="Wikipedia"?"Wikipedia, “"+it.title+"”":it.src==="Wiktionary"?"Wiktionary (dictionary), “"+it.title+"”":it.src==="dictionaryapi.dev"?"Dictionary (dictionaryapi.dev), “"+it.title+"”":"WordNet via Datamuse, “"+it.title+"”"; }
function listName(cat){ return String(cat&&cat.text||"this category"); }

/* ---------- the ruling ---------- */
var CACHE={}, stats={calls:0,offline:0,fails:0};
/* q: {raw, cat:{id,text}, letter, why ("word"|"fit"|"letter"|"dup"|"memory"|"human"), inHere, elsewhere:[category names], madeUp,
       startsOk, trick:{word, rest} | null, dup:{name, raw, p, k} | null} */
function research(q){
  stats.calls++;
  var t0=Date.now();
  return new Promise(function(resolve){
    var over=false, cap=setTimeout(function(){ finish(offlineRuling(q,"time")); },CAP);
    function finish(r){ if(over) return; over=true; clearTimeout(cap); r.ms=Date.now()-t0; resolve(r); }
    try{
      if(q.dup){ finish(dupRuling(q)); return; }
      var ck=(q.cat&&q.cat.id||"")+"|"+fold(q.raw)+"|"+(q.trick?"t":"");
      if(CACHE[ck]){ var c=JSON.parse(JSON.stringify(CACHE[ck])); c.cached=true; finish(c); return; }
      lookUp(q).then(function(r){ if(!r.offline&&r.v!=="vote") CACHE[ck]=r; finish(r); },function(e){ stats.fails++; finish(offlineRuling(q,"error")); });
    }catch(e){ stats.fails++; finish(offlineRuling(q,"error")); }
  });
}
function lookUp(q){
  var raw=String(q.raw||"").trim(), h=hintsOf(q.cat), aw=E.words(raw), one=aw.length===1;
  var pDict=one?dictionary(aw[0],raw):Promise.resolve({s:"skip",items:[]});   // asked at once, waited for only when it is needed
  return Promise.all([settle(summary(raw)),settle(search((raw+" "+h.q).trim())),null,settle(muse(aw.join(" ")))]).then(function(r){
    var S={wiki:r[0].ok||r[1].ok?(r[0].ok&&r[0].v&&!r[0].v.__nf||r[1].ok&&r[1].v&&r[1].v.query&&r[1].v.query.search&&r[1].v.query.search.length?"ok":"none"):"fail",
           dict:"skip", muse:r[3].ok?"ok":"fail"};
    var items=[], direct=r[0].ok?wikiItem(r[0].v,raw):null;
    if(direct&&direct.match&&!direct.dis) items.push(direct);
    // the search: titles that name the answer, the ones whose snippet uses a hint word first
    var hits=[];
    if(r[1].ok&&r[1].v&&r[1].v.query&&Array.isArray(r[1].v.query.search)){
      r[1].v.query.search.forEach(function(s,i){
        if(!s||!s.title||!titleMatch(s.title,raw)||/\(disambiguation\)/i.test(s.title)) return;
        if(direct&&bare(direct.title)===bare(s.title)) return;
        var sn=stripTags(s.snippet); hits.push({title:s.title,score:(h.re&&h.re.test(s.title+" "+sn)?10:0)-i});
      });
    }
    hits.sort(function(a,b){ return b.score-a.score; });
    var exists=!!(direct&&direct.match)||hits.length>0;
    return Promise.all(hits.slice(0,2).map(function(x){ return settle(summary(x.title)); })).then(function(r2){
      r2.forEach(function(x){ if(x.ok){ var it=wikiItem(x.v,raw); if(it&&it.match&&!it.dis) items.push(it); } });
      var mu=r[3].ok?museItems(r[3].v,raw):{exact:false,items:[]};
      if(mu.exact) exists=true;
      if(r[3].ok) S.muse=mu.exact?"ok":"none";                                    // "found" = the source has this answer, not just that it replied
      if(S.wiki!=="fail") S.wiki=(items.length||(direct&&direct.match))?"ok":"none";
      // a source already shows the fit: the ruling does not wait for the dictionary
      if(!q.trick&&items.concat(mu.items).some(function(it){ return fits(it,h); })) return judge(q,h,items.concat(mu.items),true,S);
      return pDict.then(function(d){ if(one) S.dict=d.s; if(d.items.length) exists=true; return judge(q,h,items.concat(d.items,mu.items),exists,S); });
    });
  });
}
function srcList(q,S){
  var bank=q.inHere?"in this category":(q.elsewhere&&q.elsewhere.length?"in another category":"not listed");
  var w=function(s){ return s==="ok"?"found":s==="none"?"no entry":s==="skip"?"":"no answer"; }, out=[];
  out.push({n:"Wikipedia",s:w(S.wiki)}); if(S.dict!=="skip") out.push({n:"Dictionary",s:w(S.dict)}); out.push({n:"Datamuse",s:w(S.muse)}); out.push({n:"Game lists",s:bank});
  return out;
}
function judge(q,h,items,exists,S){
  var raw=String(q.raw).trim(), cat=listName(q.cat), L=String(q.letter||"").toUpperCase(), src=srcList(q,S);
  var allFail=S.wiki==="fail"&&(S.dict==="fail"||S.dict==="skip")&&S.muse==="fail";
  if(allFail) return offlineRuling(q,"offline");
  var fit=null; items.some(function(it){ if(fits(it,h)){ fit=it; return true; } return false; });
  var primary=items.filter(function(it){ return it.src==="Wikipedia"; })[0]||items[0]||null;
  var base={src:src,offline:false};
  // a letter that comes from an added word: only a real name that starts with the letter as a whole counts ("Big Ben" yes, "Big Dog" no)
  if(q.trick){
    var whole=items.filter(function(it){ return it.src==="Wikipedia"&&exactTitle(it.title,raw); })[0];
    if(whole&&fits(whole,h)) return mk(base,"good","“"+raw+"” is a real name that starts with "+L+", and it fits "+cat+".",quoteOf(whole,h),citeOf(whole),whole.url);
    return mk(base,"bad","The "+L+" comes from the added word “"+q.trick.word+"”. Without it the answer is “"+q.trick.rest+"”, which doesn't start with "+L+".","","Game rules: the answer itself must start with the letter","");
  }
  if(fit) return mk(base,"good","“"+raw+"” for "+cat+" counts.",quoteOf(fit,h),citeOf(fit),fit.url);
  if(q.inHere) return mk(base,"good","“"+raw+"” for "+cat+" counts: it is on the game's own answer list for this category.","","The game's answer list (bank.js)","");
  if(exists&&primary){
    var cls=classesOf(primary.desc||sentences(primary.text)[0]||"");
    if(h.acc!=="*"&&cls&&!cls.split("").some(function(c){ return h.acc.indexOf(c)>=0; })){
      var c0=cls.charAt(0);
      var r=mk(base,"bad","“"+raw+"” doesn't fit "+cat+": the source says it is "+CLSNAME[c0]+".",quoteOf(primary,null),citeOf(primary),primary.url); r.cls=c0; return r;
    }
    return mk(base,"vote","The sources know “"+raw+"”, but they don't show that it fits "+cat+". Too close to call: vote on it.",quoteOf(primary,null),citeOf(primary),primary.url);
  }
  if(exists) return mk(base,"vote","“"+raw+"” is in the word lists, but no source says what it is. Too close to call: vote on it.","","","");
  var answered=S.wiki!=="fail"&&S.muse!=="fail";   // Wikipedia and the word list both answered (the dictionary may be down)
  if(answered&&(E.words(raw).length===1||q.madeUp)&&!(q.elsewhere&&q.elsewhere.length))
    return mk(base,"bad","“"+raw+"” isn't a real word or name: Wikipedia, the dictionary and the word list have no entry for it.","","Wikipedia, dictionaryapi.dev and Datamuse","");
  return mk(base,"vote","No source could confirm “"+raw+"”. Vote on it.","","","");
}
function mk(base,v,lead,quote,cite,url){ return {v:v,lead:lead,quote:quote||"",cite:cite||"",url:url||"",src:base.src,offline:!!base.offline}; }
/* offline, no fetch, all sources failed or the time ran out: the game's own lists, then the vote */
function offlineRuling(q,why){
  stats.offline++;
  var raw=String(q.raw).trim(), cat=listName(q.cat), L=String(q.letter||"").toUpperCase();
  var note=why==="skip"?"The lookup was skipped, so this ruling uses the game's own lists. ":why==="time"?"The lookup took too long, so this ruling uses the game's own lists. ":"Couldn't reach the online sources, so this ruling uses the game's own lists. ";
  var base={src:[{n:"Wikipedia",s:"no answer"},{n:"Dictionary",s:"no answer"},{n:"Datamuse",s:"no answer"},{n:"Game lists",s:q.inHere?"in this category":(q.elsewhere&&q.elsewhere.length?"in another category":"not listed")}],offline:true};
  if(q.dup) return dupRuling(q);
  if(q.trick) return mk(base,"bad",note+"The "+L+" comes from the added word “"+q.trick.word+"”. Without it the answer is “"+q.trick.rest+"”, which doesn't start with "+L+".","","Game rules: the answer itself must start with the letter","");
  if(q.inHere) return mk(base,"good",note+"“"+raw+"” is on the answer list for "+cat+", so it counts.","","","");
  if(q.madeUp) return mk(base,"bad",note+"“"+raw+"” doesn't look like a real word (no vowel, a long jumble or the same letter three times).","","The game's word check","");
  if(q.elsewhere&&q.elsewhere.length) return mk(base,"vote",note+"They know “"+raw+"” only as "+q.elsewhere[0]+", not as "+cat+". Vote on it.","","","");
  return mk(base,"vote",note+"They don't have “"+raw+"”. Vote on it.","","","");
}
function dupRuling(q){
  var d=q.dup, r=mk({src:[{n:"Game rules",s:"same answer"}],offline:false},"bad","“"+q.raw+"” is the same answer as "+d.name+"’s “"+d.raw+"”, so neither scores.","","Game rules: an answer someone else wrote scores nothing","");
  r.dupOf={p:d.p,k:d.k}; return r;
}

Sc.Research={research:research,offline:offlineRuling,hintsOf:hintsOf,classesOf:classesOf,titleMatch:titleMatch,tidy:tidy,sentences:sentences,net:net,stats:stats,H:H,CLSNAME:CLSNAME,TIMEOUT:TIMEOUT,
  clearCache:function(){ CACHE={}; }};
if(typeof module!=="undefined"&&module.exports) module.exports=Sc.Research;
})(typeof window!=="undefined"?window:globalThis);
