/* Shared Monopoly deed data (factual game data) — used by the TV host and phone controllers */
window.MONO_COLORS={brown:"#8b5a2b",light_blue:"#9fd0ef",pink:"#d93a96",orange:"#f08d1c",red:"#e23b3b",yellow:"#f3d41b",green:"#1f9d54",dark_blue:"#2b4fe0"};
window.MONO_DEEDS={
 1:{n:"Mediterranean Avenue",t:"prop",g:"brown",price:60,rent:[2,10,30,90,160,250],house:50,mort:30},
 3:{n:"Baltic Avenue",t:"prop",g:"brown",price:60,rent:[4,20,60,180,320,450],house:50,mort:30},
 5:{n:"Reading Railroad",t:"rr",price:200,mort:100},
 6:{n:"Oriental Avenue",t:"prop",g:"light_blue",price:100,rent:[6,30,90,270,400,550],house:50,mort:50},
 8:{n:"Vermont Avenue",t:"prop",g:"light_blue",price:100,rent:[6,30,90,270,400,550],house:50,mort:50},
 9:{n:"Connecticut Avenue",t:"prop",g:"light_blue",price:120,rent:[8,40,100,300,450,600],house:50,mort:60},
 11:{n:"St. Charles Place",t:"prop",g:"pink",price:140,rent:[10,50,150,450,625,750],house:100,mort:70},
 12:{n:"Electric Company",t:"util",price:150,mort:75},
 13:{n:"States Avenue",t:"prop",g:"pink",price:140,rent:[10,50,150,450,625,750],house:100,mort:70},
 14:{n:"Virginia Avenue",t:"prop",g:"pink",price:160,rent:[12,60,180,500,700,900],house:100,mort:80},
 15:{n:"Pennsylvania Railroad",t:"rr",price:200,mort:100},
 16:{n:"St. James Place",t:"prop",g:"orange",price:180,rent:[14,70,200,550,750,950],house:100,mort:90},
 18:{n:"Tennessee Avenue",t:"prop",g:"orange",price:180,rent:[14,70,200,550,750,950],house:100,mort:90},
 19:{n:"New York Avenue",t:"prop",g:"orange",price:200,rent:[16,80,220,600,800,1000],house:100,mort:100},
 21:{n:"Kentucky Avenue",t:"prop",g:"red",price:220,rent:[18,90,250,700,875,1050],house:150,mort:110},
 23:{n:"Indiana Avenue",t:"prop",g:"red",price:220,rent:[18,90,250,700,875,1050],house:150,mort:110},
 24:{n:"Illinois Avenue",t:"prop",g:"red",price:240,rent:[20,100,300,750,925,1100],house:150,mort:120},
 25:{n:"B&O Railroad",t:"rr",price:200,mort:100},
 26:{n:"Atlantic Avenue",t:"prop",g:"yellow",price:260,rent:[22,110,330,800,975,1150],house:150,mort:130},
 27:{n:"Ventnor Avenue",t:"prop",g:"yellow",price:260,rent:[22,110,330,800,975,1150],house:150,mort:130},
 28:{n:"Water Works",t:"util",price:150,mort:75},
 29:{n:"Marvin Gardens",t:"prop",g:"yellow",price:280,rent:[24,120,360,850,1025,1200],house:150,mort:140},
 31:{n:"Pacific Avenue",t:"prop",g:"green",price:300,rent:[26,130,390,900,1100,1275],house:200,mort:150},
 32:{n:"North Carolina Avenue",t:"prop",g:"green",price:300,rent:[26,130,390,900,1100,1275],house:200,mort:150},
 34:{n:"Pennsylvania Avenue",t:"prop",g:"green",price:320,rent:[28,150,450,1000,1200,1400],house:200,mort:160},
 35:{n:"Short Line",t:"rr",price:200,mort:100},
 37:{n:"Park Place",t:"prop",g:"dark_blue",price:350,rent:[35,175,500,1100,1300,1500],house:200,mort:175},
 39:{n:"Boardwalk",t:"prop",g:"dark_blue",price:400,rent:[50,200,600,1400,1700,2000],house:200,mort:200}
};
/* Title-deed card HTML (same look as the single-device game). st = {h:houses, m:mortgaged} optional */
window.monoDeedHTML=function(i){
  var s=window.MONO_DEEDS[i]; if(!s) return "";
  var C=window.MONO_COLORS, light=(s.g==="yellow"||s.g==="light_blue"), band="", body="";
  var money=function(n){return "$"+n;};
  if(s.t==="prop"){
    band='<div class="deed-band'+(light?" light":"")+'" style="background:'+C[s.g]+'"><div class="deed-title">DEED</div><div class="deed-name">'+s.n+'</div></div>';
    var L=["Rent","Rent with 1 House","Rent with 2 Houses","Rent with 3 Houses","Rent with 4 Houses","Rent with HOTEL"];
    for(var k=0;k<6;k++) body+='<div class="dl"><span>'+L[k]+'</span><b>'+money(s.rent[k])+'</b></div>';
    body+='<div class="dl rule"><span>Mortgage Value</span><b>'+money(s.mort)+'</b></div>';
    body+='<div class="dl sub"><span>Houses cost</span><b>'+money(s.house)+' each</b></div>';
    body+='<div class="dl sub"><span>Hotels</span><b>'+money(s.house)+' + 4 houses</b></div>';
    body+='<div class="deed-note">If a player owns ALL the lots of this color group, the rent is doubled on unimproved lots.</div>';
  } else if(s.t==="rr"){
    band='<div class="deed-band" style="background:#1e1e1e"><div class="deed-title">DEED</div><div class="deed-name">'+s.n+'</div></div>';
    body+='<div class="icon-band">🚂</div><div class="dl"><span>Rent</span><b>$25</b></div><div class="dl"><span>If 2 Railroads are owned</span><b>$50</b></div><div class="dl"><span>If 3 Railroads are owned</span><b>$100</b></div><div class="dl"><span>If 4 Railroads are owned</span><b>$200</b></div><div class="dl rule"><span>Mortgage Value</span><b>$100</b></div>';
  } else {
    band='<div class="deed-band" style="background:#1e1e1e"><div class="deed-title">DEED</div><div class="deed-name">'+s.n+'</div></div>';
    body+='<div class="icon-band">'+(i===12?"💡":"🚰")+'</div><div class="deed-note" style="font-style:normal;font-size:13px;color:#15110a">If <b>one</b> Utility is owned, rent is <b>4×</b> the amount shown on the dice.<br>If <b>both</b> Utilities are owned, rent is <b>10×</b> the amount shown on the dice.</div><div class="dl rule"><span>Mortgage Value</span><b>$75</b></div>';
  }
  return '<div class="deed">'+band+'<div class="deed-body">'+body+'</div></div>';
};
window.MONO_DEED_CSS='.deed{background:#f4f0e3;color:#15110a;border-radius:10px;overflow:hidden;border:2px solid #00000040;margin:10px 0;box-shadow:0 4px 14px #0007;width:100%;max-width:420px;text-align:left}.deed-band{padding:9px 10px;text-align:center;color:#fff;border-bottom:2px solid #0003}.deed-band.light{color:#1a1203}.deed-title{font-size:10px;letter-spacing:2.5px;font-weight:800;opacity:.92}.deed-name{font-size:18px;font-weight:900;line-height:1.12;margin-top:1px;text-transform:uppercase}.deed-body{padding:9px 13px}.dl{display:flex;justify-content:space-between;padding:2.5px 0;font-size:13.5px}.dl b{font-weight:800}.dl.rule{border-top:1px solid #00000022;margin-top:5px;padding-top:5px}.dl.sub{color:#5a5240;font-size:12px}.deed-note{font-size:11px;color:#5a5240;margin-top:7px;text-align:center;font-style:italic;line-height:1.3}.icon-band{font-size:38px;text-align:center;padding:4px 0 8px}';
