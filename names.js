/* names.js - standard American first names for the computer players (the CEO's choice: "American names, standard names").
   518 common US first names (male, female, unisex) from the most-used names of recent decades. Built 2026-10-15.
   Names.pick(count, exclude) -> that many different names in random order, never one in exclude (case-insensitive),
   a fresh draw every call, so every game and every session gets new names. */
(function (g) {
"use strict";
var L = "Aaron|Abigail|Adam|Addison|Adeline|Adrian|Aiden|Alan|Albert|Alejandro|Alex|Alexander|Alexandra|Alexis|Alice|Allen|Allison|Alyssa|Amanda|Amber|Amy|Ana|Andrea|Andrew|Angela|Ann|Anna|Anthony|Antonio|Aria|Ariana|Arthur|Asher|Ashley|Aubrey|Audrey|Aurora|Austin|Autumn|Ava|Avery|Bailey|Barbara|Barry|Bella|Benjamin|Bennett|Bentley|Betty|Beverly|Billy|Blake|Bobby|Bonnie|Bradley|Brandon|Brayden|Brenda|Brent|Brett|Brian|Brianna|Brittany|Brody|Brooke|Brooklyn|Brooks|Bruce|Bryan|Caleb|Calvin|Cameron|Camila|Carl|Carla|Carlos|Carmen|Carol|Caroline|Carolyn|Carrie|Carter|Cassidy|Catherine|Chad|Charles|Charlotte|Chase|Chelsea|Cheryl|Chloe|Christian|Christina|Christine|Christopher|Claire|Clara|Clarence|Clifford|Cody|Cole|Colin|Colton|Connie|Connor|Cooper|Corey|Courtney|Craig|Crystal|Curtis|Cynthia|Daisy|Dale|Damian|Daniel|Danielle|Danny|Darren|David|Dawn|Dean|Deborah|Debra|Declan|Delaney|Denise|Dennis|Derek|Derrick|Destiny|Diana|Diane|Diego|Dominic|Donald|Donna|Doris|Dorothy|Douglas|Duane|Dustin|Dwight|Dylan|Earl|Easton|Edith|Eduardo|Edward|Elaine|Eleanor|Elena|Eli|Eliana|Elijah|Elizabeth|Ella|Ellie|Elliot|Emilia|Emily|Emma|Eric|Erica|Erin|Ethan|Ethel|Eugene|Eva|Evan|Evelyn|Everett|Everly|Ezra|Faith|Fernando|Florence|Frances|Francis|Frank|Fred|Frederick|Gabriel|Gabriella|Gabrielle|Garrett|Gary|Gavin|George|Gerald|Gianna|Gina|Glen|Glenn|Gloria|Gordon|Grace|Graham|Grant|Grayson|Gregory|Hailey|Haley|Hannah|Harold|Harper|Harry|Hazel|Heather|Helen|Henry|Herbert|Holly|Hope|Howard|Hudson|Hunter|Ian|Irene|Isaac|Isabel|Isabella|Isaiah|Isla|Ivy|Jace|Jack|Jackson|Jacob|Jacqueline|Jade|Jaden|Jake|James|Jamie|Jane|Janet|Janice|Jared|Jasmine|Jason|Jasper|Javier|Jaxon|Jayden|Jean|Jeffrey|Jenna|Jennifer|Jeremiah|Jeremy|Jerry|Jesse|Jessica|Jesus|Jill|Jillian|Jimmy|Joan|Jocelyn|Joe|Joel|John|Johnny|Jonah|Jonathan|Jordan|Jordyn|Jose|Joseph|Josephine|Joshua|Josiah|Joyce|Juan|Judith|Judy|Julia|Julian|Julie|Justin|Kaitlyn|Karen|Katelyn|Katherine|Kathleen|Kathryn|Kathy|Katie|Kayla|Kaylee|Keith|Kelly|Kelsey|Kendall|Kennedy|Kenneth|Kevin|Kimberly|Kristen|Kristin|Kurt|Kyle|Kylie|Lance|Landon|Larry|Laura|Lauren|Lawrence|Layla|Leah|Leo|Leon|Leonard|Leslie|Levi|Liam|Lillian|Lilly|Lily|Lincoln|Linda|Lindsay|Lisa|Lloyd|Logan|Lois|Lori|Louis|Louise|Lucas|Lucille|Lucy|Luis|Luke|Luna|Lydia|Mackenzie|Madeline|Madelyn|Madison|Makayla|Manuel|Marcus|Margaret|Maria|Mariah|Marie|Marilyn|Mario|Marjorie|Mark|Martha|Martin|Marvin|Mary|Mason|Matthew|Max|Maxwell|Maya|Mckenna|Megan|Melanie|Melissa|Mia|Micah|Michael|Michelle|Miguel|Mildred|Miles|Mitchell|Molly|Monica|Morgan|Nancy|Naomi|Natalia|Natalie|Nathan|Neil|Nicholas|Nicole|Noah|Nolan|Nora|Norma|Norman|Oliver|Olivia|Owen|Paige|Paisley|Pamela|Parker|Patricia|Patrick|Paul|Peggy|Penelope|Peter|Peyton|Philip|Phillip|Phyllis|Piper|Preston|Quinn|Rachel|Ralph|Randall|Randy|Ray|Raymond|Reagan|Rebecca|Renee|Rhonda|Ricardo|Richard|Ricky|Riley|Rita|Robert|Roberto|Robin|Rodney|Roger|Ronald|Rosa|Rose|Ross|Roy|Ruby|Russell|Ruth|Ryan|Ryder|Sabrina|Sam|Samantha|Samuel|Sandra|Sara|Sarah|Savannah|Sawyer|Scarlett|Scott|Sean|Seth|Shane|Shannon|Sharon|Shawn|Sherry|Shirley|Sierra|Silas|Skylar|Sophia|Sophie|Spencer|Stacy|Stanley|Stella|Stephanie|Stephen|Steven|Summer|Susan|Sydney|Tammy|Tara|Taylor|Teresa|Terry|Theodore|Theresa|Thomas|Tiffany|Timothy|Tina|Todd|Tony|Tracy|Travis|Trevor|Tristan|Troy|Tyler|Valentina|Valerie|Vanessa|Vernon|Veronica|Victor|Victoria|Vincent|Violet|Virginia|Vivian|Wade|Walter|Warren|Wayne|Wendy|Wesley|William|Willie|Willow|Wyatt|Xavier|Zachary|Zoe|Zoey".split("|");
function rnd(n) {
  try { var a = new Uint32Array(1); g.crypto.getRandomValues(a); return a[0] % n; }
  catch (e) { return Math.floor(Math.random() * n); }
}
function pick(count, exclude) {
  var ex = {}, out = [], guard = 0;
  (exclude || []).forEach(function (s) { if (s != null) ex[String(s).trim().toLowerCase()] = 1; });
  while (out.length < count && guard++ < count * 60) {
    var nm = L[rnd(L.length)], k = nm.toLowerCase();
    if (ex[k]) continue;
    ex[k] = 1; out.push(nm);
  }
  while (out.length < count) out.push("Player " + (out.length + 1));
  return out;
}
g.Names = { pick: pick, size: L.length, has: function (s) { return L.indexOf(String(s)) >= 0; } };
})(typeof window !== "undefined" ? window : this);
