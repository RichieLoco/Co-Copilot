import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// API URLs route through the local proxy (Vite in dev, Express in prod)
// to bypass browser CORS restrictions on models.github.ai and api.github.com
const CATALOG_URL = "/api/models/catalog/models";
const INFERENCE_URL = "/api/models/inference/chat/completions";
const GH_API = "/api/gh";
const API_VER = "2022-11-28";
const PAT_URL = "https://github.com/settings/personal-access-tokens/new";

// Storage helpers — use localStorage for self-hosted deployment.
// Wrapped in async to keep API parity with the artifact's window.storage.
async function sGet(k,fb){try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;}}
async function sSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){console.error("Storage:",e);}}
async function sDel(k){try{localStorage.removeItem(k);}catch{}}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);

// ─── Syntax Highlighting ───
const KW=new Set(["const","let","var","function","return","if","else","for","while","do","switch","case","break","continue","class","extends","import","export","from","default","new","this","try","catch","finally","throw","async","await","yield","of","in","typeof","instanceof","void","delete","super","static","get","set","true","false","null","undefined","def","self","print","elif","except","raise","with","as","pass","lambda","None","True","False","int","str","float","bool","list","dict","tuple","fn","pub","mod","use","impl","struct","enum","trait","match","mut","ref","crate","type","interface","readonly","declare","namespace","abstract","public","private","protected","package","final"]);
function hl(code){const e=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");let r=e(code);r=r.replace(/(\/\/.*$|#.*$)/gm,'<span class="hc">$1</span>');r=r.replace(/(\/\*[\s\S]*?\*\/)/g,'<span class="hc">$1</span>');r=r.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`])*`)/g,'<span class="hs">$1</span>');r=r.replace(/\b(\d+\.?\d*)\b/g,'<span class="hn">$1</span>');KW.forEach(k=>{r=r.replace(new RegExp(`\\b(${k})\\b`,"g"),'<span class="hk">$1</span>');});return r;}

// ─── Markdown ───
function parseBlocks(text){if(!text)return[];const blocks=[],lines=text.split("\n");let i=0;while(i<lines.length){const l=lines[i],cm=l.match(/^```(\w*)/);if(cm){const lang=cm[1]||"text",cl=[];i++;while(i<lines.length&&!lines[i].startsWith("```")){cl.push(lines[i]);i++;}blocks.push({t:"code",lang,c:cl.join("\n")});i++;continue;}if(l.startsWith("### ")){blocks.push({t:"h3",c:l.slice(4)});i++;continue;}if(l.startsWith("## ")){blocks.push({t:"h2",c:l.slice(3)});i++;continue;}if(l.startsWith("# ")){blocks.push({t:"h1",c:l.slice(2)});i++;continue;}if(l.match(/^\s*[-*]\s/)){const it=[l.replace(/^\s*[-*]\s/,"")];i++;while(i<lines.length&&lines[i].match(/^\s*[-*]\s/)){it.push(lines[i].replace(/^\s*[-*]\s/,""));i++;}blocks.push({t:"ul",items:it});continue;}if(l.match(/^\s*\d+\.\s/)){const it=[l.replace(/^\s*\d+\.\s/,"")];i++;while(i<lines.length&&lines[i].match(/^\s*\d+\.\s/)){it.push(lines[i].replace(/^\s*\d+\.\s/,""));i++;}blocks.push({t:"ol",items:it});continue;}blocks.push({t:"p",c:l});i++;}return blocks;}
function inl(t){if(!t)return t;return t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/`([^`]+)`/g,'<code class="ic">$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener" class="ml">$1</a>');}

function CB({lang,content}){const[cp,sC]=useState(false);return(<div className="cb"><div className="cbh"><span className="cbl">{lang}</span><button className="cbc" onClick={()=>{navigator.clipboard.writeText(content);sC(true);setTimeout(()=>sC(false),2e3);}}>{cp?"✓ Copied":"Copy"}</button></div><pre className="cbp"><code dangerouslySetInnerHTML={{__html:hl(content)}}/></pre></div>);}
function Md({text}){return(<div>{parseBlocks(text).map((b,i)=>{if(b.t==="code")return <CB key={i} lang={b.lang} content={b.c}/>;if(b.t==="h1")return <h1 key={i} className="mh1">{b.c}</h1>;if(b.t==="h2")return <h2 key={i} className="mh2">{b.c}</h2>;if(b.t==="h3")return <h3 key={i} className="mh3">{b.c}</h3>;if(b.t==="ul")return <ul key={i} className="mli">{b.items.map((it,j)=><li key={j} dangerouslySetInnerHTML={{__html:inl(it)}}/>)}</ul>;if(b.t==="ol")return <ol key={i} className="mli">{b.items.map((it,j)=><li key={j} dangerouslySetInnerHTML={{__html:inl(it)}}/>)}</ol>;if(b.c?.trim()==="")return <div key={i} style={{height:8}}/>;return <p key={i} className="mp" dangerouslySetInnerHTML={{__html:inl(b.c)}}/>;})}</div>);}

// ─── Setup Guide Modal ───
function SetupGuide({onClose,onToken}){
  const[tok,setTok]=useState("");
  return(
    <div className="ov" onClick={onClose}><div className="mdl setup" onClick={e=>e.stopPropagation()}>
      <div className="mdh"><h2>Welcome to Co-Copilot</h2><button className="ib" onClick={onClose}>×</button></div>
      <p className="setup-sub">A multi-model chat interface for your GitHub Copilot subscription</p>

      <div className="setup-step">
        <div className="step-num">1</div>
        <div className="step-body">
          <h3>Create a Fine-Grained Personal Access Token</h3>
          <p>The GitHub Models API requires a <strong>Fine-Grained PAT</strong> (not a Classic token — Classic tokens don't have the required permissions).</p>
          <a href={PAT_URL} target="_blank" rel="noopener" className="step-link">→ Open Fine-Grained Token Settings</a>
          <div className="step-tip">
            <strong>Setup steps:</strong><br/>
            • Name it <strong>"Co-Copilot"</strong> and set an expiration (e.g. 90 days)<br/>
            • Repository access: <strong>Public Repositories (read-only)</strong><br/>
            • Expand <strong>"Account permissions"</strong> (not Repository permissions)<br/>
            • Set <strong>Models → Read-only</strong> (required for chat & model list)<br/>
            • Set <strong>Plan → Read-only</strong> (optional, enables premium request usage tracking)<br/>
            • Click <strong>Generate token</strong> and copy it immediately — GitHub only shows it once
          </div>
        </div>
      </div>

      <div className="setup-step">
        <div className="step-num">2</div>
        <div className="step-body">
          <h3>Paste your token here</h3>
          <input type="password" value={tok} onChange={e=>setTok(e.target.value)} placeholder="github_pat_xxxxxxxxxxxx" className="fi mono" style={{marginTop:6}}/>
          <p className="step-small">Your token is stored locally on this device and never sent anywhere except GitHub's API.</p>
        </div>
      </div>

      <div className="setup-step">
        <div className="step-num">3</div>
        <div className="step-body">
          <h3>That's it</h3>
          <p>Co-Copilot will automatically fetch the models available on your Copilot plan, detect your username, and load your premium request usage.</p>
        </div>
      </div>

      <button className="pb1 full" disabled={!tok.trim()} onClick={()=>{onToken(tok.trim());onClose();}} style={{marginTop:12,opacity:tok.trim()?1:0.4}}>Connect to GitHub →</button>
    </div></div>
  );
}

// ─── Main App ───
export default function App(){
  const[token,setToken]=useState("");
  const[username,setUsername]=useState("");
  const[sysPrompt,setSysPrompt]=useState("You are a helpful assistant. Format code in markdown code blocks with language tags.");
  const[temp,setTemp]=useState(0.7);
  const[maxTok,setMaxTok]=useState(4096);
  const[catalog,setCatalog]=useState([]);
  const[modelId,setModelId]=useState("");
  const[loadingModels,setLoadingModels]=useState(false);
  const[usage,setUsage]=useState(null);
  const[showUsage,setShowUsage]=useState(false);
  const[projects,setProjects]=useState([]);
  const[actProjId,setActProjId]=useState(null);
  const[convos,setConvos]=useState([]);
  const[actConvoId,setActConvoId]=useState(null);
  const[msgs,setMsgs]=useState([]);
  const[input,setInput]=useState("");
  const[files,setFiles]=useState([]);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState(null);
  const[showSettings,setShowSettings]=useState(false);
  const[showSetup,setShowSetup]=useState(false);
  const[showMP,setShowMP]=useState(false);
  const[showSB,setShowSB]=useState(true);
  const[dragOver,setDragOver]=useState(false);
  const[ready,setReady]=useState(false);
  const[editProj,setEditProj]=useState(null);
  const[editName,setEditName]=useState("");

  const endRef=useRef(null),inputRef=useRef(null),fileRef=useRef(null);
  const selModel=useMemo(()=>catalog.find(m=>m.id===modelId),[catalog,modelId]);

  const mGroups=useMemo(()=>{const g={},colors={OpenAI:"#74b9ff",Anthropic:"#d4a574",Google:"#55efc4",Meta:"#a29bfe",Mistral:"#fd79a8",DeepSeek:"#00cec9",Cohere:"#e17055",Microsoft:"#0984e3"},icons={OpenAI:"●",Anthropic:"◆",Google:"◇",Meta:"▲",Mistral:"■",DeepSeek:"★",Cohere:"◈",Microsoft:"⬡"};catalog.forEach(m=>{const p=m.publisher||"Other";if(!g[p])g[p]={publisher:p,color:colors[p]||"#8b949e",icon:icons[p]||"○",models:[]};g[p].models.push(m);});const order=["Anthropic","OpenAI","Google","Meta","Mistral","DeepSeek"];return Object.values(g).sort((a,b)=>(order.indexOf(a.publisher)===-1?99:order.indexOf(a.publisher))-(order.indexOf(b.publisher)===-1?99:order.indexOf(b.publisher)));},[catalog]);

  const mColor=mGroups.find(g=>g.models.some(m=>m.id===modelId))?.color||"#8b949e";
  const mIcon=mGroups.find(g=>g.models.some(m=>m.id===modelId))?.icon||"○";

  useEffect(()=>{(async()=>{const s=await sGet("cc-settings",{});if(s.token)setToken(s.token);if(s.username)setUsername(s.username);if(s.sysPrompt)setSysPrompt(s.sysPrompt);if(s.temp!=null)setTemp(s.temp);if(s.maxTok)setMaxTok(s.maxTok);if(s.modelId)setModelId(s.modelId);const p=await sGet("cc-projects",[]);setProjects(p);if(p.length>0){setActProjId(p[0].id);const cv=await sGet(`cc-cv:${p[0].id}`,[]);setConvos(cv);if(cv.length>0){setActConvoId(cv[0].id);const m=await sGet(`cc-m:${cv[0].id}`,[]);setMsgs(m);}}setReady(true);})();},[]);

  useEffect(()=>{if(!ready)return;sSet("cc-settings",{token,username,sysPrompt,temp,maxTok,modelId});},[token,username,sysPrompt,temp,maxTok,modelId,ready]);

  // Fallback model list (used when network is blocked e.g. artifact sandbox)
  // NOTE: Anthropic/Claude models are NOT available via the GitHub Models API.
  // Claude is only accessible through Copilot's internal infrastructure (VS Code, github.com).
  // GitHub has indicated they intend to add Claude to the Models API in the future.
  const FALLBACK_MODELS = [
    {id:"openai/gpt-4.1",name:"GPT-4.1",publisher:"OpenAI",supported_input_modalities:["text","image"],supported_output_modalities:["text"],rate_limit_tier:"high"},
    {id:"openai/gpt-4.1-mini",name:"GPT-4.1 Mini",publisher:"OpenAI",supported_input_modalities:["text","image"],supported_output_modalities:["text"],rate_limit_tier:"low"},
    {id:"openai/gpt-4o",name:"GPT-4o",publisher:"OpenAI",supported_input_modalities:["text","image"],supported_output_modalities:["text"],rate_limit_tier:"high"},
    {id:"openai/gpt-4o-mini",name:"GPT-4o Mini",publisher:"OpenAI",supported_input_modalities:["text"],supported_output_modalities:["text"],rate_limit_tier:"low"},
    {id:"openai/o4-mini",name:"o4-mini",publisher:"OpenAI",supported_input_modalities:["text"],supported_output_modalities:["text"],rate_limit_tier:"custom"},
    {id:"openai/o3",name:"o3",publisher:"OpenAI",supported_input_modalities:["text","image"],supported_output_modalities:["text"],rate_limit_tier:"custom"},
    {id:"deepseek/deepseek-r1",name:"DeepSeek-R1",publisher:"DeepSeek",supported_input_modalities:["text"],supported_output_modalities:["text"],rate_limit_tier:"custom"},
    {id:"meta/llama-4-maverick-17b-128e-instruct-fp8",name:"Llama 4 Maverick",publisher:"Meta",supported_input_modalities:["text","image"],supported_output_modalities:["text"],rate_limit_tier:"high"},
    {id:"mistral-ai/mistral-small-2503",name:"Mistral Small 3.1",publisher:"Mistral AI",supported_input_modalities:["text","image"],supported_output_modalities:["text"],rate_limit_tier:"low"},
    {id:"xai/grok-3",name:"Grok 3",publisher:"xAI",supported_input_modalities:["text"],supported_output_modalities:["text"],rate_limit_tier:"custom"},
  ];
  const [usingFallback,setUsingFallback]=useState(false);

  useEffect(()=>{if(!token)return;setLoadingModels(true);setError(null);setUsingFallback(false);
    // Try live catalog first, then fall back gracefully
    fetch(CATALOG_URL,{headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${token}`,"X-GitHub-Api-Version":API_VER}})
      .then(r=>{if(!r.ok)throw new Error(`${r.status}`);return r.json();})
      .then(data=>{
        if(Array.isArray(data)){
          const chat=data.filter(m=>m.supported_output_modalities?.includes("text"));
          setCatalog(chat);
          if(!modelId&&chat.length>0){const pref=chat.find(m=>m.id==="openai/gpt-4.1")||chat[0];setModelId(pref.id);}
        }
        // Also try to get username
        fetch(`${GH_API}/user`,{headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${token}`,"X-GitHub-Api-Version":API_VER}}).then(r=>r.json()).then(d=>{if(d.login)setUsername(d.login);}).catch(()=>{});
      })
      .catch(()=>{
        // Network blocked (sandbox/CORS) — use fallback models, token is saved for deployment
        console.warn("Network blocked (sandbox). Using fallback models. Will auto-sync when self-hosted.");
        setCatalog(FALLBACK_MODELS);setUsingFallback(true);
        if(!modelId)setModelId("openai/gpt-4.1");
        // Try username separately (may also fail in sandbox)
        fetch(`${GH_API}/user`,{headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${token}`,"X-GitHub-Api-Version":API_VER}}).then(r=>r.json()).then(d=>{if(d.login)setUsername(d.login);}).catch(()=>{});
      })
      .finally(()=>setLoadingModels(false));
  },[token]);

  const fetchUsage=useCallback(()=>{if(!token||!username)return;
    fetch(`${GH_API}/users/${username}/settings/billing/premium_request/usage`,{headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${token}`,"X-GitHub-Api-Version":API_VER}}).then(r=>{if(!r.ok)throw new Error(`${r.status}`);return r.json();}).then(d=>setUsage(d)).catch(()=>setUsage({error:true}));
  },[token,username]);
  useEffect(()=>{if(token&&username)fetchUsage();},[token,username]);

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  // Project ops
  const createProj=async(name)=>{const p={id:uid(),name:name||"New Project",createdAt:Date.now(),updatedAt:Date.now()};const up=[p,...projects];setProjects(up);await sSet("cc-projects",up);await sSet(`cc-cv:${p.id}`,[]);setActProjId(p.id);setConvos([]);setActConvoId(null);setMsgs([]);return p.id;};
  const delProj=async(pid)=>{const cv=await sGet(`cc-cv:${pid}`,[]);for(const c of cv)await sDel(`cc-m:${c.id}`);await sDel(`cc-cv:${pid}`);const up=projects.filter(p=>p.id!==pid);setProjects(up);await sSet("cc-projects",up);if(actProjId===pid){if(up.length>0)switchProj(up[0].id);else{setActProjId(null);setConvos([]);setActConvoId(null);setMsgs([]);}}};
  const renameProj=async(pid,name)=>{const up=projects.map(p=>p.id===pid?{...p,name,updatedAt:Date.now()}:p);setProjects(up);await sSet("cc-projects",up);setEditProj(null);};
  const switchProj=async(pid)=>{setActProjId(pid);const cv=await sGet(`cc-cv:${pid}`,[]);setConvos(cv);if(cv.length>0){setActConvoId(cv[0].id);const m=await sGet(`cc-m:${cv[0].id}`,[]);setMsgs(m);}else{setActConvoId(null);setMsgs([]);}};

  // Convo ops
  const createConvo=async()=>{if(!actProjId){await createProj("Default Project");}const c={id:uid(),title:"New Chat",updatedAt:Date.now()};const uc=[c,...convos];setConvos(uc);await sSet(`cc-cv:${actProjId}`,uc);await sSet(`cc-m:${c.id}`,[]);setActConvoId(c.id);setMsgs([]);return c.id;};
  const switchConvo=async(cid)=>{setActConvoId(cid);const m=await sGet(`cc-m:${cid}`,[]);setMsgs(m);};
  const delConvo=async(cid)=>{await sDel(`cc-m:${cid}`);const uc=convos.filter(c=>c.id!==cid);setConvos(uc);await sSet(`cc-cv:${actProjId}`,uc);if(actConvoId===cid){if(uc.length>0)switchConvo(uc[0].id);else{setActConvoId(null);setMsgs([]);}}};
  const saveMsgs=async(ms,cid,pid)=>{await sSet(`cc-m:${cid}`,ms);const first=ms.find(m=>m.role==="user");if(first){const title=(typeof first.content==="string"?first.content:first._display||"Chat").slice(0,50);const uc=convos.map(c=>c.id===cid?{...c,title,updatedAt:Date.now()}:c);setConvos(uc);await sSet(`cc-cv:${pid}`,uc);}};

  // Files
  const f2b=f=>new Promise((r,j)=>{const rd=new FileReader();rd.onload=()=>r(rd.result.split(",")[1]);rd.onerror=j;rd.readAsDataURL(f);});
  const procFiles=async(list)=>{const nf=[];for(const f of list){const b=await f2b(f);nf.push({name:f.name,type:f.type,base64:b,preview:f.type?.startsWith("image/")?URL.createObjectURL(f):null});}setFiles(p=>[...p,...nf]);};

  // Send
  const send=async()=>{
    if((!input.trim()&&files.length===0)||loading)return;
    if(!token){setShowSetup(true);return;}
    setError(null);
    let pid=actProjId,cid=actConvoId;
    if(!pid){pid=await createProj("Default Project");}
    if(!cid){cid=await createConvo();}
    const uc=[];for(const f of files){if(f.type?.startsWith("image/"))uc.push({type:"image_url",image_url:{url:`data:${f.type};base64,${f.base64}`}});else uc.push({type:"text",text:`[File: ${f.name}]\n${atob(f.base64)}`});}
    if(input.trim())uc.push({type:"text",text:input.trim()});
    const userMsg={role:"user",content:uc.length===1&&uc[0].type==="text"?uc[0].text:uc,_display:input.trim(),_files:files.map(f=>({name:f.name,type:f.type}))};
    const updated=[...msgs,userMsg];setMsgs(updated);setInput("");setFiles([]);setLoading(true);
    const apiM=[];if(sysPrompt.trim())apiM.push({role:"system",content:sysPrompt.trim()});apiM.push(...updated.map(m=>({role:m.role,content:m.content})));
    try{
      const res=await fetch(INFERENCE_URL,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,"X-GitHub-Api-Version":API_VER},body:JSON.stringify({model:modelId,messages:apiM,max_tokens:maxTok,temperature:temp,stream:true})});
      if(!res.ok){const ed=await res.json().catch(()=>({}));throw new Error(ed.error?.message||ed.message||`HTTP ${res.status}`);}
      const reader=res.body.getReader(),dec=new TextDecoder();let aT="";setMsgs([...updated,{role:"assistant",content:"",_display:""}]);let buf="";
      while(true){const{done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});const lns=buf.split("\n");buf=lns.pop()||"";for(const ln of lns){if(!ln.startsWith("data: "))continue;const d=ln.slice(6).trim();if(d==="[DONE]")break;try{const delta=JSON.parse(d).choices?.[0]?.delta?.content;if(delta){aT+=delta;setMsgs(prev=>{const c=[...prev];c[c.length-1]={...c[c.length-1],content:aT,_display:aT};return c;});}}catch{}}}
      const final=[...updated,{role:"assistant",content:aT||"(Empty response)",_display:aT||"(Empty response)"}];setMsgs(final);await saveMsgs(final,cid,pid);
      // Auto-refresh usage stats after each successful response
      fetchUsage();
    }catch(err){const isNetwork=err.message?.includes("Failed to fetch")||err.message?.includes("NetworkError")||err.message?.includes("Load failed");setError(isNetwork?"Cannot reach proxy server. Make sure the Co-Copilot server is running.":err.message);setMsgs(prev=>{const c=[...prev];if(c[c.length-1]?.role==="assistant"&&!c[c.length-1].content)c.pop();return c;});}finally{setLoading(false);}
  };

  const actProj=projects.find(p=>p.id===actProjId);
  const totalUsage=useMemo(()=>{if(!usage?.usageItems)return null;return{total:usage.usageItems.reduce((s,i)=>s+(i.grossQuantity||0),0),cost:usage.usageItems.reduce((s,i)=>s+(i.grossAmount||0),0),items:usage.usageItems};},[usage]);

  const disconnect=()=>{setToken("");setUsername("");setCatalog([]);setModelId("");setUsage(null);};

  if(!ready)return <div style={{display:"flex",height:"100vh",alignItems:"center",justifyContent:"center",background:"#0d1117",color:"#636e7b",fontFamily:"system-ui"}}>Loading...</div>;

  return(
  <div className="root" onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault();setDragOver(false);if(e.dataTransfer.files.length)procFiles(Array.from(e.dataTransfer.files));}}>
    {showSB&&<div className="sb">
      <div className="sbh"><div className="lga"><div className="lg">C²</div><div><span className="lgt">Co-Copilot</span><span className="lgsub">for GitHub Copilot</span></div></div><button className="ib" onClick={()=>setShowSB(false)}>◀</button></div>

      {/* Connection status */}
      {token?<div className="conn-status connected">
        <span className="conn-dot green"/>
        <span className="conn-user">{username?`@${username}`:"Token saved ✓"}</span>
        <button className="conn-disc" onClick={disconnect} title="Disconnect">✕</button>
      </div>:<button className="conn-status disconnected" onClick={()=>setShowSetup(true)}>
        <span className="conn-dot red"/>
        <span>Not connected — tap to set up</span>
      </button>}

      {totalUsage&&<button className="uw" onClick={()=>setShowUsage(!showUsage)}>
        <div className="ur"><span className="ul">Premium Requests Used</span><span className="uv">{totalUsage.total.toLocaleString()}</span></div>
        <div className="ur"><span className="ul">Usage Value</span><span className="uv">${totalUsage.cost.toFixed(2)}</span></div>
        {showUsage&&totalUsage.items.map((it,i)=><div key={i} className="ud"><span>{it.model||it.sku}</span><span>{it.grossQuantity} req · ${it.grossAmount?.toFixed(2)}{it.netAmount>0?" ("+it.netAmount.toFixed(2)+" overage)":""}</span></div>)}
        {showUsage&&<div style={{fontSize:10,color:"#484f58",marginTop:4,textAlign:"center"}}>Within plan allowance · overage billed at $0.04/req</div>}
      </button>}
      {!totalUsage&&token&&<div className="uw" style={{cursor:"default"}}>
        <div className="ur"><span className="ul">Premium Requests</span><span className="uv" style={{color:"#636e7b"}}>—</span></div>
        <div style={{fontSize:11,color:"#636e7b",marginTop:4,lineHeight:1.5}}>
          {usingFallback
            ?"Live stats available when self-hosted."
            :(usage?.error?"PAT needs Plan: Read permission.":"Loading...")}
        </div>
        <a href="https://github.com/settings/billing/premium_requests_usage" target="_blank" rel="noopener" style={{display:"block",fontSize:11,color:"#6cb6ff",marginTop:6,textDecoration:"none"}}>View usage on GitHub →</a>
      </div>}

      <div className="sst"><span>Projects</span><button className="ib sm" onClick={()=>createProj("New Project")}>+</button></div>
      <div className="pl">{projects.map(p=><div key={p.id} className={`pi ${p.id===actProjId?"ac":""}`}>
        {editProj===p.id?<input className="ri" autoFocus value={editName} onChange={e=>setEditName(e.target.value)} onBlur={()=>renameProj(p.id,editName||p.name)} onKeyDown={e=>{if(e.key==="Enter")renameProj(p.id,editName||p.name);if(e.key==="Escape")setEditProj(null);}}/>
        :<button className="pb" onClick={()=>switchProj(p.id)} onDoubleClick={()=>{setEditProj(p.id);setEditName(p.name);}}><span className="pn">{p.name}</span></button>}
        <button className="db" onClick={e=>{e.stopPropagation();delProj(p.id);}}>×</button>
      </div>)}</div>

      {actProjId&&<><div className="sst"><span>Chats</span><button className="ib sm" onClick={createConvo}>+</button></div>
      <div className="cl">{convos.map(c=><div key={c.id} className={`ci ${c.id===actConvoId?"ac":""}`}>
        <button className="cvb" onClick={()=>switchConvo(c.id)}><span className="ct">{c.title}</span><span className="cd">{new Date(c.updatedAt).toLocaleDateString()}</span></button>
        <button className="db" onClick={e=>{e.stopPropagation();delConvo(c.id);}}>×</button>
      </div>)}</div></>}

      <div className="sbf"><button className="stb" onClick={()=>setShowSettings(true)}>⚙ Settings</button></div>
    </div>}

    <div className="mn">
      <div className="tb"><div className="tbl">{!showSB&&<button className="ib" onClick={()=>setShowSB(true)}>☰</button>}{actProj&&<span className="tp">{actProj.name}</span>}</div>
        <div className="tbr">
          <div style={{position:"relative"}}>
            <button className="mb" onClick={()=>setShowMP(!showMP)}><span style={{color:mColor}}>{mIcon}</span><span>{selModel?.name||modelId||"Select Model"}</span>{loadingModels&&<span className="sp"/>}<span style={{color:"#636e7b",fontSize:11}}>▾</span></button>
            {showMP&&<div className="md">{catalog.length===0&&<div className="me">{token?"No models found. Your plan may not include GitHub Models access.":"Connect your GitHub account to load models."}</div>}
              {mGroups.map(g=><div key={g.publisher}><div className="mgl" style={{color:g.color}}>{g.icon} {g.publisher}</div>
                {g.models.map(m=><button key={m.id} className={`mo ${modelId===m.id?"ac":""}`} onClick={()=>{setModelId(m.id);setShowMP(false);}}>
                  <span className="mon">{m.name}</span>
                  <span className="mbs">{m.supported_input_modalities?.includes("image")&&<span className="bg vi">vision</span>}{m.rate_limit_tier==="low"&&<span className="bg pr">premium</span>}</span>
                </button>)}
              </div>)}
              {usingFallback&&<div style={{padding:"8px 10px",fontSize:11,color:"#636e7b",borderTop:"1px solid rgba(255,255,255,0.06)",marginTop:6}}>⚠ Live catalog unavailable — showing fallback list. Verify token has Models: Read permission.</div>}
            </div>}
          </div>
        </div>
      </div>

      <div className="ma"><div className="mi">
        {msgs.length===0&&<div className="es">
          <div className="es-logo">C²</div>
          <h1 className="et">Co-Copilot</h1>
          <p className="ed2">Multi-model chat for GitHub Copilot</p>
          {!token?<>
            <p className="ed">Connect your GitHub account to access all the AI models included with your Copilot subscription — Claude, GPT, Gemini, Llama, and more.</p>
            <button className="pb1" onClick={()=>setShowSetup(true)}>Connect to GitHub →</button>
          </>:<>
            <p className="ed">{catalog.length} model{catalog.length!==1?"s":""} available{usingFallback?" (fallback list)":""} on your plan. Select one above and start a conversation.</p>
            {!actProjId&&<button className="pb1" onClick={()=>createProj("My Project")}>Create First Project →</button>}
          </>}
        </div>}

        {msgs.map((m,i)=><div key={i} className={`msg ${m.role}`}>
          <div className={`av ${m.role}`} style={m.role==="assistant"?{background:`linear-gradient(135deg,${mColor},${mColor}88)`}:{}}>{m.role==="user"?"U":mIcon}</div>
          <div className={`mb2 ${m.role}`}>
            {m._files?.length>0&&<div className="mf">{m._files.map((f,j)=><span key={j} className="fp">{f.type?.startsWith("image/")?"🖼":"📄"} {f.name}</span>)}</div>}
            {m.role==="user"?<div className="ut">{m._display||(typeof m.content==="string"?m.content:"")}</div>:<Md text={typeof m.content==="string"?m.content:""}/>}
          </div>
        </div>)}

        {loading&&msgs[msgs.length-1]?.role!=="assistant"&&<div className="msg assistant"><div className="av assistant" style={{background:`linear-gradient(135deg,${mColor},${mColor}88)`}}>{mIcon}</div><div className="td"><div/><div/><div/></div></div>}
        {error&&<div className="eb">⚠ {error}</div>}
        <div ref={endRef}/>
      </div></div>

      <div className="ia"><div className="ii">
        {files.length>0&&<div className="fc">{files.map((f,i)=><div key={i} className="fch">{f.type?.startsWith("image/")&&f.preview?<img src={f.preview} alt="" className="fct"/>:<span>📄</span>}<span className="fcn">{f.name}</span><button className="fcx" onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))}>×</button></div>)}</div>}
        <div className={`ib2 ${dragOver?"dov":""}`}>
          <input type="file" ref={fileRef} multiple hidden onChange={e=>{procFiles(Array.from(e.target.files));e.target.value="";}}/>
          <button className="ab" onClick={()=>fileRef.current?.click()}>⊕</button>
          <textarea ref={inputRef} value={input} onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,180)+"px";}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder={dragOver?"Drop files here...":`Message ${selModel?.name||"AI"}...`} rows={1} className="ci2"/>
          <button className={`sb2 ${(!input.trim()&&files.length===0)||loading?"dis":""}`} onClick={send} disabled={loading||(!input.trim()&&files.length===0)}>↑</button>
        </div>
        <div className="if">Co-Copilot · {selModel?.name||modelId||"No model selected"} · GitHub Copilot</div>
      </div></div>
    </div>

    {showSetup&&<SetupGuide onClose={()=>setShowSetup(false)} onToken={t=>setToken(t)}/>}

    {showSettings&&<div className="ov" onClick={()=>setShowSettings(false)}><div className="mdl" onClick={e=>e.stopPropagation()}>
      <div className="mdh"><h2>Co-Copilot Settings</h2><button className="ib" onClick={()=>setShowSettings(false)}>×</button></div>
      <label className="fd"><span className="fl">GitHub Token</span><input type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="github_pat_xxxxxxxxxxxx" className="fi mono"/><span className="fh"><a href={PAT_URL} target="_blank" rel="noopener" style={{color:"#6cb6ff"}}>Create a Fine-Grained PAT</a> — enable <code style={{color:"#e2b86b"}}>Models: Read</code> + <code style={{color:"#e2b86b"}}>Plan: Read</code> under Account permissions</span></label>
      <label className="fd"><span className="fl">System Prompt</span><textarea value={sysPrompt} onChange={e=>setSysPrompt(e.target.value)} rows={3} className="ft"/></label>
      <div className="fr"><label className="fd"><span className="fl">Temperature: {temp}</span><input type="range" min="0" max="2" step="0.1" value={temp} onChange={e=>setTemp(parseFloat(e.target.value))} className="frg"/></label>
        <label className="fd"><span className="fl">Max Tokens</span><input type="number" value={maxTok} onChange={e=>setMaxTok(parseInt(e.target.value)||4096)} className="fi"/></label></div>
      <button className="pb1 full" onClick={()=>setShowSettings(false)}>Done</button>
    </div></div>}

    <style>{`
*{box-sizing:border-box;margin:0;padding:0}
.root{display:flex;height:100vh;width:100%;background:#0d1117;color:#c9d1d9;font-family:'SF Pro Text','Segoe UI',system-ui,sans-serif;font-size:14px}
.sb{width:260px;min-width:260px;background:#0a0e14;border-right:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;overflow:hidden}
.sbh{display:flex;align-items:center;justify-content:space-between;padding:14px 14px 10px;border-bottom:1px solid rgba(255,255,255,.06)}
.lga{display:flex;align-items:center;gap:10px}
.lg{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#58a6ff,#388bfd);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;letter-spacing:-1px;font-family:'SF Pro Display',system-ui,sans-serif}
.lgt{display:block;font-size:14px;font-weight:600;color:#e6edf3;letter-spacing:-.3px}
.lgsub{display:block;font-size:10px;color:#484f58;margin-top:-1px}
.conn-status{display:flex;align-items:center;gap:8px;margin:10px 10px 4px;padding:8px 10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:7px;font-size:12px;color:#8b949e;width:calc(100% - 20px);font-family:inherit;text-align:left;cursor:default}
.conn-status.disconnected{cursor:pointer}.conn-status.disconnected:hover{background:rgba(255,255,255,.05)}
.conn-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.conn-dot.green{background:#55efc4;box-shadow:0 0 6px rgba(85,239,196,.4)}
.conn-dot.red{background:#e88388;box-shadow:0 0 6px rgba(232,131,136,.4)}
.conn-user{font-family:'JetBrains Mono',monospace;font-size:12px;color:#c9d1d9;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.conn-disc{background:none;border:none;color:#636e7b;cursor:pointer;font-size:12px;padding:2px}
.conn-disc:hover{color:#e88388}
.uw{display:block;width:calc(100% - 20px);margin:6px auto 4px;padding:10px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;cursor:pointer;font-family:inherit;color:inherit;text-align:left}
.ur{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}
.ul{font-size:11px;color:#636e7b}.uv{font-size:13px;font-weight:600;color:#e6edf3;font-family:'JetBrains Mono',monospace}
.ud{display:flex;justify-content:space-between;font-size:10px;color:#636e7b;margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,.04)}
.sst{display:flex;justify-content:space-between;align-items:center;padding:12px 14px 6px;font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#484f58;font-weight:600}
.pl,.cl{flex:1;overflow-y:auto;padding:0 8px}
.pi,.ci{display:flex;align-items:center;gap:2px;border-radius:6px;margin-bottom:2px}
.pi.ac,.ci.ac{background:rgba(255,255,255,.06)}
.pb,.cvb{flex:1;background:none;border:none;color:#c9d1d9;cursor:pointer;padding:7px 8px;text-align:left;font-family:inherit;font-size:13px;border-radius:6px;overflow:hidden}
.pb:hover,.cvb:hover{background:rgba(255,255,255,.04)}
.pn,.ct{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cd{display:block;font-size:10px;color:#484f58;margin-top:1px}
.db{background:none;border:none;color:#484f58;cursor:pointer;font-size:16px;padding:4px 6px;opacity:0;transition:opacity .15s}
.pi:hover .db,.ci:hover .db{opacity:1}.db:hover{color:#e88388}
.ri{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:4px;color:#e6edf3;padding:5px 8px;font-size:13px;font-family:inherit;outline:none}
.sbf{padding:10px;border-top:1px solid rgba(255,255,255,.06);margin-top:auto}
.stb{width:100%;padding:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:6px;color:#8b949e;cursor:pointer;font-family:inherit;font-size:13px}
.stb:hover{background:rgba(255,255,255,.06);color:#c9d1d9}
.mn{flex:1;display:flex;flex-direction:column;min-width:0}
.tb{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(13,17,23,.85);backdrop-filter:blur(12px);flex-shrink:0}
.tbl,.tbr{display:flex;align-items:center;gap:10px}
.tp{font-size:14px;font-weight:600;color:#e6edf3}
.ib{background:none;border:none;color:#8b949e;cursor:pointer;font-size:16px;padding:4px 6px;border-radius:4px}
.ib:hover{color:#e6edf3;background:rgba(255,255,255,.06)}.ib.sm{font-size:14px}
.mb{display:flex;align-items:center;gap:8px;padding:6px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#e6edf3;cursor:pointer;font-size:13px;font-family:inherit}
.mb:hover{background:rgba(255,255,255,.08)}
.md{position:absolute;top:100%;right:0;margin-top:6px;background:#161b22;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:8px;width:300px;max-height:450px;overflow-y:auto;z-index:100;box-shadow:0 16px 48px rgba(0,0,0,.5)}
.me{padding:16px;text-align:center;color:#636e7b;font-size:13px;line-height:1.5}
.mgl{padding:8px 10px 4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px}
.mo{display:flex;align-items:center;justify-content:space-between;width:100%;padding:7px 12px;background:transparent;border:none;border-radius:6px;color:#c9d1d9;cursor:pointer;font-size:13px;font-family:inherit;text-align:left}
.mo:hover{background:rgba(255,255,255,.06)}.mo.ac{background:rgba(255,255,255,.08)}
.mbs{display:flex;gap:4px}.bg{font-size:9px;padding:1px 5px;border-radius:4px}
.bg.vi{background:rgba(85,239,196,.12);color:#55efc4}.bg.pr{background:rgba(212,165,116,.12);color:#d4a574}
.sp{display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.15);border-top-color:#58a6ff;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.ma{flex:1;overflow-y:auto;padding:20px 0}.mi{max-width:780px;margin:0 auto;padding:0 20px}
.es{text-align:center;padding-top:14vh}
.es-logo{width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#58a6ff,#388bfd);display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;letter-spacing:-2px;font-family:'SF Pro Display',system-ui,sans-serif;margin-bottom:14px}
.et{font-size:24px;font-weight:700;color:#e6edf3;margin-bottom:4px}
.ed2{font-size:14px;color:#8b949e;margin-bottom:16px}
.ed{color:#636e7b;max-width:420px;margin:0 auto;line-height:1.6}
.msg{display:flex;gap:12px;margin-bottom:22px}.msg.user{flex-direction:row-reverse}
.av{width:28px;height:28px;border-radius:7px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#0d1117}
.av.user{background:linear-gradient(135deg,#6cb6ff,#388bfd)}
.mb2{flex:1;line-height:1.65}.mb2.user{max-width:75%;background:rgba(56,139,253,.07);border:1px solid rgba(56,139,253,.12);border-radius:12px;padding:10px 14px}
.mb2.assistant{padding:2px 0}.ut{white-space:pre-wrap}
.mf{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px}
.fp{font-size:11px;background:rgba(255,255,255,.05);border-radius:5px;padding:2px 7px;color:#8b949e}
.td{display:flex;gap:4px;padding:10px 0}.td div{width:7px;height:7px;border-radius:50%;background:#636e7b;animation:pulse 1.4s ease-in-out infinite}
.td div:nth-child(2){animation-delay:.2s}.td div:nth-child(3){animation-delay:.4s}
@keyframes pulse{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
.eb{margin:12px 0;padding:10px 14px;background:rgba(232,131,136,.08);border:1px solid rgba(232,131,136,.18);border-radius:8px;color:#e88388;font-size:13px}
.mh1{font-size:20px;font-weight:700;margin:16px 0 6px;color:#e6edf3}.mh2{font-size:17px;font-weight:600;margin:14px 0 5px;color:#e6edf3}.mh3{font-size:14px;font-weight:600;margin:12px 0 4px;color:#c9d1d9}
.mp{margin:5px 0;line-height:1.7}.mli{margin:6px 0;padding-left:22px}.mli li{margin:3px 0;line-height:1.65}
.ml{color:#6cb6ff;text-decoration:underline}
.ic{background:rgba(255,255,255,.07);padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono','Fira Code',Consolas,monospace;font-size:.88em;color:#e2b86b}
.cb{margin:10px 0;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.07);background:#0d1117}
.cbh{display:flex;justify-content:space-between;align-items:center;padding:7px 14px;background:rgba(255,255,255,.03);border-bottom:1px solid rgba(255,255,255,.05)}
.cbl{font-size:11px;color:#636e7b;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.8px}
.cbc{background:none;border:1px solid rgba(255,255,255,.1);color:#8b949e;cursor:pointer;padding:3px 9px;border-radius:5px;font-size:11px;font-family:inherit}
.cbc:hover{color:#e6edf3;border-color:rgba(255,255,255,.2)}
.cbp{margin:0;padding:14px 16px;overflow-x:auto;font-size:13px;line-height:1.6;font-family:'JetBrains Mono','Fira Code',Consolas,monospace}
.hc{color:#636e7b;font-style:italic}.hs{color:#a8cc8c}.hn{color:#dbab79}.hk{color:#e88388;font-weight:500}
.ia{flex-shrink:0;border-top:1px solid rgba(255,255,255,.06);padding:12px 16px;background:rgba(13,17,23,.6);backdrop-filter:blur(12px)}
.ii{max-width:780px;margin:0 auto}
.fc{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.fch{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:7px;padding:5px 9px;font-size:12px}
.fct{width:24px;height:24px;border-radius:3px;object-fit:cover}
.fcn{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c9d1d9}
.fcx{background:none;border:none;color:#636e7b;cursor:pointer;font-size:15px;padding:0;line-height:1}
.ib2{display:flex;align-items:flex-end;gap:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:9px 12px;transition:all .2s}
.ib2.dov{border:2px dashed #58a6ff;background:rgba(88,166,255,.06)}
.ab{background:none;border:none;color:#636e7b;cursor:pointer;font-size:20px;padding:2px;flex-shrink:0;line-height:1}.ab:hover{color:#c9d1d9}
.ci2{flex:1;resize:none;background:transparent;border:none;outline:none;color:#e6edf3;font-size:14px;font-family:inherit;line-height:1.5;max-height:180px;min-height:20px}
.ci2::placeholder{color:#484f58}
.sb2{background:#58a6ff;border:none;border-radius:7px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#0d1117;font-size:16px;flex-shrink:0;transition:all .2s;font-weight:700}
.sb2.dis{background:rgba(255,255,255,.05);color:#484f58;cursor:default}
.if{text-align:center;margin-top:6px;font-size:11px;color:#3b4048}
.pb1{padding:9px 22px;background:#58a6ff;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-top:16px;font-family:inherit}
.pb1:hover{filter:brightness(1.1)}.pb1.full{width:100%}
.ov{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);backdrop-filter:blur(4px)}
.mdl{background:#161b22;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:24px;width:min(480px,92vw);max-height:85vh;overflow-y:auto}
.mdl.setup{width:min(520px,92vw)}
.mdh{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.mdh h2{font-size:17px;font-weight:600;color:#e6edf3}
.setup-sub{color:#8b949e;font-size:13px;margin-bottom:18px}
.setup-step{display:flex;gap:14px;margin-bottom:18px;padding:14px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:10px}
.step-num{width:28px;height:28px;border-radius:50%;background:#58a6ff;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0}
.step-body{flex:1}.step-body h3{font-size:14px;font-weight:600;color:#e6edf3;margin-bottom:4px}
.step-body p{font-size:13px;color:#8b949e;line-height:1.5;margin-bottom:6px}
.step-link{display:inline-block;font-size:13px;color:#58a6ff;text-decoration:none;margin-bottom:6px}
.step-link:hover{text-decoration:underline}
.step-tip{font-size:12px;color:#636e7b;background:rgba(88,166,255,.06);border:1px solid rgba(88,166,255,.12);border-radius:6px;padding:8px 10px;line-height:1.5}
.step-small{font-size:11px;color:#484f58;margin-top:4px}
.alt-auth{margin-top:14px;font-size:12px;color:#636e7b}
.alt-auth summary{cursor:pointer;color:#8b949e}.alt-auth summary:hover{color:#c9d1d9}
.alt-auth p{margin-top:8px;line-height:1.5}.alt-auth a{color:#6cb6ff}
.fd{display:block;margin-bottom:14px}
.fl{display:block;font-size:12px;color:#8b949e;margin-bottom:5px;font-weight:500}
.fi,.ft{width:100%;padding:8px 12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:7px;color:#e6edf3;font-size:13px;font-family:inherit;outline:none}
.fi.mono{font-family:'JetBrains Mono',monospace}.ft{resize:vertical}
.fh{display:block;font-size:11px;color:#484f58;margin-top:3px}
.fr{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.frg{width:100%;accent-color:#58a6ff}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:3px}
::selection{background:rgba(88,166,255,.25)}
@media(max-width:700px){.sb{position:fixed;left:0;top:0;bottom:0;z-index:50;box-shadow:8px 0 32px rgba(0,0,0,.4)}}
    `}</style>
  </div>);
}
