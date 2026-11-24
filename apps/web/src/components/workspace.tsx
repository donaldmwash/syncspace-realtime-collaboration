"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

type Conversation = {
  id: string;
  type: "direct" | "group" | "channel";
  title: string | null;
  description?: string | null;
  is_private: boolean;
  is_announcement_only?: boolean;
  last_message_at?: string | null;
  role?: string;
};
type Attachment = { id: string; file_name: string; mime_type: string | null; size_bytes: number; object_path: string; signedUrl?: string };
type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  message_type: string;
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  sender?: { display_name: string; avatar_url?: string | null };
  attachments?: Attachment[];
  reactions?: { emoji: string; user_id: string }[];
  receipts?: { user_id: string; read_at: string | null }[];
  reply?: { body: string | null; sender?: { display_name: string } } | null;
};

const LOUNGE_ID = "00000000-0000-4000-8000-000000000001";
const panel: React.CSSProperties = { background: "#101a2b", border: "1px solid #26334b", borderRadius: 16 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 9, border: "1px solid #354663", background: "#0a1220", color: "#e7eefb", outline: "none" };
const primaryButton: React.CSSProperties = { padding: "11px 15px", border: 0, borderRadius: 9, background: "#86a8ff", color: "#081020", fontWeight: 700, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { padding: "9px 12px", border: "1px solid #354663", borderRadius: 9, background: "transparent", color: "#cbd8ec", cursor: "pointer" };

export function Workspace() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notice, setNotice] = useState("Create an account or sign in to start messaging.");
  const [busy, setBusy] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState("");
  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"group" | "channel">("group");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingName, setTypingName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<any>(null);
  const supabase = useMemo(() => {
    try { return getSupabase(); } catch { return null; }
  }, []);

  const activeConversation = conversations.find((item) => item.id === activeId) ?? null;

  const loadConversations = useCallback(async (currentUser: User) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("conversation_members")
      .select("conversation_id, role, conversations(id,type,title,description,is_private,is_announcement_only,last_message_at)")
      .eq("user_id", currentUser.id);
    if (error) { setNotice(error.message); return; }
    const list = (data ?? []).map((row: any) => ({ ...row.conversations, role: row.role })).filter((item: any) => item?.id) as Conversation[];
    list.sort((a, b) => {
      if (a.id === LOUNGE_ID) return -1;
      if (b.id === LOUNGE_ID) return 1;
      return (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "");
    });
    setConversations(list);
    setActiveId((current) => list.some((item) => item.id === current) ? current : (list[0]?.id ?? ""));
  }, [supabase]);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!supabase || !conversationId) return;
    const { data, error } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_id,body,message_type,reply_to_id,created_at,edited_at,deleted_at,sender:profiles!messages_sender_id_fkey(display_name,avatar_url),attachments(id,file_name,mime_type,size_bytes,object_path),reactions:message_reactions(emoji,user_id),receipts:message_receipts(user_id,read_at),reply:messages!messages_reply_to_id_fkey(id,body,sender:profiles!messages_sender_id_fkey(display_name))")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) { setNotice(error.message); return; }
    const rows = (data ?? []) as any[];
    const hydrated = await Promise.all(rows.map(async (row) => {
      const attachments = await Promise.all((row.attachments ?? []).map(async (file: Attachment) => {
        const { data: signed } = await supabase.storage.from("conversation-files").createSignedUrl(file.object_path, 3600);
        return { ...file, signedUrl: signed?.signedUrl };
      }));
      return { ...row, sender: Array.isArray(row.sender) ? row.sender[0] : row.sender, reply: Array.isArray(row.reply) ? row.reply[0] : row.reply, attachments } as Message;
    }));
    setMessages(hydrated);
    const unread = rows.filter((row) => row.sender_id !== user?.id).map((row) => ({ message_id: row.id, user_id: user?.id, read_at: new Date().toISOString() }));
    if (unread.length) await supabase.from("message_receipts").upsert(unread, { onConflict: "message_id,user_id" });
  }, [supabase, user]);

  useEffect(() => {
    if (!supabase) { setNotice("Supabase is not configured. Add the two public Supabase environment variables to the web app."); setAuthReady(true); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setShowPasswordRecovery(true);
      setAuthReady(true);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [supabase]);

  useEffect(() => {
    if (!user || !supabase) {
      setConversations([]); setMessages([]); setActiveId("");
      return;
    }
    void (async () => {
      const metaName = String(user.user_metadata?.display_name ?? "");
      const cleanName = metaName || user.email?.split("@")[0] || "Member";
      await supabase.from("profiles").upsert({ id: user.id, display_name: cleanName.slice(0, 60) }, { onConflict: "id", ignoreDuplicates: true });
      const { data: profile } = await supabase.from("profiles").select("display_name,username,avatar_url").eq("id", user.id).maybeSingle();
      setProfileName(profile?.display_name ?? cleanName);
      setProfileUsername(profile?.username ?? "");
      setAvatarUrl(profile?.avatar_url ?? "");
      await loadConversations(user);
    })();
  }, [user, supabase, loadConversations]);

  useEffect(() => {
    if (!activeId || !supabase || !user) { setMessages([]); return; }
    void loadMessages(activeId);
    const channel = supabase.channel("conversation:" + activeId, {
      config: { presence: { key: user.id } },
    });
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: "conversation_id=eq." + activeId }, () => void loadMessages(activeId))
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => void loadMessages(activeId))
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.userId !== user.id) {
          setTypingName(String(payload?.name ?? "Someone"));
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTypingName(""), 2200);
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ userId: user.id, name: profileName || user.email, online_at: new Date().toISOString() });
      });
    channelRef.current = channel;
    return () => { void supabase.removeChannel(channel); channelRef.current = null; };
  }, [activeId, supabase, user, loadMessages, profileName]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setNotice("");
    try {
      if (authMode === "signup") {
        const clean = displayName.trim().replace(/\s+/g, " ").slice(0, 60);
        if (!clean) throw new Error("Enter the name other members will see.");
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: clean }, emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setNotice("Account created. Check your email to confirm your address, then sign in.");
        else setNotice("Your account is ready. Welcome to SyncSpace.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setNotice("Signed in successfully.");
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Authentication failed."); }
    finally { setBusy(false); }
  }


  async function requestPasswordReset() {
    if (!supabase || !email.trim()) { setNotice("Enter your account email first."); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setNotice(error ? error.message : "If that email belongs to an account, a password-reset link has been sent.");
    setBusy(false);
  }

  async function updateRecoveredPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || newPassword.length < 8) { setNotice("Use a password with at least 8 characters."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setNotice(error ? error.message : "Your password has been updated.");
    if (!error) { setShowPasswordRecovery(false); setNewPassword(""); }
    setBusy(false);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setNotice("You have signed out.");
  }

  async function createConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    const title = newTitle.trim().slice(0, 100);
    if (!title) return;
    setBusy(true);
    const { data, error } = await supabase.from("conversations").insert({
      type: newType, title, created_by: user.id, is_private: true,
      is_announcement_only: newType === "channel",
    }).select("id,type,title,description,is_private,is_announcement_only,last_message_at").single();
    if (error) { setNotice(error.message); setBusy(false); return; }
    const { error: memberError } = await supabase.from("conversation_members").insert({ conversation_id: data.id, user_id: user.id, role: "owner" });
    if (memberError) { setNotice("The conversation was created, but membership setup failed: " + memberError.message); }
    else {
      setNewTitle(""); setShowCreate(false); setNotice(newType === "channel" ? "Channel created. Add members to invite your audience." : "Group created. Add members to invite your people.");
      await loadConversations(user); setActiveId(data.id);
    }
    setBusy(false);
  }

  async function findMembers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !memberQuery.trim()) return;
    const query = memberQuery.trim().replace(/^@/, "");
    const { data, error } = await supabase.from("profiles").select("id,username,display_name,avatar_url").neq("id", user?.id ?? "").ilike("username", query + "%").limit(10);
    if (error) setNotice(error.message);
    setMemberResults(data ?? []);
    if (!data?.length) setNotice("No matching usernames found. Members need to set a username in their profile first.");
  }

  async function addMember(memberId: string) {
    if (!supabase || !activeConversation) return;
    const { error } = await supabase.from("conversation_members").insert({ conversation_id: activeConversation.id, user_id: memberId, role: "member" });
    if (error) setNotice(error.code === "23505" ? "That person is already in this conversation." : error.message);
    else setNotice("Member added to the conversation.");
  }


  async function startDirect(member: any) {
    if (!supabase || !user) return;
    const { data: conversation, error } = await supabase.from("conversations").insert({
      type: "direct", title: member.display_name, created_by: user.id, is_private: true,
    }).select("id,type,title,description,is_private,is_announcement_only,last_message_at").single();
    if (error) { setNotice(error.message); return; }
    const { error: ownerError } = await supabase.from("conversation_members").insert({ conversation_id: conversation.id, user_id: user.id, role: "owner" });
    if (ownerError) { setNotice(ownerError.message); return; }
    const { error: peerError } = await supabase.from("conversation_members").insert({ conversation_id: conversation.id, user_id: member.id, role: "member" });
    if (peerError) { setNotice(peerError.message); return; }
    setShowMembers(false); setMemberResults([]); setMemberQuery("");
    await loadConversations(user); setActiveId(conversation.id);
    setNotice("Private conversation started with " + member.display_name + ".");
  }


  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !supabase || !user) return;
    if (!file.type.startsWith("image/")) { setNotice("Choose an image for your profile picture."); return; }
    if (file.size > 5 * 1024 * 1024) { setNotice("Profile pictures must be 5 MB or smaller."); return; }
    const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
    const path = user.id + "/" + crypto.randomUUID() + "." + extension;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setNotice(error.message); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setNotice("Profile picture uploaded. Save your profile to apply it.");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    const cleanUsername = profileUsername.trim().replace(/^@/, "");
    if (cleanUsername && !/^[A-Za-z0-9_]{3,24}$/.test(cleanUsername)) { setNotice("Username must be 3–24 characters using letters, numbers or underscores."); return; }
    const { error } = await supabase.from("profiles").update({ display_name: profileName.trim().slice(0, 60), username: cleanUsername || null, avatar_url: avatarUrl || null }).eq("id", user.id);
    setNotice(error ? error.message : "Profile updated.");
    setShowProfile(false);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !activeConversation || !draft.trim()) return;
    const body = draft.trim().slice(0, 20000);
    const { error } = await supabase.from("messages").insert({
      conversation_id: activeConversation.id, sender_id: user.id, body,
      message_type: "text", reply_to_id: replyTo?.id ?? null,
    });
    if (error) { setNotice(error.message); return; }
    setDraft(""); setReplyTo(null);
  }

  async function editMessage(messageId: string) {
    if (!supabase || !user || !editDraft.trim()) return;
    const { error } = await supabase.from("messages").update({ body: editDraft.trim().slice(0, 20000), edited_at: new Date().toISOString() }).eq("id", messageId).eq("sender_id", user.id);
    setNotice(error ? error.message : "Message updated.");
    setEditingId(""); setEditDraft("");
  }

  async function deleteMessage(messageId: string) {
    if (!supabase || !user || !window.confirm("Delete this message for everyone in this conversation?")) return;
    const { error } = await supabase.from("messages").update({ deleted_at: new Date().toISOString(), body: "This message was deleted." }).eq("id", messageId).eq("sender_id", user.id);
    if (error) setNotice(error.message);
    else setNotice("Message deleted.");
  }

  async function toggleReaction(message: Message, emoji: string) {
    if (!supabase || !user) return;
    const exists = message.reactions?.some((item) => item.user_id === user.id && item.emoji === emoji);
    const query = supabase.from("message_reactions");
    const result = exists
      ? await query.delete().eq("message_id", message.id).eq("user_id", user.id).eq("emoji", emoji)
      : await query.insert({ message_id: message.id, user_id: user.id, emoji });
    if (result.error) setNotice(result.error.message);
    else await loadMessages(activeId);
  }

  async function pinMessage(message: Message) {
    if (!supabase || !user || !activeConversation) return;
    const { error } = await supabase.from("message_pins").insert({ conversation_id: activeConversation.id, message_id: message.id, pinned_by: user.id });
    setNotice(error ? (error.code === "23505" ? "That message is already pinned." : error.message) : "Message pinned.");
  }

  async function saveMessage(message: Message) {
    if (!supabase || !user) return;
    const { error } = await supabase.from("saved_messages").insert({ user_id: user.id, message_id: message.id });
    setNotice(error ? (error.code === "23505" ? "That message is already saved." : error.message) : "Message saved to your Saved Messages.");
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !supabase || !user || !activeConversation) return;
    if (file.size > 50 * 1024 * 1024) { setNotice("Files must be 50 MB or smaller."); return; }
    setUploading(true);
    const safeName = file.name.replace(/[^\w.\-() ]/g, "_").slice(0, 120) || "attachment";
    const path = activeConversation.id + "/" + user.id + "/" + crypto.randomUUID() + "-" + safeName;
    const { error: uploadError } = await supabase.storage.from("conversation-files").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploadError) { setNotice(uploadError.message); setUploading(false); return; }
    const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "file";
    const { data: message, error: messageError } = await supabase.from("messages").insert({
      conversation_id: activeConversation.id, sender_id: user.id, body: file.name,
      message_type: type, reply_to_id: replyTo?.id ?? null,
    }).select("id").single();
    if (messageError) {
      await supabase.storage.from("conversation-files").remove([path]);
      setNotice(messageError.message); setUploading(false); return;
    }
    const { error: attachmentError } = await supabase.from("attachments").insert({
      message_id: message.id, conversation_id: activeConversation.id, uploaded_by: user.id,
      bucket_id: "conversation-files", object_path: path, file_name: file.name,
      mime_type: file.type || "application/octet-stream", size_bytes: file.size,
    });
    if (attachmentError) setNotice("File uploaded, but attachment metadata failed: " + attachmentError.message);
    else { setNotice("Attachment shared."); setReplyTo(null); await loadMessages(activeId); }
    setUploading(false);
  }

  function notifyTyping(value: string) {
    setDraft(value);
    if (channelRef.current && user) void channelRef.current.send({ type: "broadcast", event: "typing", payload: { userId: user.id, name: profileName || "Someone" } });
  }

  const visibleMessages = messages.filter((message) => !search.trim() || (message.body ?? "").toLowerCase().includes(search.toLowerCase()));

  if (!authReady) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#cbd8ec" }}>Loading SyncSpace…</main>;

  if (!user) return (
    <main style={{ minHeight: "100vh", padding: "40px 16px", display: "grid", placeItems: "center" }}>
      <section style={{ ...panel, width: "min(100%, 460px)", padding: 30 }}>
        <div style={{ color: "#8ea7d7", fontSize: 12, letterSpacing: 3 }}>SYNCSPACE</div>
        <h1 style={{ fontSize: 30, margin: "10px 0" }}>Your conversations, together.</h1>
        <p style={{ color: "#a8b6ce", lineHeight: 1.6 }}>Create an account to join the community, start private groups and keep your messages across devices.</p>
        <div style={{ display: "flex", gap: 8, margin: "22px 0" }}>
          <button onClick={() => setAuthMode("signup")} style={{ ...secondaryButton, flex: 1, background: authMode === "signup" ? "#20365c" : "transparent" }}>Create account</button>
          <button onClick={() => setAuthMode("signin")} style={{ ...secondaryButton, flex: 1, background: authMode === "signin" ? "#20365c" : "transparent" }}>Sign in</button>
        </div>
        <form onSubmit={authenticate} style={{ display: "grid", gap: 12 }}>
          {authMode === "signup" && <label style={{ color: "#cbd8ec", fontSize: 13 }}>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={60} placeholder="Your name" style={{ ...inputStyle, marginTop: 7 }} /></label>}
          <label style={{ color: "#cbd8ec", fontSize: 13 }}>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" style={{ ...inputStyle, marginTop: 7 }} /></label>
          <label style={{ color: "#cbd8ec", fontSize: 13 }}>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={authMode === "signup" ? "new-password" : "current-password"} placeholder="At least 8 characters" style={{ ...inputStyle, marginTop: 7 }} /></label>
          <button type="submit" disabled={busy} style={{ ...primaryButton, marginTop: 6 }}>{busy ? "Please wait…" : authMode === "signup" ? "Create my account" : "Sign in"}</button>
          {authMode === "signin" && <button type="button" onClick={() => void requestPasswordReset()} disabled={busy} style={{ border: 0, background: "transparent", color: "#9db8ff", fontSize: 12 }}>Forgot your password?</button>}
        </form>
        <p role="status" style={{ color: "#9eb0cb", fontSize: 13, lineHeight: 1.6, marginTop: 18 }}>{notice}</p>
        <p style={{ color: "#7184a3", fontSize: 11 }}>Use a real email address. If email confirmation is enabled, verify your address before signing in.</p>
      </section>
    </main>
  );

  return (
    <main style={{ minHeight: "100vh", padding: 16, color: "#e7eefb" }}>
      <div className="syncspace-layout" style={{ maxWidth: 1400, minHeight: "calc(100vh - 32px)", margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(250px, 320px) minmax(0, 1fr)", gap: 14 }}>
        <aside style={{ ...panel, padding: 18, display: "flex", flexDirection: "column", minHeight: 600 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ color: "#8ea7d7", fontSize: 11, letterSpacing: 3 }}>SYNCSPACE</div><h1 style={{ fontSize: 24, margin: "7px 0 0" }}>Messages</h1></div>
            <button onClick={() => setShowCreate(true)} title="New group or channel" style={{ ...primaryButton, fontSize: 20, padding: "5px 12px" }}>＋</button>
          </div>
          <div style={{ display: "flex", gap: 8, margin: "18px 0" }}>
            <button onClick={() => setShowProfile(true)} style={{ ...secondaryButton, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}> {profileName || user.email} </button>
            <button onClick={signOut} style={secondaryButton}>Sign out</button>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search messages…" style={{ ...inputStyle, marginBottom: 12 }} />
          <div style={{ color: "#7184a3", fontSize: 11, letterSpacing: 1.5, margin: "8px 0" }}>YOUR CONVERSATIONS</div>
          <div style={{ display: "grid", gap: 7, overflowY: "auto" }}>
            {conversations.map((conversation) => (
              <button key={conversation.id} onClick={() => setActiveId(conversation.id)} style={{ textAlign: "left", padding: 12, borderRadius: 10, border: "1px solid " + (activeId === conversation.id ? "#6386d4" : "#26334b"), background: activeId === conversation.id ? "#1b2d4b" : "transparent", color: "#e7eefb", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}><span>{conversation.type === "channel" ? "📢" : conversation.id === LOUNGE_ID ? "🌐" : "👥"}</span><strong style={{ fontSize: 13 }}>{conversation.title || "Direct message"}</strong></div>
                <div style={{ color: "#8193b1", fontSize: 11, marginTop: 5 }}>{conversation.id === LOUNGE_ID ? "Public community" : conversation.type === "channel" ? "Channel" : "Private group"} · {conversation.role}</div>
              </button>
            ))}
            {!conversations.length && <p style={{ color: "#8193b1", fontSize: 13 }}>No conversations yet. Create a group to begin.</p>}
          </div>
          <div style={{ marginTop: "auto", paddingTop: 18, color: "#7184a3", fontSize: 11, lineHeight: 1.6 }}>Persistent accounts · private file storage · realtime updates</div>
        </aside>

        <section style={{ ...panel, display: "flex", flexDirection: "column", minHeight: 600, overflow: "hidden" }}>
          {activeConversation ? <>
            <header style={{ padding: "17px 20px", borderBottom: "1px solid #26334b", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div><strong style={{ fontSize: 17 }}>{activeConversation.title || "Conversation"}</strong><div style={{ color: "#8193b1", fontSize: 12, marginTop: 4 }}>{activeConversation.is_private ? "Private conversation" : "Public community"} · {onlineCount} online{activeConversation.is_announcement_only ? " · Announcements" : ""}</div></div>
              <div style={{ display: "flex", gap: 8 }}><button onClick={() => setShowMembers(true)} style={secondaryButton}>Members / invite</button></div>
            </header>
            <div aria-live="polite" style={{ flex: 1, minHeight: 400, maxHeight: "calc(100vh - 230px)", overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {visibleMessages.map((message) => {
                const mine = message.sender_id === user.id;
                const file = message.attachments?.[0];
                const reply = Array.isArray(message.reply) ? message.reply[0] : message.reply;
                return <article key={message.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "min(82%, 720px)", minWidth: 130 }}>
                  <div style={{ color: mine ? "#9db8ff" : "#8ce0b0", fontSize: 11, margin: "0 5px 5px" }}>{mine ? "You" : message.sender?.display_name || "Member"} · {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{message.edited_at ? " · Edited" : ""}{mine && message.receipts?.some((receipt) => receipt.read_at) ? " · ✓✓ Read" : ""}</div>
                  {reply && <div style={{ padding: "7px 10px", borderLeft: "3px solid #86a8ff", background: "#111f34", borderRadius: 7, color: "#aebfda", fontSize: 11, marginBottom: 4 }}>Replying to {reply.sender?.display_name || "member"}: {(reply.body || "Attachment").slice(0, 120)}</div>}
                  {editingId === message.id ? <div style={{ ...panel, padding: 9 }}><textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} /><div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}><button onClick={() => setEditingId("")} style={secondaryButton}>Cancel</button><button onClick={() => void editMessage(message.id)} style={primaryButton}>Save</button></div></div> : <div style={{ background: mine ? "#20365c" : "#1a2940", borderRadius: 13, padding: "11px 14px", lineHeight: 1.6, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                    {file ? <div style={{ display: "grid", gap: 7 }}>
                      {file.mime_type?.startsWith("image/") && file.signedUrl && <a href={file.signedUrl} target="_blank" rel="noreferrer"><img src={file.signedUrl} alt={file.file_name} style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 8 }} /></a>}
                      {file.mime_type?.startsWith("video/") && file.signedUrl && <video src={file.signedUrl} controls style={{ maxWidth: "100%", maxHeight: 320 }} />}
                      {file.mime_type?.startsWith("audio/") && file.signedUrl && <audio src={file.signedUrl} controls />}
                      <a href={file.signedUrl} target="_blank" rel="noreferrer" style={{ color: "#c8d8ff" }}>📎 {file.file_name}</a><small style={{ color: "#aebfda" }}>{(file.size_bytes / 1024 / 1024).toFixed(2)} MB</small>
                    </div> : message.body}</div>}
                  <div style={{ display: "flex", gap: 9, flexWrap: "wrap", margin: "6px 4px 0", alignItems: "center" }}>
                    {["👍","❤️","😂"].map((emoji) => <button key={emoji} onClick={() => void toggleReaction(message, emoji)} style={{ ...secondaryButton, padding: "3px 7px", fontSize: 11, borderColor: message.reactions?.some((r) => r.emoji === emoji && r.user_id === user.id) ? "#86a8ff" : "#354663" }}>{emoji} {message.reactions?.filter((r) => r.emoji === emoji).length || ""}</button>)}
                    <button onClick={() => setReplyTo(message)} style={{ border: 0, background: "transparent", color: "#9db8ff", fontSize: 11, cursor: "pointer" }}>↩ Reply</button>
                    <button onClick={() => void saveMessage(message)} style={{ border: 0, background: "transparent", color: "#9db8ff", fontSize: 11, cursor: "pointer" }}>Save</button>
                    {["owner","admin"].includes(activeConversation.role ?? "") && <button onClick={() => void pinMessage(message)} style={{ border: 0, background: "transparent", color: "#9db8ff", fontSize: 11, cursor: "pointer" }}>Pin</button>}
                    {mine && <><button onClick={() => { setEditingId(message.id); setEditDraft(message.body ?? ""); }} style={{ border: 0, background: "transparent", color: "#9db8ff", fontSize: 11, cursor: "pointer" }}>Edit</button><button onClick={() => void deleteMessage(message.id)} style={{ border: 0, background: "transparent", color: "#ff9eae", fontSize: 11, cursor: "pointer" }}>Delete</button></>}
                  </div>
                </article>;
              })}
              {!visibleMessages.length && <div style={{ margin: "auto", color: "#8193b1", textAlign: "center" }}>{search ? "No messages match your search." : "No messages yet. Start the conversation."}</div>}
              {typingName && <div style={{ color: "#9db8ff", fontSize: 12 }}>{typingName} is typing…</div>}
            </div>
            {replyTo && <div style={{ padding: "9px 16px", background: "#14233a", borderTop: "1px solid #26334b", display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12, color: "#aebfda" }}>Replying to {replyTo.sender?.display_name || "member"}: {(replyTo.body || "Attachment").slice(0, 90)}</span><button onClick={() => setReplyTo(null)} style={{ ...secondaryButton, padding: "2px 8px" }}>×</button></div>}
            <form onSubmit={sendMessage} style={{ padding: 14, borderTop: "1px solid #26334b", display: "flex", gap: 9, alignItems: "center" }}>
              <input ref={fileRef} type="file" onChange={uploadFile} disabled={uploading} style={{ display: "none" }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...secondaryButton, fontSize: 19 }}>{uploading ? "…" : "＋"}</button>
              <input value={draft} onChange={(e) => notifyTyping(e.target.value)} placeholder={activeConversation.is_announcement_only && activeConversation.role === "member" ? "Only admins can post here" : "Write a message…"} disabled={activeConversation.is_announcement_only && !["owner","admin"].includes(activeConversation.role ?? "")} style={{ ...inputStyle, flex: 1 }} />
              <button type="submit" disabled={!draft.trim() || (activeConversation.is_announcement_only && !["owner","admin"].includes(activeConversation.role ?? ""))} style={primaryButton}>Send</button>
            </form>
          </> : <div style={{ margin: "auto", color: "#8193b1", textAlign: "center", padding: 30 }}>Choose a conversation or create a group to get started.</div>}
          <div role="status" style={{ padding: "0 16px 10px", color: "#7184a3", fontSize: 11 }}>{notice}</div>
        </section>
      </div>

      {showPasswordRecovery && <div style={modalStyle}><form onSubmit={updateRecoveredPassword} style={{ ...panel, width: "min(100%, 420px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Choose a new password</h2><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required placeholder="New password (8+ characters)" style={inputStyle} /><button disabled={busy} style={primaryButton}>Update password</button><p style={{ color: "#8193b1", fontSize: 12 }}>{notice}</p></form></div>}
      {showCreate && <div style={modalStyle}><form onSubmit={createConversation} style={{ ...panel, width: "min(100%, 440px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Create a conversation</h2><div style={{ display: "flex", gap: 8 }}><button type="button" onClick={() => setNewType("group")} style={{ ...secondaryButton, flex: 1, background: newType === "group" ? "#20365c" : "transparent" }}>Group</button><button type="button" onClick={() => setNewType("channel")} style={{ ...secondaryButton, flex: 1, background: newType === "channel" ? "#20365c" : "transparent" }}>Channel</button></div><input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={newType === "group" ? "Group name" : "Channel name"} maxLength={100} required style={inputStyle} /><p style={{ color: "#8193b1", fontSize: 12 }}>{newType === "channel" ? "Channels are announcement-first spaces. Only owners and admins can post." : "Groups are private. Add people by their SyncSpace username after creation."}</p><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={() => setShowCreate(false)} style={secondaryButton}>Cancel</button><button disabled={busy} style={primaryButton}>Create</button></div></form></div>}

      {showMembers && activeConversation && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 480px)", padding: 22 }}><h2 style={{ marginTop: 0 }}>Add members</h2><p style={{ color: "#8193b1", fontSize: 13 }}>Search by exact or partial username. People must set a username in their profile to be found.</p><form onSubmit={findMembers} style={{ display: "flex", gap: 8 }}><input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="@username" style={inputStyle} /><button style={primaryButton}>Find</button></form><div style={{ display: "grid", gap: 8, marginTop: 14 }}>{memberResults.map((member) => <div key={member.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, background: "#14233a", borderRadius: 8 }}><span>{member.display_name} <small style={{ color: "#8193b1" }}>@{member.username}</small></span><div style={{ display: "flex", gap: 6 }}><button onClick={() => void addMember(member.id)} style={secondaryButton}>Add</button><button onClick={() => void startDirect(member)} style={secondaryButton}>Message</button></div></div>)}</div><button onClick={() => setShowMembers(false)} style={{ ...secondaryButton, width: "100%", marginTop: 14 }}>Close</button></section></div>}

      {showProfile && <div style={modalStyle}><form onSubmit={saveProfile} style={{ ...panel, width: "min(100%, 440px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Your profile</h2>{avatarUrl && <img src={avatarUrl} alt="Your profile" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "50%" }} />}<label style={{ color: "#cbd8ec", fontSize: 13 }}>Profile picture<input type="file" accept="image/*" onChange={uploadAvatar} style={{ display: "block", marginTop: 7, color: "#aebfda" }} /></label><label style={{ color: "#cbd8ec", fontSize: 13 }}>Display name<input value={profileName} onChange={(e) => setProfileName(e.target.value)} maxLength={60} required style={{ ...inputStyle, marginTop: 6 }} /></label><label style={{ color: "#cbd8ec", fontSize: 13 }}>Username<input value={profileUsername} onChange={(e) => setProfileUsername(e.target.value)} maxLength={24} placeholder="your_username" style={{ ...inputStyle, marginTop: 6 }} /></label><small style={{ color: "#8193b1" }}>Username must be unique and 3–24 letters, numbers or underscores. Email: {user.email}</small><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={() => setShowProfile(false)} style={secondaryButton}>Cancel</button><button style={primaryButton}>Save profile</button></div></form></div>}
    </main>
  );
}

const modalStyle: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 50, background: "rgba(2,8,18,.78)", display: "grid", placeItems: "center", padding: 16 };
