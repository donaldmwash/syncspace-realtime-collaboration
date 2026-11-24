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
type ConversationTopic = { id: string; name: string; description: string | null };
type StatusItem = { id: string; user_id: string; media_path: string; media_type: string | null; caption: string | null; expires_at: string; created_at: string; owner?: { display_name: string; avatar_url?: string | null }; signedUrl?: string };
type Attachment = { id: string; file_name: string; mime_type: string | null; size_bytes: number; object_path: string; signedUrl?: string };
type Poll = { id: string; question: string; allows_multiple: boolean; closes_at: string | null; poll_options: { id: string; label: string; position: number }[]; poll_votes: { option_id: string; user_id: string }[] };
type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  message_type: string;
  reply_to_id: string | null;
  topic_id?: string | null;
  topic?: { name: string } | { name: string }[] | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  sender?: { display_name: string; avatar_url?: string | null };
  attachments?: Attachment[];
  reactions?: { emoji: string; user_id: string }[];
  receipts?: { user_id: string; read_at: string | null }[];
  polls?: Poll | Poll[];
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
  const [inviteRecords, setInviteRecords] = useState<{id:string;expires_at:string|null;max_uses:number|null;uses_count:number;revoked_at:string|null}[]>([]);
  const [inviteLink, setInviteLink] = useState("");
  const [pendingInvite, setPendingInvite] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingName, setTypingName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [topics, setTopics] = useState<ConversationTopic[]>([]);
  const [topicId, setTopicId] = useState("");
  const [showTopics, setShowTopics] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [showStatuses, setShowStatuses] = useState(false);
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [activeStatusId, setActiveStatusId] = useState("");
  const [statusFile, setStatusFile] = useState<File | null>(null);
  const [statusCaption, setStatusCaption] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduledMessages, setScheduledMessages] = useState<{id:string;body:string;send_at:string}[]>([]);
  const [newTopicName, setNewTopicName] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState("");
  const [pollMultiple, setPollMultiple] = useState(false);
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
      .select("id,conversation_id,sender_id,body,message_type,reply_to_id,topic_id,created_at,edited_at,deleted_at,sender:profiles!messages_sender_id_fkey(display_name,avatar_url),topic:conversation_topics(name),attachments(id,file_name,mime_type,size_bytes,object_path),reactions:message_reactions(emoji,user_id),receipts:message_receipts(user_id,read_at),polls(id,question,allows_multiple,closes_at,poll_options(id,label,position),poll_votes(option_id,user_id)),reply:messages!messages_reply_to_id_fkey(id,body,sender:profiles!messages_sender_id_fkey(display_name))")
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
      return { ...row, sender: Array.isArray(row.sender) ? row.sender[0] : row.sender, reply: Array.isArray(row.reply) ? row.reply[0] : row.reply, polls: Array.isArray(row.polls) ? row.polls[0] : row.polls, topic: Array.isArray(row.topic) ? row.topic[0] : row.topic, attachments } as Message;
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
    const queryToken = new URLSearchParams(window.location.search).get("invite");
    const storedToken = window.localStorage.getItem("syncspace.pendingInvite");
    const inviteToken = queryToken || storedToken || "";
    if (inviteToken) { window.localStorage.setItem("syncspace.pendingInvite", inviteToken); setPendingInvite(inviteToken); }
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
      await refreshStatuses();
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
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, () => void loadMessages(activeId))
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_options" }, () => void loadMessages(activeId))
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduled_messages", filter: "conversation_id=eq." + activeId }, () => {
        void supabase.from("scheduled_messages").select("id,body,send_at").eq("conversation_id", activeId).is("sent_at", null).is("canceled_at", null).order("send_at", { ascending: true }).then(({ data }) => setScheduledMessages((data ?? []) as {id:string;body:string;send_at:string}[]));
      })
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


  useEffect(() => {
    if (!supabase || !activeId) { setTopics([]); setTopicId(""); return; }
    setTopicId("");
    void supabase.from("conversation_topics").select("id,name,description").eq("conversation_id", activeId).order("created_at", { ascending: true }).then(({ data, error }) => {
      if (error) setNotice(error.message);
      else setTopics((data ?? []) as ConversationTopic[]);
    });
  }, [activeId, supabase]);


  useEffect(() => {
    if (!supabase || !activeId) { setScheduledMessages([]); return; }
    void supabase.from("scheduled_messages").select("id,body,send_at").eq("conversation_id", activeId).is("sent_at", null).is("canceled_at", null).order("send_at", { ascending: true }).then(({ data, error }) => {
      if (error) setNotice(error.message);
      else setScheduledMessages((data ?? []) as {id:string;body:string;send_at:string}[]);
    });
  }, [activeId, supabase]);


  async function refreshStatuses() {
    if (!supabase) return;
    const { data, error } = await supabase.from("user_statuses")
      .select("id,user_id,media_path,media_type,caption,expires_at,created_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) { setNotice(error.message); return; }
    const rows = data ?? [];
    const ownerIds = [...new Set(rows.map((row: any) => row.user_id))];
    const { data: profiles } = ownerIds.length ? await supabase.from("profiles").select("id,display_name,avatar_url").in("id", ownerIds) : { data: [] };
    const hydrated = await Promise.all(rows.map(async (row: any) => {
      const { data: signed } = await supabase.storage.from("statuses").createSignedUrl(row.media_path, 3600);
      const owner = (profiles ?? []).find((profile: any) => profile.id === row.user_id);
      return { ...row, owner: owner ? { display_name: owner.display_name, avatar_url: owner.avatar_url } : undefined, signedUrl: signed?.signedUrl } as StatusItem;
    }));
    setStatuses(hydrated);
  }


  useEffect(() => {
    if (!user || !supabase || !pendingInvite) return;
    void (async () => {
      const { data, error } = await supabase.functions.invoke("redeem-invite", { body: { token: pendingInvite } });
      window.localStorage.removeItem("syncspace.pendingInvite");
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      setPendingInvite("");
      if (error) { setNotice(error.message); return; }
      await loadConversations(user);
      setActiveId(String(data?.conversation_id ?? ""));
      setNotice("You joined the invited conversation.");
    })();
  }, [user, supabase, pendingInvite, loadConversations]);

  useEffect(() => {
    if (!supabase || !activeId) { setInviteRecords([]); return; }
    void supabase.from("conversation_invites").select("id,expires_at,max_uses,uses_count,revoked_at")
      .eq("conversation_id", activeId).order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) setNotice(error.message); else setInviteRecords((data ?? []) as any[]); });
  }, [activeId, supabase]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setNotice("");
    try {
      if (authMode === "signup") {
        const clean = displayName.trim().replace(/\s+/g, " ").slice(0, 60);
        if (!clean) throw new Error("Enter the name other members will see.");
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: clean }, emailRedirectTo: window.location.href } });
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
    const { data: blocks } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user?.id ?? "");
    const blockedIds = new Set((blocks ?? []).map((item: any) => item.blocked_id));
    const visible = (data ?? []).filter((item: any) => !blockedIds.has(item.id));
    setMemberResults(visible);
    if (!visible.length) setNotice("No matching usernames found, or matching users are blocked. Members need a username to be found.");
  }

  async function addMember(memberId: string) {
    if (!supabase || !activeConversation) return;
    const { error } = await supabase.from("conversation_members").insert({ conversation_id: activeConversation.id, user_id: memberId, role: "member" });
    if (error) setNotice(error.code === "23505" ? "That person is already in this conversation." : error.message);
    else setNotice("Member added to the conversation.");
  }




  async function createInviteLink() {
    if (!supabase || !user || !activeConversation || activeConversation.type === "direct") return;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
    const { data, error } = await supabase.from("conversation_invites").insert({
      conversation_id: activeConversation.id, token_hash: tokenHash, created_by: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), max_uses: 50,
    }).select("id,expires_at,max_uses,uses_count,revoked_at").single();
    if (error) { setNotice(error.message); return; }
    const link = window.location.origin + "/?invite=" + token;
    setInviteLink(link);
    setInviteRecords((current) => [data, ...current]);
    try { await navigator.clipboard.writeText(link); setNotice("Invite link copied. It expires in 7 days or after 50 new joins."); }
    catch { setNotice("Invite link created. Copy it from the field below."); }
  }

  async function revokeInvite(inviteId: string) {
    if (!supabase) return;
    const { error } = await supabase.from("conversation_invites").update({ revoked_at: new Date().toISOString() }).eq("id", inviteId);
    if (error) setNotice(error.message);
    else { setInviteRecords((current) => current.map((item) => item.id === inviteId ? { ...item, revoked_at: new Date().toISOString() } : item)); setNotice("Invite revoked."); }
  }

  async function blockMember(memberId: string) {
    if (!supabase || !user) return;
    if (!window.confirm("Block this person from your SyncSpace discovery list?")) return;
    const { error } = await supabase.from("user_blocks").insert({ blocker_id: user.id, blocked_id: memberId });
    if (error) setNotice(error.code === "23505" ? "This person is already blocked." : error.message);
    else { setMemberResults((current) => current.filter((member) => member.id !== memberId)); setNotice("Person blocked from your discovery list."); }
  }

  async function reportMember(memberId: string) {
    if (!supabase || !user) return;
    const reason = window.prompt("Briefly explain why you are reporting this account:");
    if (!reason?.trim()) return;
    const { error } = await supabase.from("user_reports").insert({ reporter_id: user.id, reported_user_id: memberId, reason: reason.trim().slice(0, 1000) });
    setNotice(error ? error.message : "Report submitted for review.");
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



  async function createStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !statusFile) { setNotice("Choose an image or video first."); return; }
    if (!statusFile.type.startsWith("image/") && !statusFile.type.startsWith("video/")) { setNotice("Status updates must be images or videos."); return; }
    if (statusFile.size > 50 * 1024 * 1024) { setNotice("Status media must be 50 MB or smaller."); return; }
    const safeName = statusFile.name.replace(/[^\w.\-() ]/g, "_").slice(0, 100) || "status";
    const path = user.id + "/" + crypto.randomUUID() + "-" + safeName;
    const { error: uploadError } = await supabase.storage.from("statuses").upload(path, statusFile, { contentType: statusFile.type, upsert: false });
    if (uploadError) { setNotice(uploadError.message); return; }
    const { error } = await supabase.from("user_statuses").insert({
      user_id: user.id, media_path: path, media_type: statusFile.type,
      caption: statusCaption.trim().slice(0, 500) || null,
    });
    if (error) {
      await supabase.storage.from("statuses").remove([path]);
      setNotice(error.message);
      return;
    }
    setStatusFile(null); setStatusCaption(""); setShowAddStatus(false);
    await refreshStatuses();
    setNotice("Your status is live for 24 hours.");
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
      message_type: "text", reply_to_id: replyTo?.id ?? null, topic_id: topicId || null,
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



  async function scheduleMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !activeConversation || !draft.trim()) return;
    const sendAt = new Date(scheduleAt);
    if (!scheduleAt || Number.isNaN(sendAt.getTime()) || sendAt.getTime() <= Date.now()) {
      setNotice("Choose a future date and time for this message.");
      return;
    }
    if (sendAt.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) {
      setNotice("Messages can be scheduled up to 30 days ahead.");
      return;
    }
    const { data, error } = await supabase.from("scheduled_messages").insert({
      conversation_id: activeConversation.id, sender_id: user.id,
      body: draft.trim().slice(0, 20000), send_at: sendAt.toISOString(),
    }).select("id,body,send_at").single();
    if (error) { setNotice(error.message); return; }
    setScheduledMessages((current) => [...current, data].sort((a,b) => a.send_at.localeCompare(b.send_at)));
    setDraft(""); setScheduleAt(""); setShowSchedule(false);
    setNotice("Message scheduled. The delivery worker checks every minute.");
  }

  async function cancelScheduledMessage(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("scheduled_messages").update({ canceled_at: new Date().toISOString() }).eq("id", id);
    if (error) setNotice(error.message);
    else { setScheduledMessages((current) => current.filter((item) => item.id !== id)); setNotice("Scheduled message canceled."); }
  }

  async function createTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !activeConversation || !newTopicName.trim()) return;
    const { data, error } = await supabase.from("conversation_topics").insert({
      conversation_id: activeConversation.id, name: newTopicName.trim().slice(0, 80), created_by: user.id,
    }).select("id,name,description").single();
    if (error) setNotice(error.message);
    else { setTopics((current) => [...current, data]); setTopicId(data.id); setNewTopicName(""); setNotice("Topic created and selected."); }
  }

  async function createPoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !activeConversation) return;
    const question = pollQuestion.trim().slice(0, 500);
    const options = pollOptions.split("\n").map((item) => item.trim().slice(0, 200)).filter(Boolean);
    if (!question || options.length < 2 || options.length > 10) {
      setNotice("A poll needs a question and between 2 and 10 answer options.");
      return;
    }
    setBusy(true);
    const { data: message, error: messageError } = await supabase.from("messages").insert({
      conversation_id: activeConversation.id, sender_id: user.id, body: question, message_type: "system", topic_id: topicId || null,
    }).select("id").single();
    if (messageError) { setNotice(messageError.message); setBusy(false); return; }
    const { data: poll, error: pollError } = await supabase.from("polls").insert({
      message_id: message.id, conversation_id: activeConversation.id, question,
      allows_multiple: pollMultiple, created_by: user.id,
    }).select("id").single();
    if (pollError) { setNotice("Poll could not be created: " + pollError.message); setBusy(false); return; }
    const { error: optionsError } = await supabase.from("poll_options").insert(options.map((label, position) => ({ poll_id: poll.id, label, position })));
    if (optionsError) setNotice("Poll created but its options could not be saved: " + optionsError.message);
    else { setNotice("Poll shared."); setShowPoll(false); setPollQuestion(""); setPollOptions(""); setPollMultiple(false); await loadMessages(activeId); }
    setBusy(false);
  }

  async function votePoll(poll: Poll, optionId: string) {
    if (!supabase || !user) return;
    if (poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now()) { setNotice("This poll is closed."); return; }
    const existing = poll.poll_votes.filter((vote) => vote.user_id === user.id);
    const alreadySelected = existing.some((vote) => vote.option_id === optionId);
    if (!poll.allows_multiple && !alreadySelected && existing.length) {
      const { error } = await supabase.from("poll_votes").delete().eq("poll_id", poll.id).eq("user_id", user.id);
      if (error) { setNotice(error.message); return; }
    } else if (alreadySelected) {
      const { error } = await supabase.from("poll_votes").delete().eq("poll_id", poll.id).eq("user_id", user.id).eq("option_id", optionId);
      if (error) { setNotice(error.message); return; }
      await loadMessages(activeId);
      return;
    }
    const { error } = await supabase.from("poll_votes").insert({ poll_id: poll.id, option_id: optionId, user_id: user.id });
    setNotice(error ? error.message : "Your vote has been recorded.");
    await loadMessages(activeId);
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
      message_type: type, reply_to_id: replyTo?.id ?? null, topic_id: topicId || null,
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
          <div style={{ display: "flex", gap: 7, margin: "4px 0 12px" }}><button onClick={() => setShowAddStatus(true)} style={{ ...secondaryButton, flex: 1 }}>＋ Add status</button><button onClick={() => { void refreshStatuses(); setShowStatuses(true); }} style={{ ...secondaryButton, flex: 1 }}>Status · {statuses.length}</button></div>
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
              <div style={{ display: "flex", gap: 8 }}><button onClick={() => setShowSchedule(true)} style={secondaryButton}>Scheduled</button><button onClick={() => setShowTopics(true)} style={secondaryButton}>Topics</button><button onClick={() => setShowMembers(true)} style={secondaryButton}>Members / invite</button></div>
            </header>
            <div aria-live="polite" style={{ flex: 1, minHeight: 400, maxHeight: "calc(100vh - 230px)", overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {visibleMessages.map((message) => {
                const mine = message.sender_id === user.id;
                const file = message.attachments?.[0];
                const poll = Array.isArray(message.polls) ? message.polls[0] : message.polls;
                const reply = Array.isArray(message.reply) ? message.reply[0] : message.reply;
                return <article key={message.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "min(82%, 720px)", minWidth: 130 }}>
                  <div style={{ color: mine ? "#9db8ff" : "#8ce0b0", fontSize: 11, margin: "0 5px 5px" }}>{mine ? "You" : message.sender?.display_name || "Member"}{message.topic && <span> · #{(Array.isArray(message.topic) ? message.topic[0] : message.topic)?.name}</span>} · {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{message.edited_at ? " · Edited" : ""}{mine && message.receipts?.some((receipt) => receipt.read_at) ? " · ✓✓ Read" : ""}</div>
                  {reply && <div style={{ padding: "7px 10px", borderLeft: "3px solid #86a8ff", background: "#111f34", borderRadius: 7, color: "#aebfda", fontSize: 11, marginBottom: 4 }}>Replying to {reply.sender?.display_name || "member"}: {(reply.body || "Attachment").slice(0, 120)}</div>}
                  {editingId === message.id ? <div style={{ ...panel, padding: 9 }}><textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} /><div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}><button onClick={() => setEditingId("")} style={secondaryButton}>Cancel</button><button onClick={() => void editMessage(message.id)} style={primaryButton}>Save</button></div></div> : <div style={{ background: mine ? "#20365c" : "#1a2940", borderRadius: 13, padding: "11px 14px", lineHeight: 1.6, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                    {poll ? <div style={{ display: "grid", gap: 9, minWidth: 230 }}><strong>{poll.question}</strong>{[...poll.poll_options].sort((a,b) => a.position-b.position).map((option) => { const count = poll.poll_votes.filter((vote) => vote.option_id === option.id).length; const selected = poll.poll_votes.some((vote) => vote.option_id === option.id && vote.user_id === user.id); const total = poll.poll_votes.length; return <button key={option.id} onClick={() => void votePoll(poll, option.id)} disabled={!!poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now()} style={{ textAlign: "left", padding: 9, borderRadius: 8, border: "1px solid " + (selected ? "#86a8ff" : "#40516c"), background: selected ? "#263f68" : "#15243a", color: "#e7eefb" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span>{selected ? "✓ " : ""}{option.label}</span><small>{count}</small></div><div style={{ height: 4, background: "#34445d", borderRadius: 5, marginTop: 7 }}><div style={{ width: (total ? Math.round(count / total * 100) : 0) + "%", height: "100%", background: "#86a8ff", borderRadius: 5 }} /></div></button>; })}<small style={{ color: "#aebfda" }}>{poll.poll_votes.length} vote(s) · {poll.allows_multiple ? "Multiple answers" : "Choose one"}{poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now() ? " · Closed" : ""}</small></div> : file ? <div style={{ display: "grid", gap: 7 }}>
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
              <select aria-label="Message topic" value={topicId} onChange={(e) => setTopicId(e.target.value)} style={{ ...inputStyle, width: 130, padding: "9px 8px" }}><option value="">No topic</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...secondaryButton, fontSize: 19 }}>{uploading ? "…" : "＋"}</button>
              {(!activeConversation.is_announcement_only || ["owner","admin"].includes(activeConversation.role ?? "")) && <button type="button" onClick={() => setShowPoll(true)} style={secondaryButton}>Poll</button>}
              {(!activeConversation.is_announcement_only || ["owner","admin"].includes(activeConversation.role ?? "")) && <button type="button" onClick={() => draft.trim() ? setShowSchedule(true) : setNotice("Write a message first, then schedule it.")} style={secondaryButton}>Schedule</button>}
              <input value={draft} onChange={(e) => notifyTyping(e.target.value)} placeholder={activeConversation.is_announcement_only && activeConversation.role === "member" ? "Only admins can post here" : "Write a message…"} disabled={activeConversation.is_announcement_only && !["owner","admin"].includes(activeConversation.role ?? "")} style={{ ...inputStyle, flex: 1 }} />
              <button type="submit" disabled={!draft.trim() || (activeConversation.is_announcement_only && !["owner","admin"].includes(activeConversation.role ?? ""))} style={primaryButton}>Send</button>
            </form>
          </> : <div style={{ margin: "auto", color: "#8193b1", textAlign: "center", padding: 30 }}>Choose a conversation or create a group to get started.</div>}
          <div role="status" style={{ padding: "0 16px 10px", color: "#7184a3", fontSize: 11 }}>{notice}</div>
        </section>
      </div>

      {showPasswordRecovery && <div style={modalStyle}><form onSubmit={updateRecoveredPassword} style={{ ...panel, width: "min(100%, 420px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Choose a new password</h2><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required placeholder="New password (8+ characters)" style={inputStyle} /><button disabled={busy} style={primaryButton}>Update password</button><p style={{ color: "#8193b1", fontSize: 12 }}>{notice}</p></form></div>}
      {showAddStatus && <div style={modalStyle}><form onSubmit={createStatus} style={{ ...panel, width: "min(100%, 460px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Share a status</h2><input type="file" accept="image/*,video/*" onChange={(e) => setStatusFile(e.target.files?.[0] ?? null)} style={{ color: "#cbd8ec" }} /><textarea value={statusCaption} onChange={(e) => setStatusCaption(e.target.value)} maxLength={500} rows={3} placeholder="Add a caption (optional)" style={inputStyle} /><small style={{ color: "#8193b1" }}>Only people who share a conversation with you can view your status. It expires after 24 hours.</small><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={() => setShowAddStatus(false)} style={secondaryButton}>Cancel</button><button disabled={!statusFile} style={primaryButton}>Share status</button></div></form></div>}
      {showStatuses && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 560px)", maxHeight: "85vh", overflowY: "auto", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Recent statuses</h2>{statuses.map((status) => <button key={status.id} onClick={() => setActiveStatusId(status.id)} style={{ ...secondaryButton, display: "flex", gap: 12, alignItems: "center", textAlign: "left" }}><img src={status.owner?.avatar_url || "https://www.gravatar.com/avatar/?d=mp"} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} /><span><strong>{status.owner?.display_name || "Member"}</strong><small style={{ display: "block", color: "#8193b1" }}>{status.caption || "Status update"} · expires {new Date(status.expires_at).toLocaleTimeString()}</small></span></button>)}{!statuses.length && <small style={{ color: "#8193b1" }}>No active statuses from your contacts.</small>}<button onClick={() => setShowStatuses(false)} style={secondaryButton}>Close</button></section></div>}
      {activeStatusId && (() => { const status = statuses.find((item) => item.id === activeStatusId); return status ? <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 680px)", maxHeight: "90vh", padding: 16, display: "grid", gap: 10 }}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{status.owner?.display_name || "Member"}</strong><button onClick={() => setActiveStatusId("")} style={secondaryButton}>Close</button></div>{status.media_type?.startsWith("video/") ? <video src={status.signedUrl} controls autoPlay style={{ maxWidth: "100%", maxHeight: "70vh", margin: "0 auto" }} /> : <img src={status.signedUrl} alt={status.caption || "Status"} style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", margin: "0 auto" }} />}<p style={{ margin: 0, color: "#cbd8ec" }}>{status.caption}</p><small style={{ color: "#8193b1" }}>Expires {new Date(status.expires_at).toLocaleString()}</small></section></div> : null; })()}
      {showSchedule && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 520px)", maxHeight: "85vh", overflowY: "auto", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Scheduled messages</h2><p style={{ color: "#8193b1", fontSize: 12 }}>Messages are delivered automatically by the database scheduler, which checks once per minute.</p>{draft.trim() && <form onSubmit={scheduleMessage} style={{ display: "grid", gap: 8 }}><strong style={{ fontSize: 13 }}>Schedule your current draft</strong><textarea value={draft} readOnly rows={3} style={{ ...inputStyle, opacity: .8 }} /><input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} min={new Date(Date.now() + 60000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16)} required style={inputStyle} /><button style={primaryButton}>Schedule message</button></form>}<div style={{ display: "grid", gap: 8 }}><strong style={{ fontSize: 13 }}>Pending messages</strong>{scheduledMessages.map((item) => <div key={item.id} style={{ padding: 10, borderRadius: 8, background: "#14233a", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}><div><div style={{ fontSize: 13 }}>{item.body}</div><small style={{ color: "#8193b1" }}>{new Date(item.send_at).toLocaleString()}</small></div><button onClick={() => void cancelScheduledMessage(item.id)} style={secondaryButton}>Cancel</button></div>)}{!scheduledMessages.length && <small style={{ color: "#8193b1" }}>No pending scheduled messages in this conversation.</small>}</div><button onClick={() => setShowSchedule(false)} style={secondaryButton}>Close</button></section></div>}
      {showTopics && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 460px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Conversation topics</h2><p style={{ color: "#8193b1", fontSize: 12 }}>Use topics to organise group discussions. Select a topic before sending a message.</p><div style={{ display: "grid", gap: 7 }}>{topics.map((topic) => <button key={topic.id} onClick={() => { setTopicId(topic.id); setShowTopics(false); }} style={{ ...secondaryButton, textAlign: "left" }}>#{topic.name}{topicId === topic.id ? " · Selected" : ""}</button>)}{!topics.length && <small style={{ color: "#8193b1" }}>No topics yet.</small>}</div>{["owner","admin"].includes(activeConversation?.role ?? "") && <form onSubmit={createTopic} style={{ display: "flex", gap: 8 }}><input value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} maxLength={80} placeholder="New topic name" required style={inputStyle} /><button style={primaryButton}>Add</button></form>}<button onClick={() => { setTopicId(""); setShowTopics(false); }} style={secondaryButton}>Clear topic / close</button></section></div>}
      {showPoll && <div style={modalStyle}><form onSubmit={createPoll} style={{ ...panel, width: "min(100%, 480px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Create a poll</h2><input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} maxLength={500} required placeholder="Ask a question" style={inputStyle} /><textarea value={pollOptions} onChange={(e) => setPollOptions(e.target.value)} rows={5} placeholder={"One answer per line\nOption 2"} style={{ ...inputStyle, resize: "vertical" }} /><label style={{ display: "flex", gap: 8, alignItems: "center", color: "#cbd8ec", fontSize: 13 }}><input type="checkbox" checked={pollMultiple} onChange={(e) => setPollMultiple(e.target.checked)} /> Allow multiple answers</label><small style={{ color: "#8193b1" }}>Add 2–10 options, one per line. Votes are visible to conversation members.</small><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={() => setShowPoll(false)} style={secondaryButton}>Cancel</button><button disabled={busy} style={primaryButton}>Share poll</button></div></form></div>}
      {showCreate && <div style={modalStyle}><form onSubmit={createConversation} style={{ ...panel, width: "min(100%, 440px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Create a conversation</h2><div style={{ display: "flex", gap: 8 }}><button type="button" onClick={() => setNewType("group")} style={{ ...secondaryButton, flex: 1, background: newType === "group" ? "#20365c" : "transparent" }}>Group</button><button type="button" onClick={() => setNewType("channel")} style={{ ...secondaryButton, flex: 1, background: newType === "channel" ? "#20365c" : "transparent" }}>Channel</button></div><input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={newType === "group" ? "Group name" : "Channel name"} maxLength={100} required style={inputStyle} /><p style={{ color: "#8193b1", fontSize: 12 }}>{newType === "channel" ? "Channels are announcement-first spaces. Only owners and admins can post." : "Groups are private. Add people by their SyncSpace username after creation."}</p><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={() => setShowCreate(false)} style={secondaryButton}>Cancel</button><button disabled={busy} style={primaryButton}>Create</button></div></form></div>}

      {showMembers && activeConversation && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 480px)", padding: 22 }}><h2 style={{ marginTop: 0 }}>Members and invitations</h2><p style={{ color: "#8193b1", fontSize: 13 }}>Search by exact or partial username. People must set a username in their profile to be found.</p>{activeConversation.type !== "direct" && ["owner","admin"].includes(activeConversation.role ?? "") && <div style={{ display: "grid", gap: 8 }}><button type="button" onClick={() => void createInviteLink()} style={primaryButton}>Create 7-day invite link</button>{inviteLink && <input readOnly value={inviteLink} onFocus={(e) => e.currentTarget.select()} style={inputStyle} />}</div>}<div style={{ display: "grid", gap: 6 }}><strong style={{ fontSize: 12 }}>Existing invites</strong>{inviteRecords.map((invite) => <div key={invite.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 11, color: "#aebfda" }}><span>{invite.revoked_at ? "Revoked" : invite.expires_at && new Date(invite.expires_at) < new Date() ? "Expired" : "Active"} · {invite.uses_count}/{invite.max_uses ?? "∞"} joins</span>{!invite.revoked_at && ["owner","admin"].includes(activeConversation.role ?? "") && <button onClick={() => void revokeInvite(invite.id)} style={secondaryButton}>Revoke</button>}</div>)}</div><form onSubmit={findMembers} style={{ display: "flex", gap: 8 }}><input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="@username" style={inputStyle} /><button style={primaryButton}>Find</button></form><div style={{ display: "grid", gap: 8, marginTop: 14 }}>{memberResults.map((member) => <div key={member.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, background: "#14233a", borderRadius: 8 }}><span>{member.display_name} <small style={{ color: "#8193b1" }}>@{member.username}</small></span><div style={{ display: "flex", gap: 6 }}><button onClick={() => void addMember(member.id)} style={secondaryButton}>Add</button><button onClick={() => void startDirect(member)} style={secondaryButton}>Message</button><button onClick={() => void reportMember(member.id)} style={secondaryButton}>Report</button><button onClick={() => void blockMember(member.id)} style={secondaryButton}>Block</button></div></div>)}</div><button onClick={() => setShowMembers(false)} style={{ ...secondaryButton, width: "100%", marginTop: 14 }}>Close</button></section></div>}

      {showProfile && <div style={modalStyle}><form onSubmit={saveProfile} style={{ ...panel, width: "min(100%, 440px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Your profile</h2>{avatarUrl && <img src={avatarUrl} alt="Your profile" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "50%" }} />}<label style={{ color: "#cbd8ec", fontSize: 13 }}>Profile picture<input type="file" accept="image/*" onChange={uploadAvatar} style={{ display: "block", marginTop: 7, color: "#aebfda" }} /></label><label style={{ color: "#cbd8ec", fontSize: 13 }}>Display name<input value={profileName} onChange={(e) => setProfileName(e.target.value)} maxLength={60} required style={{ ...inputStyle, marginTop: 6 }} /></label><label style={{ color: "#cbd8ec", fontSize: 13 }}>Username<input value={profileUsername} onChange={(e) => setProfileUsername(e.target.value)} maxLength={24} placeholder="your_username" style={{ ...inputStyle, marginTop: 6 }} /></label><small style={{ color: "#8193b1" }}>Username must be unique and 3–24 letters, numbers or underscores. Email: {user.email}</small><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={() => setShowProfile(false)} style={secondaryButton}>Cancel</button><button style={primaryButton}>Save profile</button></div></form></div>}
    </main>
  );
}

const modalStyle: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 50, background: "rgba(2,8,18,.78)", display: "grid", placeItems: "center", padding: 16 };
