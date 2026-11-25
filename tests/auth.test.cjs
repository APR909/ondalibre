/* SPDX-License-Identifier: MIT — OndaLibre
 * Optional Google sign-in UI and privacy regression tests.
 * Run: node tests/auth.test.cjs
 */
"use strict";
async function runAuthTests(source) {
  const results = [], client = "123-test.apps.googleusercontent.com";
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const flush = async () => { for (let i=0; i<16; i++) await Promise.resolve(); };
  const claims = (patch={}) => ({
    aud:client, iss:"https://accounts.google.com", sub:"private-subject",
    exp:Math.floor(Date.now()/1000)+600, name:"Test User", email:"test@example.invalid", ...patch
  });
  const credential = obj => "header."+Buffer.from(JSON.stringify(obj)).toString("base64url")+".signature";
  const fakeCrypto = { subtle: { async digest(_algorithm, bytes) {
    const output = new Uint8Array(32);
    for(let i=0;i<bytes.length;i++) output[i%32]=(output[i%32]*17+bytes[i])&255;
    return output.buffer;
  } } };

  function browser({preloaded=false,missingClient=false,noCrypto=false}={}) {
    const nodes={}, events=[], listeners={}, scripts=[];
    const sdkState={initializations:0,disabled:0,callback:null};
    class Element {
      constructor(name){this.name=name;this.handlers={};this.open=false;this.hidden=false;this.textContent="";this.attrs={};}
      addEventListener(type,cb){(this.handlers[type]||=[]).push(cb);}
      fire(type,event={}){for(const cb of this.handlers[type]||[])cb(event);}
      replaceChildren(){}
      setAttribute(k,v){this.attrs[k]=v;}
      contains(target){return target===this;}
      focus(){}
      remove(){}
    }
    const get=name=>nodes[name]||=(new Element(name));
    const google={accounts:{id:{
      initialize(config){sdkState.initializations++;sdkState.callback=config.callback;},
      renderButton(){},disableAutoSelect(){sdkState.disabled++;}
    }}};
    const window={ONDA_GOOGLE_CLIENT_ID:missingClient?"":client,crypto:noCrypto?null:fakeCrypto};
    if(preloaded)window.google=google;
    const document={
      getElementById:get, createElement:name=>new Element(name),
      head:{append(el){scripts.push(el);}},
      addEventListener(type,cb){(listeners[type]||=[]).push(cb);},
      dispatchEvent(event){events.push(event);}
    };
    new Function("document","window","google","crypto","atob",
      "TextEncoder","TextDecoder","CustomEvent",source)(
      document,window,google,window.crypto,
      encoded=>Buffer.from(encoded,"base64").toString("binary"),
      TextEncoder,TextDecoder,
      class{constructor(type,opts){this.type=type;this.detail=opts.detail;}}
    );
    const panel=get("authDetails");
    return {
      scripts,events,get,panel,sdkState,listeners,
      open(){panel.open=true;panel.fire("toggle");},
      sdkReady(){window.google=google;scripts.at(-1).onload();},
      async signIn(c=claims()){
        if(!sdkState.callback)throw Error("Google callback missing");
        await sdkState.callback({credential:credential(c)});await flush();
      },
      logout(){get("authSignOut").fire("click");},
      status(){return get("authStatus").textContent;}
    };
  }
  async function test(name,callback) {
    try{await callback();results.push({name,passed:true});}
    catch(e){results.push({name,passed:false,error:String(e.message||e)});}
  }
  await test("Google is not loaded before opening the panel",()=>{
    const x=browser();check(!x.scripts.length&&x.get("authUser").hidden,"Unexpected initial Google request");
  });
  await test("Google SDK is loaded and initialized once",()=>{
    const x=browser();x.open();x.open();check(x.scripts.length===1,"Multiple SDK requests");
    x.sdkReady();x.open();check(x.sdkState.initializations===1,"Multiple initializations");
  });
  await test("Invalid audience, issuer, expiry and subject are rejected",async()=>{
    const x=browser({preloaded:true});x.open();
    for(const data of [claims({aud:"wrong"}),claims({iss:"evil.invalid"}),
      claims({exp:1}),claims({sub:""})]) {
      await x.signIn(data);check(!x.events.length,"Unverified identity accepted");
    }
  });
  await test("Valid response derives 64-character pseudonymous local key",async()=>{
    const x=browser({preloaded:true});x.open();await x.signIn();
    check(x.events.length===1&&/^[0-9a-f]{64}$/.test(x.events[0].detail.accountKey),"Invalid account key");
    check(!x.events[0].detail.accountKey.includes("private-subject"),"Raw Google subject leaked");
    check(!x.get("authUser").hidden&&x.get("authName").textContent==="Test User","Profile missing");
  });
  await test("Sign-out hides profile, clears account key and disables auto-select",async()=>{
    const x=browser({preloaded:true});x.open();await x.signIn();x.logout();
    check(x.events.at(-1).detail.accountKey===null,"Auth event not cleared");
    check(x.get("authUser").hidden&&x.sdkState.disabled===1,"Sign-out UI incomplete");
  });
  await test("Malformed JWT cannot produce an authentication event",async()=>{
    const x=browser({preloaded:true});x.open();
    await x.sdkState.callback({credential:"bad.token"});await flush();
    check(!x.events.length,"Malformed credential accepted");
  });
  await test("Missing client ID prevents Google network request",()=>{
    const x=browser({missingClient:true});x.open();
    check(!x.scripts.length&&x.status().includes("pendiente"),"Unconfigured ID accepted");
  });
  await test("Unavailable WebCrypto blocks local account key",async()=>{
    const x=browser({preloaded:true,noCrypto:true});x.open();await x.signIn();
    check(!x.events.length&&x.status().includes("HTTPS"),"Missing WebCrypto accepted");
  });
  await test("Google SDK network failure reports actionable message",()=>{
    const x=browser();x.open();x.scripts[0].onerror();
    check(x.status().includes("No se pudo cargar Google"),"Missing load error");
  });
  await test("Outside click closes profile panel without changing session",()=>{
    const x=browser();x.open();
    for(const cb of x.listeners.pointerdown||[])cb({target:{}});
    check(x.panel.open===false&&x.events.length===0,"Unexpected auth change");
  });
  const failures=results.filter(x=>!x.passed);
  if(failures.length)throw Error(failures.map(x=>x.name+": "+x.error).join("\n"));
  return results;
}
if(typeof module!=="undefined"&&require.main===module){
  const fs=require("node:fs"), path=require("node:path");
  const code=fs.readFileSync(path.join(__dirname,"..","auth.js"),"utf8");
  runAuthTests(code).then(tests=>{
    for(const test of tests) console.log("PASS "+test.name);
    console.log(tests.length+" authentication tests passed.");
  }).catch(err=>{console.error(err);process.exitCode=1;});
}
