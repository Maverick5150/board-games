/* RISK — the classic world map: 42 territories, 6 continents, 83 attack routes, card symbols, board layout (1000x600).
   Territory names, bonuses and links verified against the 1959 Parker Brothers rule booklet reproduction; card symbols cross-checked across several datasets. */
(function(g){
"use strict";
var Risk=g.Risk=g.Risk||{};
// [name, continent, x, y, card symbol (I foot soldier, C horseman, A cannon)]
var T=[
 ["Alaska",0,33,88,"A"],["Northwest Territory",0,125,91,"C"],["Greenland",0,345,39,"C"],["Alberta",0,125,147,"A"],["Ontario",0,191,150,"A"],["Quebec",0,270,155,"A"],["Western United States",0,129,215,"A"],["Eastern United States",0,203,231,"A"],["Central America",0,142,302,"I"],
 ["Venezuela",1,209,352,"C"],["Peru",1,228,451,"C"],["Brazil",1,284,425,"I"],["Argentina",1,241,522,"I"],
 ["Iceland",2,386,122,"C"],["Great Britain",2,390,167,"I"],["Scandinavia",2,473,96,"I"],["Northern Europe",2,458,184,"C"],["Western Europe",2,406,237,"I"],["Southern Europe",2,476,240,"I"],["Ukraine",2,551,147,"I"],
 ["North Africa",3,425,366,"I"],["Egypt",3,494,319,"C"],["East Africa",3,544,409,"I"],["Congo",3,497,456,"A"],["South Africa",3,506,556,"A"],["Madagascar",3,590,552,"C"],
 ["Ural",4,652,135,"I"],["Siberia",4,696,74,"I"],["Yakutsk",4,790,81,"A"],["Kamchatka",4,883,81,"A"],["Irkutsk",4,774,150,"A"],["Afghanistan",4,634,217,"I"],["China",4,768,267,"A"],["Mongolia",4,787,206,"C"],["Japan",4,887,200,"C"],["Middle East",4,566,285,"A"],["India",4,690,329,"C"],["Siam",4,777,360,"C"],
 ["Indonesia",5,819,445,"I"],["New Guinea",5,915,440,"C"],["Western Australia",5,834,566,"A"],["Eastern Australia",5,895,532,"C"]
];
var CONT=[
 {name:"North America",bonus:5,color:"#c9a449",ink:"#4a3508"},
 {name:"South America",bonus:2,color:"#4fb9ab",ink:"#0c3a35"},
 {name:"Europe",bonus:5,color:"#5b86c9",ink:"#0f2650"},
 {name:"Africa",bonus:3,color:"#e08d3d",ink:"#4d2606"},
 {name:"Asia",bonus:7,color:"#6fae52",ink:"#173c0c"},
 {name:"Australia",bonus:2,color:"#9a68c4",ink:"#2c1244"}
];
var LINKS="Afghanistan|China;Afghanistan|India;Afghanistan|Middle East;Afghanistan|Ukraine;Afghanistan|Ural;Alaska|Alberta;Alaska|Kamchatka;Alaska|Northwest Territory;Alberta|Northwest Territory;Alberta|Ontario;Alberta|Western United States;Argentina|Brazil;Argentina|Peru;Brazil|North Africa;Brazil|Peru;Brazil|Venezuela;Central America|Eastern United States;Central America|Venezuela;Central America|Western United States;China|India;China|Mongolia;China|Siam;China|Siberia;China|Ural;Congo|East Africa;Congo|North Africa;Congo|South Africa;East Africa|Egypt;East Africa|Madagascar;East Africa|Middle East;East Africa|North Africa;East Africa|South Africa;Eastern Australia|New Guinea;Eastern Australia|Western Australia;Eastern United States|Ontario;Eastern United States|Quebec;Eastern United States|Western United States;Egypt|Middle East;Egypt|North Africa;Egypt|Southern Europe;Great Britain|Iceland;Great Britain|Northern Europe;Great Britain|Scandinavia;Great Britain|Western Europe;Greenland|Iceland;Greenland|Northwest Territory;Greenland|Ontario;Greenland|Quebec;Iceland|Scandinavia;India|Middle East;India|Siam;Indonesia|New Guinea;Indonesia|Siam;Indonesia|Western Australia;Irkutsk|Kamchatka;Irkutsk|Mongolia;Irkutsk|Siberia;Irkutsk|Yakutsk;Japan|Kamchatka;Japan|Mongolia;Kamchatka|Mongolia;Kamchatka|Yakutsk;Madagascar|South Africa;Middle East|Southern Europe;Middle East|Ukraine;Mongolia|Siberia;New Guinea|Western Australia;North Africa|Southern Europe;North Africa|Western Europe;Northern Europe|Scandinavia;Northern Europe|Southern Europe;Northern Europe|Ukraine;Northern Europe|Western Europe;Northwest Territory|Ontario;Ontario|Quebec;Ontario|Western United States;Peru|Venezuela;Scandinavia|Ukraine;Siberia|Ural;Siberia|Yakutsk;Southern Europe|Ukraine;Southern Europe|Western Europe;Ukraine|Ural".split(";");
var names=T.map(function(t){ return t[0]; }), idx={}; names.forEach(function(n,i){ idx[n]=i; });
var adj=names.map(function(){ return []; }), pairs=[];
LINKS.forEach(function(l){ var p=l.split("|"), a=idx[p[0]], b=idx[p[1]]; if(a==null||b==null) throw new Error("bad link "+l); adj[a].push(b); adj[b].push(a); pairs.push([a,b]); });
var continents=CONT.map(function(c,ci){ var o={name:c.name,bonus:c.bonus,color:c.color,ink:c.ink,terrs:[]}; T.forEach(function(t,i){ if(t[1]===ci) o.terrs.push(i); }); return o; });

/* landmasses for the drawn map: polygon outlines (1000x600) + which territories split each landmass */
var LAND=[
 {t:[0,1,3,4,5,6,7,8],p:[[8,72],[30,52],[70,55],[95,62],[160,56],[215,68],[255,92],[300,106],[326,124],[324,150],[302,176],[286,202],[262,216],[242,246],[224,268],[210,290],[188,302],[180,322],[186,342],[176,350],[150,338],[130,316],[102,286],[90,256],[84,232],[80,204],[86,172],[76,142],[60,130],[44,130],[24,116],[8,100]]},
 {t:[2],p:[[305,28],[340,10],[390,14],[412,38],[395,66],[368,94],[345,88],[325,62]]},
 {t:[9,10,11,12],p:[[176,356],[188,340],[216,334],[262,340],[302,370],[336,396],[326,432],[292,470],[266,520],[250,566],[236,578],[226,536],[216,490],[196,456],[190,420],[180,388]]},
 {t:[13],p:[[370,112],[395,104],[410,122],[396,140],[372,135]]},
 {t:[14],p:[[378,150],[398,148],[406,170],[398,192],[380,190],[371,166]]},
 {t:[15,16,17,18,19,26,27,28,29,30,31,32,33,35,36,37],p:[[382,250],[386,228],[398,206],[424,192],[440,172],[432,150],[440,122],[446,86],[470,58],[520,40],[570,36],[620,42],[680,32],[740,36],[800,40],[860,42],[908,62],[926,96],[918,136],[892,158],[864,184],[846,214],[842,246],[826,290],[806,330],[798,362],[802,388],[790,402],[766,386],[738,366],[718,388],[702,418],[682,382],[662,346],[648,330],[636,306],[620,320],[612,348],[590,364],[572,338],[558,322],[548,300],[536,284],[506,268],[480,272],[456,264],[426,270],[398,268]]},
 {t:[20,21,22,23,24],p:[[382,322],[402,302],[452,296],[492,292],[530,302],[546,322],[562,346],[592,376],[606,396],[582,422],[562,460],[546,502],[536,542],[522,576],[496,588],[470,562],[460,522],[446,490],[440,460],[406,442],[386,412],[376,376],[373,346]]},
 {t:[25],p:[[576,520],[600,526],[612,556],[598,586],[580,576],[573,546]]},
 {t:[34],p:[[882,172],[906,170],[916,200],[906,236],[889,246],[879,216]]},
 {t:[38],p:[[796,430],[830,424],[852,440],[846,462],[810,464],[796,450]]},
 {t:[39],p:[[882,430],[930,424],[952,440],[936,458],[896,456]]},
 {t:[40,41],p:[[806,552],[826,522],[866,506],[906,500],[932,520],[937,555],[916,586],[872,594],[832,590],[810,576]]}
];
/* sea routes drawn as double lines; [territory a, territory b, optional control offset] — routes that cross the map edge are handled by the renderer */
var SEA_WRAP=[[idx["Alaska"],idx["Kamchatka"]]];

/* ---- 1960s-style pieces and dice facts (from the 1959–68 Parker Brothers sets) ---- */
var PCOLORS=[
 {id:"red",name:"Red",c:"#d23a32",d:"#7c1712",l:"#f06a60"},
 {id:"blue",name:"Blue",c:"#2f6fcd",d:"#12356f",l:"#6aa0ee"},
 {id:"green",name:"Green",c:"#2e9a52",d:"#0f4a24",l:"#66cc88"},
 {id:"yellow",name:"Yellow",c:"#e9c322",d:"#8a6d00",l:"#fbe570"},
 {id:"black",name:"Black",c:"#34363d",d:"#0c0d10",l:"#6b6e79"},
 {id:"pink",name:"Pink",c:"#e46aa4",d:"#8e2b5e",l:"#f7a3c9"}
];
var SYM_NAMES={I:"Foot soldier",C:"Horseman",A:"Cannon",W:"Joker"};

Risk.MAP={n:T.length,names:names,idx:idx,cont:T.map(function(t){ return t[1]; }),x:T.map(function(t){ return t[2]; }),y:T.map(function(t){ return t[3]; }),sym:T.map(function(t){ return t[4]; }),
  adj:adj,pairs:pairs,continents:continents,land:LAND,seaWrap:SEA_WRAP,W:1000,H:600,PCOLORS:PCOLORS,SYM_NAMES:SYM_NAMES};
if(typeof module!=="undefined"&&module.exports) module.exports=Risk.MAP;
})(typeof window!=="undefined"?window:globalThis);
