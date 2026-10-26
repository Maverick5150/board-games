// one relay dead, one slow, one fast -> ready fires at the fast relay's time, not the slow one's
var assert=require("assert"), EventEmitter=require("events");
var delays={"wss://broker.emqx.io:8084/mqtt":"dead","wss://broker.hivemq.com:8884/mqtt":400,"wss://public.cloud.shiftr.io":30};
var t0=Date.now(), made=[], opts=[];
global.window=global; global.document={getElementById:function(){return null;},querySelector:function(){return null;}};
global.localStorage={getItem:function(){return null;},setItem:function(){}};
global.mqtt={connect:function(url,o){
  var c=new EventEmitter(); made.push(url); opts.push(o); c.pubs=0;
  c.subscribe=function(t,o2,cb){ cb&&cb(); }; c.publish=function(){ c.pubs++; }; c.end=function(){};
  var d=delays[url]; if(d==="dead") setTimeout(function(){c.emit("error",new Error("timeout"));},50); else setTimeout(function(){c.emit("connect");},d);
  return c; }};
require("../net.js");
assert.strictEqual(BGNet.BROKERS.length,3);
var readyAt=null, statuses=[];
var n=BGNet.connect("TEST1","host",{ready:function(){readyAt=Date.now()-t0;},status:function(s){statuses.push(s);}});
setTimeout(function(){
  assert(readyAt!==null,"ready must fire"); assert(readyAt<300,"ready at fast relay time, got "+readyAt);
  assert.strictEqual(made.length,3);
  assert.strictEqual(opts[2].username,"public");
  n.send({t:"x"}); // goes only to up relays
  var pubs=made.length; n.close();
  assert(statuses.indexOf("online")>=0);
  console.log("net-relays OK, ready after "+readyAt+" ms"); process.exit(0);
},200);
