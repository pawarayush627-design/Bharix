"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Activity, ArrowDown, ArrowUp, AudioLines, Check, ChevronDown, CircleHelp, Copy, Download, FileText, Globe, ImagePlus, LogIn, LogOut, Menu, Mic, Moon, MoreHorizontal, Paperclip, Plus, Search, Send, Settings, Share2, Sparkles, Square, Sun, Trash2, X, Zap } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Message = { id: string; role: "user" | "assistant"; content: string; images?: string[]; createdAt: number };
type Chat = { id: string; title: string; messages: Message[]; updatedAt: number; shareUrl?: string };
const STORAGE_KEY = "bharix-chats-v1";
const CREATOR_URL = "https://www.youtube.com/@ytinspirevault";
const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<{name:string; text?:string; image?:string}[]>([]);
  const [user, setUser] = useState<any>(null);
  const [cloudStatus, setCloudStatus] = useState("Local mode");
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [toast, setToast] = useState("");
  const [showJump, setShowJump] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed: Chat[] = saved ? JSON.parse(saved) : [];
      if (parsed.length) { setChats(parsed); setActiveId(parsed[0].id); }
      else { const first = {id:uid(),title:"New chat",messages:[],updatedAt:Date.now()}; setChats([first]); setActiveId(first.id); }
      setDark(localStorage.getItem("bharix-dark") === "true");
    } catch { const first = {id:uid(),title:"New chat",messages:[],updatedAt:Date.now()}; setChats([first]); setActiveId(first.id); }
    setSpeechAvailable(Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  }, []);
  useEffect(() => { if (chats.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); }, [chats]);
  useEffect(() => { localStorage.setItem("bharix-dark", String(dark)); }, [dark]);
  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [activeId, chats, busy]);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({data}) => setUser(data.session?.user ?? null));
    const {data} = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const active = chats.find(c => c.id === activeId) || chats[0];
  const updateChat = (id:string, updater:(chat:Chat)=>Chat) => setChats(prev => prev.map(c => c.id === id ? updater(c) : c));
  const newChat = () => { const c:Chat={id:uid(),title:"New chat",messages:[],updatedAt:Date.now()}; setChats(p=>[c,...p]);setActiveId(c.id);setInput("");setFiles([]);setError("");setSidebarOpen(false); };
  const notify = (s:string) => { setToast(s); window.setTimeout(()=>setToast(""),2200); };
  const filtered = useMemo(()=>chats.filter(c=>c.title.toLowerCase().includes(search.toLowerCase()) || c.messages.some(m=>m.content.toLowerCase().includes(search.toLowerCase()))),[chats,search]);

  const persistCloud = useCallback(async (chat:Chat) => {
    if (!supabase || !user) return;
    const row = { id: chat.id, user_id:user.id, title:chat.title, messages:chat.messages, updated_at:new Date().toISOString() };
    const {error:e}=await supabase.from("chats").upsert(row);
    setCloudStatus(e ? "Cloud save error" : "Cloud synced");
  },[user]);

  const send = async (override?:string, regenerate=false) => {
    if (busy || !active) return;
    const text = (override ?? input).trim();
    if (!text && !files.length) return;
    setError("");
    const imageData = files.filter(f=>f.image).map(f=>f.image!);
    const textFiles = files.filter(f=>f.text).map(f=>`[Attached file: ${f.name}]\n${f.text}`).join("\n\n");
    const contentText = [text,textFiles].filter(Boolean).join("\n\n");
    const userMsg:Message={id:uid(),role:"user",content:contentText,images:imageData,createdAt:Date.now()};
    const existing = regenerate ? active.messages.slice(0,-1) : active.messages;
    const next = regenerate ? existing : [...existing,userMsg];
    const assistant:Message={id:uid(),role:"assistant",content:"",createdAt:Date.now()};
    const updated:Chat={...active,title:active.title==="New chat" ? (text.slice(0,42)||"Attached file") : active.title,messages:[...next,assistant],updatedAt:Date.now()};
    updateChat(active.id,()=>updated); setInput("");setFiles([]);setBusy(true);
    const apiMessages = [...next, ...(regenerate ? [] : [userMsg])].map(m=>{
      if(m.role==="user" && m.images?.length) return {role:m.role,content:[{type:"text",text:m.content||"Please describe this image."},...m.images.map(url=>({type:"image_url",image_url:{url}}))]};
      return {role:m.role,content:m.content};
    });
    const controller=new AbortController();abortRef.current=controller;
    try {
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:apiMessages,webSearch}),signal:controller.signal});
      if(!res.ok){const data=await res.json().catch(()=>({}));throw new Error(data.error||`Request failed (${res.status})`);}
      if(!res.body) throw new Error("No response stream received.");
      const reader=res.body.getReader();const decoder=new TextDecoder();let buffer="";
      while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split("\n");buffer=lines.pop()||"";
        for(const line of lines){if(!line.startsWith("data:"))continue;const raw=line.slice(5).trim();if(!raw||raw==="[DONE]")continue;try{const packet=JSON.parse(raw);const delta=packet.choices?.[0]?.delta?.content;if(typeof delta==="string"&&delta){updated.messages[updated.messages.length-1].content+=delta;updateChat(active.id,c=>({...c,messages:[...updated.messages],updatedAt:Date.now()}));}}catch{}}
      }
      const finalChat={...updated,messages:[...updated.messages],updatedAt:Date.now()};await persistCloud(finalChat);
    }catch(e:any){if(e.name!=="AbortError"){setError(e.message||"Something went wrong.");notify("Could not finish response");}}
    finally{setBusy(false);abortRef.current=null;}
  };

  const addFiles = async (list:FileList|null) => {
    if(!list)return;
    const accepted: { name: string; text?: string; image?: string }[] = [];
    for(const file of Array.from(list)){
      if(file.size>8*1024*1024){notify(`${file.name} is over 8 MB`);continue;}
      if(file.type.startsWith("image/")){const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file)});accepted.push({name:file.name,image:data});}
      else if(/\.(txt|md|csv|json|html|xml|js|ts|py|css)$/i.test(file.name)||file.type.startsWith("text/")||file.type==="application/json"){accepted.push({name:file.name,text:await file.text()});}
      else notify(`Text and image files supported; skipped ${file.name}`);
    }
    setFiles(p=>[...p,...accepted]);if(fileRef.current)fileRef.current.value="";
  };

  const signIn = async () => {
    if(!supabase){notify("Add Supabase URL and anon key to enable Google sign-in");return;}
    const {error:e}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${location.origin}/auth/callback`}});
    if(e)notify(e.message);
  };
  const signOut = async()=>{await supabase?.auth.signOut();setUser(null);notify("Signed out");};
  const exportChat = (format:"md"|"json") => {
    if(!active)return;
    const data=format==="json"?JSON.stringify(active,null,2):`# ${active.title}\n\n`+active.messages.map(m=>`## ${m.role==="user"?"You":"Bharix AI"}\n\n${m.content}`).join("\n\n---\n\n");
    const blob=new Blob([data],{type:format==="json"?"application/json":"text/markdown"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`bharix-${active.title.replace(/[^a-z0-9]+/gi,"-").toLowerCase()}.${format}`;a.click();URL.revokeObjectURL(url);
  };
  const shareChat = async () => {
    if(!active||!supabase||!user){notify("Sign in with Google and configure Supabase to create share links");return;}
    const token=uid().replaceAll("-","");
    const {error:e}=await supabase.from("chats").upsert({id:active.id,user_id:user.id,title:active.title,messages:active.messages,share_token:token,shared_at:new Date().toISOString(),updated_at:new Date().toISOString()});
    if(e){notify(e.message);return;}
    const url=`${location.origin}/share/${token}`;await navigator.clipboard.writeText(url).catch(()=>{});notify("Share link copied");
  };
  const startVoice = () => {
    const W=window as any;const Rec=W.SpeechRecognition||W.webkitSpeechRecognition;
    if(!Rec){notify("Speech recognition isn't supported in this browser");return;}
    const rec=new Rec();rec.lang="en-IN";rec.interimResults=true;rec.onresult=(e:any)=>{let t="";for(let i=e.resultIndex;i<e.results.length;i++)t+=e.results[i][0].transcript;setInput(t)};rec.onerror=()=>notify("Microphone unavailable");rec.start();
  };
  const copy = async(text:string)=>{await navigator.clipboard.writeText(text);notify("Copied to clipboard");};
  const deleteChat=(id:string)=>{const next=chats.filter(c=>c.id!==id);setChats(next);if(activeId===id){if(next.length)setActiveId(next[0].id);else{const c:Chat={id:uid(),title:"New chat",messages:[],updatedAt:Date.now()};setChats([c]);setActiveId(c.id)}}};

  return <main className={dark?"app-shell dark":"app-shell"}>
    <aside className={`sidebar ${sidebarOpen?"sidebar-open":""}`}>
      <div className="brand"><div className="brand-mark"><span>B</span><i/></div><div><strong>Bharix<span> AI</span></strong><small>Think beyond.</small></div><button className="icon-btn mobile-close" onClick={()=>setSidebarOpen(false)} aria-label="Close menu"><X size={18}/></button></div>
      <button className="new-chat" onClick={newChat}><Plus size={18}/> New chat <span>⌘ K</span></button>
      <label className="searchbox"><Search size={16}/><input placeholder="Search conversations" value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <div className="side-label">YOUR WORKSPACE</div>
      <div className="chat-list">{filtered.map(c=><div key={c.id} className={`chat-item ${c.id===activeId?"selected":""}`}><button onClick={()=>{setActiveId(c.id);setSidebarOpen(false)}}><span className="chat-dot"/><span className="chat-title">{c.title}</span></button><button className="delete-chat" aria-label="Delete chat" onClick={()=>deleteChat(c.id)}><Trash2 size={14}/></button></div>)}</div>
      <div className="sidebar-bottom">
        <div className="sync-status"><span className={user?"status-dot online":"status-dot"}/><div><b>{user?.email||"Personal workspace"}</b><small>{user?cloudStatus:"Chats saved on this device"}</small></div></div>
        <button className="side-action" onClick={()=>setSettingsOpen(true)}><Settings size={17}/> Settings <MoreHorizontal size={17}/></button>
        <a className="creator-link" href={CREATOR_URL} target="_blank" rel="noreferrer"><span>Creator</span><b>@ytinspirevault</b><span className="subscribe">Subscribe ↗</span></a>
      </div>
    </aside>
    {sidebarOpen&&<button className="scrim" onClick={()=>setSidebarOpen(false)} aria-label="Close sidebar"/>}
    <section className="main-panel">
      <header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setSidebarOpen(true)} aria-label="Open menu"><Menu size={20}/></button><div className="crumb"><span>Workspace</span><span>/</span><b>{active?.title||"New chat"}</b></div><div className="top-actions"><button className="pill-btn" onClick={()=>setSettingsOpen(true)}><Settings size={15}/> Settings</button><button className="icon-btn" onClick={()=>setDark(!dark)} aria-label="Toggle theme">{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="avatar" onClick={user?signOut:signIn} title={user?"Sign out":"Sign in with Google"}>{user?.email?.[0]?.toUpperCase()||"B"}</button></div></header>
      <div className="conversation" onScroll={e=>setShowJump((e.currentTarget.scrollHeight-e.currentTarget.scrollTop-e.currentTarget.clientHeight)>220)}>
        {!active?.messages.length?<div className="welcome beemax-welcome"><div className="eyebrow"><Sparkles size={14}/> YOUR PERSONAL AI COMPANION</div><div className="hero-orb beemax-robot" aria-label="Bharix AI robot"><div className="robot-antenna"/><div className="robot-head"><span/><span/><i/></div><div className="robot-body"><i/></div><div className="robot-arm robot-arm-left"/><div className="robot-arm robot-arm-right"/></div><h1>Hi Bardia</h1><p className="beemax-subtitle">How can I help?</p><div className="suggestions">{[{icon:"◐",title:"Manage anxiety",desc:"",prompt:"Help me manage anxiety. "},{icon:"✧",title:"Cope with Stress",desc:"",prompt:"Help me cope with stress. "},{icon:"♡",title:"Boost Confidence",desc:"",prompt:"Help me boost my confidence. "},{icon:"◷",title:"Healthy Habits",desc:"",prompt:"Help me build healthy habits. "}].map(s=><button className="suggestion" key={s.title} onClick={()=>setInput(s.prompt)}><span>{s.icon}</span><div><b>{s.title}</b>{s.desc&&<small>{s.desc}</small>}</div><span className="suggest-arrow">↗</span></button>)}</div>{user?<div className="beemax-login beemax-signed-in"><div className="signed-in-mark"><Check size={19}/></div><b>You’re all set, {user.user_metadata?.full_name?.split(" ")[0]||"friend"}!</b><small>Signed in as {user.email}</small><button className="signed-in-account" onClick={()=>setSettingsOpen(true)}><Settings size={16}/> Account settings</button></div>:<div className="beemax-login"><button onClick={signIn}><LogIn size={17}/> Continue with Google</button><small>Private conversations. Your pace, your space.</small></div>}</div>:<div className="messages">{active.messages.map((m,i)=><article key={m.id} className={`message ${m.role}`}><div className="message-avatar">{m.role==="assistant"?<div className="mini-mark">B</div>:"Y"}</div><div className="message-body"><div className="message-meta">{m.role==="assistant"?"Bharix AI":"You"}<span>{new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span></div>{m.images?.map((im,j)=><img className="attached-image" src={im} alt="Attachment" key={j}/ >)}{m.role==="assistant"?<div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content|| (busy&&i===active.messages.length-1?"Thinking…":"")}</ReactMarkdown></div>:<div className="user-content">{m.content}</div>}{m.role==="assistant"&&m.content&&<div className="message-tools"><button onClick={()=>copy(m.content)}><Copy size={14}/> Copy</button><button onClick={()=>{setInput(active.messages[i-1]?.content||"");notify("Edit your prompt, then send again")}}><Activity size={14}/> Edit prompt</button>{i===active.messages.length-1&&<button onClick={()=>send(active.messages[i-1]?.content||"",true)} disabled={busy}><Activity size={14}/> Regenerate</button>}</div>}</div></article>)}</div>}
        <div ref={bottomRef}/>{showJump&&<button className="jump-bottom" onClick={()=>bottomRef.current?.scrollIntoView({behavior:"smooth"})}><ArrowDown size={16}/></button>}
      </div>
      <div className={`composer-wrap ${!active?.messages.length?"welcome-composer":""}`}>
        {error&&<div className="error-banner"><CircleHelp size={16}/>{error}<button onClick={()=>setError("")}><X size={14}/></button></div>}
        {files.length>0&&<div className="file-chips">{files.map((f,i)=><span key={i}><FileText size={14}/>{f.name}<button onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))}><X size={12}/></button></span>)}</div>}
        <div className="composer"><textarea ref={inputRef} rows={1} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder={active?.messages.length ? "Ask Bharix anything…" : "Type here…"}/>
          <div className="composer-bottom"><div className="composer-tools"><input ref={fileRef} type="file" multiple accept="image/*,.txt,.md,.csv,.json,.html,.xml,.js,.ts,.py,.css" hidden onChange={e=>addFiles(e.target.files)}/><button title="Attach files" onClick={()=>fileRef.current?.click()}><Paperclip size={17}/><span>Attach</span></button><button className={webSearch?"tool-active":""} title="Web search" onClick={()=>setWebSearch(!webSearch)}><Globe size={16}/><span>Search {webSearch?"on":""}</span></button><button title="Voice input" onClick={startVoice} disabled={!speechAvailable}><Mic size={17}/><span>Voice</span></button></div><div className="send-side"><span className="model-label"><Zap size={12}/> AI assistant <ChevronDown size={12}/></span>{busy?<button className="send-btn stop-btn" onClick={()=>abortRef.current?.abort()} aria-label="Stop generation"><Square size={15}/></button>:<button className="send-btn" onClick={()=>send()} disabled={!input.trim()&&!files.length} aria-label="Send message">{active?.messages.length?<ArrowUp size={19}/>:<Send size={17}/>}</button>}</div></div>
        </div><div className="disclaimer">Bharix AI can make mistakes. Check important information. <span>Made with care ✦</span></div>
      </div>
    </section>
    {settingsOpen&&<div className="modal-backdrop" onClick={()=>setSettingsOpen(false)}><section className="settings-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><small>PERSONALIZE</small><h2>Settings</h2></div><button className="icon-btn" onClick={()=>setSettingsOpen(false)}><X size={18}/></button></div><div className="settings-row"><div><b>Appearance</b><small>Switch between light and dark mode</small></div><button className="pill-btn" onClick={()=>setDark(!dark)}>{dark?<Sun size={16}/>:<Moon size={16}/>} {dark?"Light mode":"Dark mode"}</button></div><div className="settings-row"><div><b>Google account</b><small>{user?.email||"Sign in to enable cloud history"}</small></div><button className="pill-btn" onClick={user?signOut:signIn}>{user?<LogOut size={15}/>:<LogIn size={15}/>} {user?"Sign out":"Sign in"}</button></div><div className="settings-row"><div><b>Chat data</b><small>Export your current conversation</small></div><div className="inline-buttons"><button className="pill-btn" onClick={()=>exportChat("md")}><Download size={15}/> MD</button><button className="pill-btn" onClick={()=>exportChat("json")}><Download size={15}/> JSON</button></div></div><div className="settings-row"><div><b>Share conversation</b><small>Only shared when you explicitly create a link</small></div><button className="pill-btn" onClick={shareChat}><Share2 size={15}/> Create link</button></div><div className="creator-card"><div className="creator-avatar">YT</div><div className="creator-copy"><small>CREATOR</small><b>@ytinspirevault</b><span>More ideas, tools and inspiration.</span></div><a href={CREATOR_URL} target="_blank" rel="noreferrer" className="subscribe-btn">Subscribe ↗</a></div><div className="settings-foot">Bharix AI · Think beyond. <span>{isSupabaseConfigured?"Cloud auth configured":"Local mode · Supabase optional"}</span></div></section></div>}
    {toast&&<div className="toast"><Check size={15}/>{toast}</div>}
  </main>;
}
