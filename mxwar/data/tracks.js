/* MOTOCROSS WAR — the real track layouts: the index (packed 2026-10-17 from BG_audit/games/mxwar/track-layouts*.json by
   BG_audit/sprint/mx3d-a/pack-tracks.js; the layout format: BG_audit/games/mxwar/LAYOUT-FORMAT.md). Each season's layouts are in data/trk-<id>.js,
   loaded with the season file (game.js loadSeason); MXWarTracks.add() takes them in; need() loads one synchronously under node (tests).
   Facts traced into our own coordinates: no track-map image is used. */
(function(g){
  var D=g.MXWarTracks&&g.MXWarTracks.add?g.MXWarTracks:{format:1,layouts:[],rounds:{},byId:{},loaded:{}};
  D.packed="2026-10-17"; D.files={"mx-1974":1,"mx-1975":1,"mx-1976":2,"mx-1977":3,"mx-1978":3,"mx-1979":3,"mx-1980":3,"mx-1981":3,"mx-1982":3,"mx-1983":3,"mx-1984":3,"mx-1985":3,"mx-1986":3,"mx-1987":3,"mx-1988":3,"mx-1989":3,"mx-1990":3,"mx-1991":3,"mx-1992":3,"mx-1993":3,"mx-1994":3,"mx-1995":3,"mx-1996":3,"mx-1997":3,"mx-1998":3,"mx-1999":3,"mx-2000":3,"mx-2001":3,"mx-2002":3,"mx-2003":3,"mx-2004":3,"mx-2005":3,"mx-2006":3,"mx-2007":3,"mx-2008":3,"mx-2009":3,"mx-2010":3,"mx-2011":3,"mx-2012":3,"mx-2013":3,"mx-2014":3,"mx-2015":5,"mx-2016":5,"mx-2017":6,"mx-2018":6,"mx-2019":6,"mx-2020":5,"mx-2021":8,"mx-2022":8,"mx-2023":9,"mx-2024":9,"mx-2025":9,"mx-2026":9,"sx-1974":3,"sx-1975":4,"sx-1976":6,"sx-1977":10,"sx-1978":11,"sx-1979":12,"sx-1980":17,"sx-1981":12,"sx-1982":12,"sx-1983":16,"sx-1984":17,"sx-1985":11,"sx-1986":12,"sx-1987":14,"sx-1988":10,"sx-1989":15,"sx-1990":18,"sx-1991":18,"sx-1992":16,"sx-1993":16,"sx-1994":15,"sx-1995":15,"sx-1996":15,"sx-1997":15,"sx-1998":16,"sx-1999":16,"sx-2000":16,"sx-2001":16,"sx-2002":16,"sx-2003":16,"sx-2004":16,"sx-2005":16,"sx-2006":16,"sx-2007":16,"sx-2018":16,"sx-2021":10,"sx-2022":2,"sx-2026":16};
  D.add=function(P){ if(!P) return; (P.layouts||[]).forEach(function(L){ if(L&&L.id&&!D.byId[L.id]){ D.byId[L.id]=L; D.layouts.push(L); } }); var r=P.rounds||{}; for(var k in r) D.rounds[k]=r[k]; if(P.key) D.loaded[P.key]=1; };
  D.has=function(id){ return !!D.files[id]; };
  D.need=function(series,year){ var id=series+"-"+year; if(!D.files[id]||D.loaded[id]) return true;
    if(typeof module!=="undefined"&&module.exports&&typeof require==="function"){ try{ require(__dirname+"/trk-"+id+".js"); }catch(e){} }
    return !!D.loaded[id]; };
  g.MXWarTracks=D; if(typeof module!=="undefined"&&module.exports) module.exports=D;
})(typeof window!=="undefined"?window:globalThis);
