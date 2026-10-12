import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

export default async function SharedChat({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let chat: any = null;
  let error = "";
  if (url && key) {
    const supabase = createClient(url, key);
    const { data, error: e } = await supabase.rpc("get_shared_chat", { token });
    chat = Array.isArray(data) ? data[0] : null;
    if (e) error = "Unable to load this shared conversation.";
  } else error = "Shared links require Supabase configuration.";
  return <main className="share-page"><header><Link href="/" className="share-brand"><img src="/logo.svg" alt="" width="34" height="34"/> Bharix AI</Link><Link href="/" className="pill-btn">Try Bharix AI ↗</Link></header><section className="share-content"><div className="eyebrow">SHARED CONVERSATION</div><h1>{chat?.title || "Conversation not available"}</h1>{chat?.messages?.map((m:any,i:number)=><article className="share-message" key={i}><b>{m.role==="user"?"You":"Bharix AI"}</b><p>{m.content}</p></article>)}{!chat&&<p>{error||"This link may be invalid or sharing may have been turned off."}</p>}</section></main>;
}
