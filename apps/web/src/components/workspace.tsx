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
  message_ttl_seconds?: number | null;
  last_message_at?: string | null;
  role?: string;
};
type ConversationTopic = { id: string; name: string; description: string | null };
type ConversationFolder = { id: string; name: string; position: number };
type SharedMediaItem = { id:string; file_name:string; mime_type:string|null; size_bytes:number; created_at:string; signedUrl:string };
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
  forwarded_from_id?: string | null;
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


type ContactCard = { id: string; display_name: string; username: string | null; avatar_url: string | null };
function parseContactCard(body: string | null): ContactCard | null {
  try {
    const value = JSON.parse(body ?? "");
    if (!value || typeof value.id !== "string" || typeof value.display_name !== "string") return null;
    return { id: value.id, display_name: value.display_name, username: typeof value.username === "string" ? value.username : null, avatar_url: typeof value.avatar_url === "string" ? value.avatar_url : null };
  } catch { return null; }
}

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
  const [unreadCounts, setUnreadCounts] = useState<Record<string,number>>({});
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{message_id:string;conversation_id:string;sender_id:string;body:string;created_at:string}[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [mentionItems, setMentionItems] = useState<{message_id:string;created_at:string;message?:{id:string;body:string|null;conversation_id:string;created_at:string;sender?:{display_name:string}|{display_name:string}[]}}[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"group" | "channel">("group");
  const [newChannelPrivate, setNewChannelPrivate] = useState(true);
  const [showDiscoverChannels, setShowDiscoverChannels] = useState(false);
  const [publicChannels, setPublicChannels] = useState<{id:string;title:string;description:string|null;last_message_at:string|null}[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<any[]>([]);
  const [conversationMembers, setConversationMembers] = useState<{user_id:string;role:string;display_name:string;username:string|null;avatar_url:string|null}[]>([]);
  const [inviteRecords, setInviteRecords] = useState<{id:string;expires_at:string|null;max_uses:number|null;uses_count:number;revoked_at:string|null}[]>([]);
  const [inviteLink, setInviteLink] = useState("");
  const [pendingInvite, setPendingInvite] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [channelAnalytics, setChannelAnalytics] = useState<{members:number;messages:number;messages30d:number;files:number}>({members:0,messages:0,messages30d:0,files:0});
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingName, setTypingName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentDeviceId, setCurrentDeviceId] = useState("");
  const [devices, setDevices] = useState<{id:string;device_name:string|null;platform:string|null;last_seen_at:string;created_at:string}[]>([]);
  const [showLastSeen, setShowLastSeen] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<{id:string;display_name:string;username:string|null}[]>([]);
  const [showPoll, setShowPoll] = useState(false);
  const [topics, setTopics] = useState<ConversationTopic[]>([]);
  const [topicId, setTopicId] = useState("");
  const [showTopics, setShowTopics] = useState(false);
  const [showConversationSettings, setShowConversationSettings] = useState(false);
  const [ttlSeconds, setTtlSeconds] = useState("0");
  const [forwardMessageId, setForwardMessageId] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [sharedMedia, setSharedMedia] = useState<SharedMediaItem[]>([]);
  const [showFolders, setShowFolders] = useState(false);
  const [folders, setFolders] = useState<ConversationFolder[]>([]);
  const [folderAssignments, setFolderAssignments] = useState<Record<string,string>>({});
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [pinnedMessages, setPinnedMessages] = useState<{id:string;message_id:string;message?:{id:string;body:string|null;conversation_id:string;created_at:string}}[]>([]);
  const [savedMessages, setSavedMessages] = useState<{message_id:string;created_at:string;message?:{id:string;body:string|null;conversation_id:string;created_at:string}}[]>([]);
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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recorderChunksRef = useRef<BlobPart[]>([]);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<any>(null);
  const supabase = useMemo(() => {
    try { return getSupabase(); } catch { return null; }
  }, []);

  const activeConversation = conversations.find((item) => item.id === activeId) ?? null;

  const refreshUnreadCounts = useCallback(async () => {
    if (!supabase || !user) return;
    const { data, error } = await supabase.rpc("get_unread_counts");
    if (error) { setNotice(error.message); return; }
    setUnreadCounts(Object.fromEntries((data ?? []).map((row: any) => [row.conversation_id, Number(row.unread_count)])));
  }, [supabase, user]);

  const loadConversations = useCallback(async (currentUser: User) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("conversation_members")
      .select("conversation_id, role, conversations(id,type,title,description,is_private,is_announcement_only,message_ttl_seconds,last_message_at)")
      .eq("user_id", currentUser.id);
    if (error) { setNotice(error.message); return; }
    let list = (data ?? []).map((row: any) => ({ ...row.conversations, role: row.role })).filter((item: any) => item?.id) as Conversation[];
    const directIds = list.filter((item) => item.type === "direct").map((item) => item.id);
    if (directIds.length) {
      const { data: peers } = await supabase.from("conversation_members").select("conversation_id,user_id").in("conversation_id", directIds).neq("user_id", currentUser.id);
      const peerIds = [...new Set((peers ?? []).map((peer: any) => peer.user_id))];
      const { data: peerProfiles } = peerIds.length ? await supabase.from("profiles").select("id,display_name").in("id", peerIds) : { data: [] };
      list = list.map((item) => {
        if (item.type !== "direct") return item;
        const peer = (peers ?? []).find((entry: any) => entry.conversation_id === item.id);
        const profile = (peerProfiles ?? []).find((entry: any) => entry.id === peer?.user_id);
        return { ...item, title: profile?.display_name ?? item.title };
      });
    }
    list.sort((a, b) => {
      if (a.id === LOUNGE_ID) return -1;
      if (b.id === LOUNGE_ID) return 1;
      return (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "");
    });
    setConversations(list);
    setActiveId((current) => list.some((item) => item.id === current) ? current : (list[0]?.id ?? ""));
    void refreshUnreadCounts();
  }, [supabase, refreshUnreadCounts]);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!supabase || !conversationId) return;
    const { data, error } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_id,body,message_type,reply_to_id,topic_id,forwarded_from_id,created_at,edited_at,deleted_at,sender:profiles!messages_sender_id_fkey(display_name,avatar_url),topic:conversation_topics(name),attachments(id,file_name,mime_type,size_bytes,object_path),reactions:message_reactions(emoji,user_id),receipts:message_receipts(user_id,read_at),polls(id,question,allows_multiple,closes_at,poll_options(id,label,position),poll_votes(option_id,user_id)),reply:messages!messages_reply_to_id_fkey(id,body,sender:profiles!messages_sender_id_fkey(display_name))")
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
    void refreshUnreadCounts();
  }, [supabase, user, refreshUnreadCounts]);

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
      const { data: profile } = await supabase.from("profiles").select("display_name,username,avatar_url,show_last_seen,show_online_status").eq("id", user.id).maybeSingle();
      setProfileName(profile?.display_name ?? cleanName);
      setProfileUsername(profile?.username ?? "");
      setAvatarUrl(profile?.avatar_url ?? "");
      const deviceKey = "syncspace.device." + user.id;
      let deviceId = window.localStorage.getItem(deviceKey);
      if (!deviceId) { deviceId = crypto.randomUUID(); window.localStorage.setItem(deviceKey, deviceId); }
      setCurrentDeviceId(deviceId);
      const deviceName = (navigator.userAgent || "Browser").slice(0, 120);
      const platform = ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || "Web").slice(0, 80);
      const { error: deviceError } = await supabase.from("user_devices").upsert({ id: deviceId, user_id: user.id, device_name: deviceName, platform, last_seen_at: new Date().toISOString() }, { onConflict: "id" });
      if (deviceError) setNotice("Device registration: " + deviceError.message);
      setShowLastSeen(profile?.show_last_seen ?? true);
      setShowOnlineStatus(profile?.show_online_status ?? true);
      void supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
      await loadConversations(user);
      await refreshStatuses();
    })();
  }, [user, supabase, loadConversations]);

  const refreshConversationMembers = useCallback(async (conversationId: string) => {
    if (!supabase) return;
    const { data: rows, error } = await supabase.from("conversation_members").select("user_id,role").eq("conversation_id", conversationId);
    if (error) { setNotice(error.message); return; }
    const ids = (rows ?? []).map((row: any) => row.user_id);
    const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,display_name,username,avatar_url").in("id", ids) : { data: [] };
    setConversationMembers((rows ?? []).map((row: any) => {
      const profile = (profiles ?? []).find((item: any) => item.id === row.user_id);
      return { ...row, display_name: profile?.display_name ?? "Member", username: profile?.username ?? null, avatar_url: profile?.avatar_url ?? null };
    }));
  }, [supabase]);

  useEffect(() => {
    if (!activeId || !supabase || !user) { setMessages([]); return; }
    void loadMessages(activeId);
    const channel = supabase.channel("conversation:" + activeId, {
      config: { presence: { key: user.id } },
    });
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members", filter: "conversation_id=eq." + activeId }, () => { void loadConversations(user); void refreshConversationMembers(activeId); })
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
        if (status === "SUBSCRIBED" && showOnlineStatus) await channel.track({ userId: user.id, name: profileName || user.email, online_at: new Date().toISOString() });
      });
    channelRef.current = channel;
    return () => { void supabase.removeChannel(channel); channelRef.current = null; };
  }, [activeId, supabase, user, loadMessages, loadConversations, refreshConversationMembers, profileName, showOnlineStatus]);



  useEffect(() => {
    if (!supabase || !user || search.trim().length < 2) { setSearchResults([]); return; }
    let alive = true;
    const timeout = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_messages", { p_query: search.trim(), p_limit: 50 });
      if (!alive) return;
      if (error) setNotice(error.message);
      else setSearchResults((data ?? []) as {message_id:string;conversation_id:string;sender_id:string;body:string;created_at:string}[]);
    }, 350);
    return () => { alive = false; window.clearTimeout(timeout); };
  }, [search, user, supabase]);

  useEffect(() => {
    if (!supabase || !user || !activeId) { setDraftReady(false); return; }
    let alive = true;
    setDraftReady(false);
    setDraft("");
    void supabase.from("message_drafts").select("body").eq("user_id", user.id).eq("conversation_id", activeId).maybeSingle().then(({ data, error }) => {
      if (!alive) return;
      if (error) setNotice(error.message);
      setDraft(data?.body ?? "");
      setDraftReady(true);
    });
    return () => { alive = false; };
  }, [activeId, user, supabase]);

  useEffect(() => {
    if (!supabase || !user || !activeId || !draftReady) return;
    const timeout = window.setTimeout(() => {
      if (!draft.trim()) {
        void supabase.from("message_drafts").delete().eq("user_id", user.id).eq("conversation_id", activeId);
      } else {
        void supabase.from("message_drafts").upsert({
          user_id: user.id, conversation_id: activeId, body: draft.slice(0, 20000), updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,conversation_id" });
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [draft, draftReady, activeId, user, supabase]);

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




  useEffect(() => { if (user && supabase) void loadFolders(); }, [user, supabase]);
  useEffect(() => {
    if (!supabase || !activeId) { setConversationMembers([]); return; }
    void refreshConversationMembers(activeId);
  }, [activeId, supabase, refreshConversationMembers]);

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
      type: newType, title, created_by: user.id, is_private: newType === "group" ? true : newChannelPrivate,
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

  async function exportConversationHistory() {
    if (!supabase || !activeConversation || !user) return;
    setBusy(true);
    const exported: any[] = [];
    const pageSize = 500;
    let truncated = false;
    for (let from = 0; from < 10000; from += pageSize) {
      const { data, error } = await supabase.from("messages")
        .select("id,sender_id,body,message_type,reply_to_id,forwarded_from_id,topic_id,created_at,edited_at,deleted_at,attachments(file_name,mime_type,size_bytes,object_path)")
        .eq("conversation_id", activeConversation.id).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, from + pageSize - 1);
      if (error) { setNotice(error.message); setBusy(false); return; }
      exported.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
      if (from + pageSize >= 10000) truncated = true;
    }
    const payload = { format: "syncspace-conversation-export-v1", exported_at: new Date().toISOString(), conversation: { id: activeConversation.id, title: activeConversation.title, type: activeConversation.type }, message_count: exported.length, truncated, attachment_note: "Attachment metadata and private object paths are included; file bytes are not embedded.", messages: exported };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "syncspace-" + (activeConversation.title || "conversation").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-export.json";
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBusy(false);
    setNotice("Exported " + exported.length + " messages" + (truncated ? " (10,000-message export limit reached)" : "") + ". Attachment file contents are not included.");
  }

  async function openChannelAnalytics() {
    if (!supabase || !activeConversation || activeConversation.type !== "channel" || !["owner","admin"].includes(activeConversation.role ?? "")) return;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [members, messagesTotal, messagesRecent, files] = await Promise.all([
      supabase.from("conversation_members").select("user_id", { count: "exact", head: true }).eq("conversation_id", activeConversation.id),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", activeConversation.id).is("deleted_at", null),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", activeConversation.id).gte("created_at", since).is("deleted_at", null),
      supabase.from("attachments").select("id", { count: "exact", head: true }).eq("conversation_id", activeConversation.id),
    ]);
    const error = members.error || messagesTotal.error || messagesRecent.error || files.error;
    if (error) { setNotice(error.message); return; }
    setChannelAnalytics({ members: members.count ?? 0, messages: messagesTotal.count ?? 0, messages30d: messagesRecent.count ?? 0, files: files.count ?? 0 });
    setShowAnalytics(true);
  }

  async function openDiscoverChannels() {
    if (!supabase || !user) return;
    const { data: joined, error: joinedError } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", user.id);
    if (joinedError) { setNotice(joinedError.message); return; }
    const joinedIds = (joined ?? []).map((item) => item.conversation_id);
    let query = supabase.from("conversations").select("id,title,description,last_message_at").eq("type", "channel").eq("is_private", false).order("last_message_at", { ascending: false }).limit(100);
    if (joinedIds.length) query = query.not("id", "in", "(" + joinedIds.join(",") + ")");
    const { data, error } = await query;
    if (error) { setNotice(error.message); return; }
    setPublicChannels((data ?? []) as {id:string;title:string;description:string|null;last_message_at:string|null}[]);
    setShowDiscoverChannels(true);
  }

  async function joinPublicChannel(channelId: string) {
    if (!supabase || !user) return;
    const { error } = await supabase.from("conversation_members").insert({ conversation_id: channelId, user_id: user.id, role: "member" });
    if (error) { setNotice(error.code === "23505" ? "You already follow this channel." : error.message); return; }
    const channel = publicChannels.find((item) => item.id === channelId);
    setPublicChannels((current) => current.filter((item) => item.id !== channelId));
    await loadConversations(user);
    setActiveId(channelId);
    setNotice("You joined " + (channel?.title || "the channel") + ". Only channel admins can publish posts.");
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


  async function transferOwnership(memberId: string) {
    if (!supabase || !user || !activeConversation || activeConversation.role !== "owner" || activeConversation.type === "direct") return;
    const target = conversationMembers.find((member) => member.user_id === memberId);
    if (!target || !window.confirm("Transfer ownership of " + (activeConversation.title || "this conversation") + " to " + target.display_name + "? You will become an admin.")) return;
    const { error } = await supabase.rpc("transfer_conversation_ownership", {
      p_conversation_id: activeConversation.id,
      p_new_owner_id: memberId,
    });
    if (error) { setNotice(error.message); return; }
    setConversationMembers((current) => current.map((member) => member.user_id === user.id ? { ...member, role: "admin" } : member.user_id === memberId ? { ...member, role: "owner" } : member));
    setConversations((current) => current.map((conversation) => conversation.id === activeConversation.id ? { ...conversation, role: "admin" } : conversation));
    setNotice("Ownership transferred to " + target.display_name + ". You are now an admin.");
  }

  async function changeMemberRole(memberId: string, role: string) {
    if (!supabase || !activeConversation) return;
    const { error } = await supabase.from("conversation_members").update({ role }).eq("conversation_id", activeConversation.id).eq("user_id", memberId);
    if (error) setNotice(error.message);
    else { setConversationMembers((current) => current.map((member) => member.user_id === memberId ? { ...member, role } : member)); setNotice("Member role updated."); }
  }

  async function removeConversationMember(memberId: string) {
    if (!supabase || !activeConversation || !window.confirm("Remove this person from the conversation?")) return;
    const { error } = await supabase.from("conversation_members").delete().eq("conversation_id", activeConversation.id).eq("user_id", memberId);
    if (error) setNotice(error.message);
    else { setConversationMembers((current) => current.filter((member) => member.user_id !== memberId)); setNotice("Member removed."); }
  }

  async function leaveConversation() {
    if (!supabase || !user || !activeConversation) return;
    if (!window.confirm("Leave this conversation? You will need a new invitation to rejoin.")) return;
    const { error } = await supabase.from("conversation_members").delete().eq("conversation_id", activeConversation.id).eq("user_id", user.id);
    if (error) setNotice(error.message);
    else { setShowMembers(false); await loadConversations(user); setNotice("You left the conversation."); }
  }

  async function addMember(memberId: string) {
    if (!supabase || !activeConversation) return;
    if (activeConversation.type === "direct") { setNotice("Use a group or channel to add more people."); return; }
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
    const { data: blocked } = await supabase.from("user_blocks").select("id").eq("blocker_id", user.id).eq("blocked_id", member.id).maybeSingle();
    if (blocked) { setNotice("Unblock this person before starting a direct conversation."); return; }
    const directIds = conversations.filter((item) => item.type === "direct").map((item) => item.id);
    if (directIds.length) {
      const { data: existing } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", member.id).in("conversation_id", directIds).limit(1);
      if (existing?.[0]?.conversation_id) {
        setShowMembers(false); setActiveId(existing[0].conversation_id); setNotice("Opened your existing direct conversation."); return;
      }
    }
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
    if ((!statusFile.type.startsWith("image/") && !statusFile.type.startsWith("video/")) || statusFile.type === "image/svg+xml") { setNotice("Status updates must be raster images or videos."); return; }
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
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") { setNotice("Choose a raster image (PNG, JPG, WebP) for your profile picture."); return; }
    if (file.size > 5 * 1024 * 1024) { setNotice("Profile pictures must be 5 MB or smaller."); return; }
    const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
    const path = user.id + "/" + crypto.randomUUID() + "." + extension;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setNotice(error.message); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setNotice("Profile picture uploaded. Save your profile to apply it.");
  }


  async function openProfile() {
    if (!supabase || !user) return;
    const { data: blocks } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user.id);
    const ids = (blocks ?? []).map((item: any) => item.blocked_id);
    const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,display_name,username").in("id", ids) : { data: [] };
    setBlockedUsers((profiles ?? []).map((item: any) => ({ id: item.id, display_name: item.display_name, username: item.username })));
    const { data: deviceRows, error: deviceError } = await supabase.from("user_devices").select("id,device_name,platform,last_seen_at,created_at").eq("user_id", user.id).order("last_seen_at", { ascending: false });
    if (deviceError) setNotice(deviceError.message);
    setDevices((deviceRows ?? []) as {id:string;device_name:string|null;platform:string|null;last_seen_at:string;created_at:string}[]);
    setShowProfile(true);
  }

  async function unblockUser(blockedId: string) {
    if (!supabase || !user) return;
    const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", blockedId);
    if (error) setNotice(error.message);
    else { setBlockedUsers((current) => current.filter((item) => item.id !== blockedId)); setNotice("Account unblocked."); }
  }

  async function signOutOtherSessions() {
    if (!supabase || !user || !window.confirm("Sign out every other SyncSpace session? Other devices may remain active until their current access token expires.")) return;
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) { setNotice(error.message); return; }
    if (currentDeviceId) await supabase.from("user_devices").delete().eq("user_id", user.id).neq("id", currentDeviceId);
    await openProfile();
    setNotice("Other refresh sessions have been revoked. Existing access tokens can remain valid until they expire.");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    const cleanUsername = profileUsername.trim().replace(/^@/, "");
    if (cleanUsername && !/^[A-Za-z0-9_]{3,24}$/.test(cleanUsername)) { setNotice("Username must be 3–24 characters using letters, numbers or underscores."); return; }
    const { error } = await supabase.from("profiles").update({ display_name: profileName.trim().slice(0, 60), username: cleanUsername || null, avatar_url: avatarUrl || null, show_last_seen: showLastSeen, show_online_status: showOnlineStatus }).eq("id", user.id);
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





  async function loadFolders() {
    if (!supabase || !user) return;
    const { data: folderRows, error } = await supabase.from("conversation_folders").select("id,name,position").eq("user_id", user.id).order("position");
    if (error) { setNotice(error.message); return; }
    const { data: items } = await supabase.from("conversation_folder_items").select("folder_id,conversation_id");
    setFolders((folderRows ?? []) as ConversationFolder[]);
    setFolderAssignments(Object.fromEntries((items ?? []).map((item: any) => [item.conversation_id, item.folder_id])));
  }

  async function createFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !newFolderName.trim()) return;
    const { data, error } = await supabase.from("conversation_folders").insert({ user_id: user.id, name: newFolderName.trim().slice(0, 40), position: folders.length }).select("id,name,position").single();
    if (error) setNotice(error.message);
    else { setFolders((current) => [...current, data]); setNewFolderName(""); setNotice("Folder created."); }
  }

  async function assignActiveConversation(folderId: string) {
    if (!supabase || !activeConversation) return;
    const { error: deleteError } = await supabase.from("conversation_folder_items").delete().eq("conversation_id", activeConversation.id);
    if (deleteError) { setNotice(deleteError.message); return; }
    if (folderId) {
      const { error } = await supabase.from("conversation_folder_items").insert({ folder_id: folderId, conversation_id: activeConversation.id });
      if (error) { setNotice(error.message); return; }
    }
    setFolderAssignments((current) => {
      const next = { ...current };
      if (folderId) next[activeConversation.id] = folderId;
      else delete next[activeConversation.id];
      return next;
    });
    setNotice(folderId ? "Conversation added to folder." : "Conversation removed from folders.");
  }


  async function openSharedMedia() {
    if (!supabase || !activeConversation) return;
    const { data, error } = await supabase.from("attachments")
      .select("id,file_name,mime_type,size_bytes,object_path,created_at")
      .eq("conversation_id", activeConversation.id)
      .order("created_at", { ascending: false }).limit(100);
    if (error) { setNotice(error.message); return; }
    const items = await Promise.all((data ?? []).map(async (item: any) => {
      const { data: signed, error: signedError } = await supabase.storage.from("conversation-files").createSignedUrl(item.object_path, 3600);
      return signedError || !signed?.signedUrl ? null : { ...item, signedUrl: signed.signedUrl } as SharedMediaItem;
    }));
    setSharedMedia(items.filter((item): item is SharedMediaItem => !!item));
    setShowMedia(true);
  }

  async function openPinnedMessages() {
    if (!supabase || !activeConversation) return;
    const { data: pins, error } = await supabase.from("message_pins").select("id,message_id").eq("conversation_id", activeConversation.id).order("created_at", { ascending: false });
    if (error) { setNotice(error.message); return; }
    const ids = (pins ?? []).map((item: any) => item.message_id);
    const { data: rows } = ids.length ? await supabase.from("messages").select("id,body,conversation_id,created_at").in("id", ids) : { data: [] };
    setPinnedMessages((pins ?? []).map((item: any) => ({ ...item, message: (rows ?? []).find((row: any) => row.id === item.message_id) })));
    setShowPinned(true);
  }

  async function unpinMessage(pinId: string) {
    if (!supabase) return;
    const { error } = await supabase.from("message_pins").delete().eq("id", pinId);
    if (error) setNotice(error.message);
    else setPinnedMessages((current) => current.filter((item) => item.id !== pinId));
  }


  async function shareContact(memberId: string) {
    if (!supabase || !user || !activeConversation) return;
    const member = conversationMembers.find((item) => item.user_id === memberId);
    if (!member) return;
    const card: ContactCard = { id: member.user_id, display_name: member.display_name, username: member.username, avatar_url: member.avatar_url };
    const { error } = await supabase.from("messages").insert({
      conversation_id: activeConversation.id, sender_id: user.id,
      body: JSON.stringify(card), message_type: "contact", topic_id: topicId || null,
    });
    if (error) { setNotice(error.message); return; }
    setShowContacts(false);
    setNotice("Contact card shared.");
    await loadMessages(activeId);
  }

  async function openMentions() {
    if (!supabase || !user) return;
    const { data, error } = await supabase.from("message_mentions")
      .select("message_id,created_at,message:messages!message_mentions_message_id_fkey(id,body,conversation_id,created_at,sender:profiles!messages_sender_id_fkey(display_name))")
      .eq("mentioned_user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) { setNotice(error.message); return; }
    setMentionItems((data ?? []) as any[]);
    setShowMentions(true);
  }

  async function openSavedMessages() {
    if (!supabase || !user) return;
    const { data: saves, error } = await supabase.from("saved_messages").select("message_id,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200);
    if (error) { setNotice(error.message); return; }
    const ids = (saves ?? []).map((item: any) => item.message_id);
    const { data: rows } = ids.length ? await supabase.from("messages").select("id,body,conversation_id,created_at").in("id", ids) : { data: [] };
    setSavedMessages((saves ?? []).map((item: any) => ({ ...item, message: (rows ?? []).find((row: any) => row.id === item.message_id) })));
    setShowSaved(true);
  }

  async function forwardTo(targetId: string) {
    if (!supabase || !user) return;
    const original = messages.find((item) => item.id === forwardMessageId);
    if (!original) return;
    const sourceFiles = original.attachments ?? [];
    const copiedFiles: { source: typeof sourceFiles[number]; path: string }[] = [];
    for (const sourceFile of sourceFiles) {
      const safeName = sourceFile.file_name.replace(/[^\w.\-() ]/g, "_").slice(0, 120) || "forwarded-file";
      const path = targetId + "/" + user.id + "/" + crypto.randomUUID() + "-" + safeName;
      const { error: copyError } = await supabase.storage.from("conversation-files").copy(sourceFile.object_path, path);
      if (copyError) {
        if (copiedFiles.length) await supabase.storage.from("conversation-files").remove(copiedFiles.map((item) => item.path));
        setNotice(copyError.message); return;
      }
      copiedFiles.push({ source: sourceFile, path });
    }
    if (!original.body && !sourceFiles.length) { setNotice("This message cannot be forwarded."); return; }
    const { data: forwarded, error } = await supabase.from("messages").insert({
      conversation_id: targetId, sender_id: user.id, body: original.body || sourceFiles.map((file) => file.file_name).join(", "),
      message_type: original.message_type, forwarded_from_id: original.id,
    }).select("id").single();
    if (error) {
      if (copiedFiles.length) await supabase.storage.from("conversation-files").remove(copiedFiles.map((item) => item.path));
      setNotice(error.message); return;
    }
    if (copiedFiles.length) {
      const { error: attachmentError } = await supabase.from("attachments").insert(copiedFiles.map(({ source, path }) => ({
        message_id: forwarded.id, conversation_id: targetId, uploaded_by: user.id,
        bucket_id: "conversation-files", object_path: path,
        file_name: source.file_name, mime_type: source.mime_type, size_bytes: source.size_bytes,
      })));
      if (attachmentError) {
        await supabase.storage.from("conversation-files").remove(copiedFiles.map((item) => item.path));
        await supabase.from("messages").update({ deleted_at: new Date().toISOString(), body: "Forward failed." }).eq("id", forwarded.id).eq("sender_id", user.id);
        setNotice(attachmentError.message); return;
      }
    }
    setForwardMessageId("");
    await loadConversations(user);
    setActiveId(targetId);
    setNotice("Message forwarded.");
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

  async function saveMessageExpiry() {
    if (!supabase || !activeConversation) return;
    const seconds = Number(ttlSeconds);
    const { error } = await supabase.from("conversations").update({ message_ttl_seconds: seconds > 0 ? seconds : null }).eq("id", activeConversation.id);
    if (error) setNotice(error.message);
    else {
      setConversations((current) => current.map((item) => item.id === activeConversation.id ? { ...item, message_ttl_seconds: seconds > 0 ? seconds : null } : item));
      setShowConversationSettings(false);
      setNotice(seconds > 0 ? "Disappearing messages enabled for new messages." : "Disappearing messages disabled.");
    }
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



  async function shareCurrentLocation() {
    if (!supabase || !user || !activeConversation) return;
    if (!navigator.geolocation) { setNotice("Location sharing is not supported in this browser."); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const coordinates = position.coords.latitude.toFixed(6) + "," + position.coords.longitude.toFixed(6);
      const { error } = await supabase.from("messages").insert({
        conversation_id: activeConversation.id, sender_id: user.id,
        body: "https://www.google.com/maps?q=" + coordinates,
        message_type: "location", topic_id: topicId || null,
      });
      setBusy(false);
      setNotice(error ? error.message : "Your current location was shared with this conversation.");
      if (!error) await loadMessages(activeId);
    }, (error) => {
      setBusy(false);
      setNotice(error.message || "Location permission was not granted.");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }

  async function toggleVoiceRecording() {
    if (!supabase || !user || !activeConversation) return;
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNotice("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorderStreamRef.current = stream;
      recorderChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) recorderChunksRef.current.push(event.data); };
      recorder.onerror = () => { setNotice("The voice recording failed."); setRecording(false); stream.getTracks().forEach((track) => track.stop()); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        recorderStreamRef.current = null;
        const blob = new Blob(recorderChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        recorderChunksRef.current = [];
        if (!blob.size) { setNotice("No audio was recorded."); return; }
        if (blob.size > 50 * 1024 * 1024) { setNotice("This recording is larger than the 50 MB limit."); return; }
        const extension = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
        const fileName = "voice-message-" + Date.now() + "." + extension;
        const path = activeConversation.id + "/" + user.id + "/" + crypto.randomUUID() + "-" + fileName;
        setUploading(true);
        const { error: uploadError } = await supabase.storage.from("conversation-files").upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false });
        if (uploadError) { setNotice(uploadError.message); setUploading(false); return; }
        const { data: message, error: messageError } = await supabase.from("messages").insert({
          conversation_id: activeConversation.id, sender_id: user.id, body: "Voice message",
          message_type: "voice", reply_to_id: replyTo?.id ?? null, topic_id: topicId || null,
        }).select("id").single();
        if (messageError) { await supabase.storage.from("conversation-files").remove([path]); setNotice(messageError.message); setUploading(false); return; }
        const { error: attachmentError } = await supabase.from("attachments").insert({
          message_id: message.id, conversation_id: activeConversation.id, uploaded_by: user.id,
          bucket_id: "conversation-files", object_path: path, file_name: fileName,
          mime_type: blob.type || "audio/webm", size_bytes: blob.size,
        });
        if (attachmentError) { await supabase.storage.from("conversation-files").remove([path]); setNotice(attachmentError.message); }
        else { setNotice("Voice message sent."); setReplyTo(null); await loadMessages(activeId); }
        setUploading(false);
      };
      recorder.start();
      setRecording(true);
      setNotice("Recording… press Stop when you are finished.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Microphone access was denied.");
      setRecording(false);
    }
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || !supabase || !user || !activeConversation) return;
    if (files.length > 10) { setNotice("Share up to 10 files in one album."); return; }
    const totalSize = files.reduce((total, file) => total + file.size, 0);
    if (files.some((file) => /\.(exe|dll|bat|cmd|ps1|sh|msi|apk|com|scr|vbs|js|html?|svg|jar)$/i.test(file.name) || file.type === "image/svg+xml")) { setNotice("This potentially executable file type is blocked."); return; }
    if (files.some((file) => file.size > 50 * 1024 * 1024) || totalSize > 100 * 1024 * 1024) { setNotice("Each file must be 50 MB or smaller and an album must total 100 MB or less."); return; }
    setUploading(true);
    const uploaded: { path:string; file:File; safeName:string }[] = [];
    for (const file of files) {
      const safeName = file.name.replace(/[^\w.\-() ]/g, "_").slice(0, 120) || "attachment";
      const path = activeConversation.id + "/" + user.id + "/" + crypto.randomUUID() + "-" + safeName;
      const { error } = await supabase.storage.from("conversation-files").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (error) {
        if (uploaded.length) await supabase.storage.from("conversation-files").remove(uploaded.map((item) => item.path));
        setNotice(error.message); setUploading(false); return;
      }
      uploaded.push({ path, file, safeName });
    }
    const allImages = files.every((file) => file.type.startsWith("image/"));
    const allVideos = files.every((file) => file.type.startsWith("video/"));
    const messageType = allImages ? "image" : allVideos ? "video" : files.length === 1 && files[0].type.startsWith("audio/") ? "audio" : "file";
    const body = files.length === 1 ? files[0].name : "Shared " + files.length + " attachments";
    const { data: message, error: messageError } = await supabase.from("messages").insert({
      conversation_id: activeConversation.id, sender_id: user.id, body,
      message_type: messageType, reply_to_id: replyTo?.id ?? null, topic_id: topicId || null,
    }).select("id").single();
    if (messageError) {
      await supabase.storage.from("conversation-files").remove(uploaded.map((item) => item.path));
      setNotice(messageError.message); setUploading(false); return;
    }
    const { error: attachmentError } = await supabase.from("attachments").insert(uploaded.map(({ path, file }) => ({
      message_id: message.id, conversation_id: activeConversation.id, uploaded_by: user.id,
      bucket_id: "conversation-files", object_path: path, file_name: file.name,
      mime_type: file.type || "application/octet-stream", size_bytes: file.size,
    })));
    if (attachmentError) {
      await supabase.storage.from("conversation-files").remove(uploaded.map((item) => item.path));
      await supabase.from("messages").delete().eq("id", message.id).eq("sender_id", user.id);
      setNotice("The album could not be saved: " + attachmentError.message);
    } else {
      setNotice(files.length > 1 ? "Album shared with " + files.length + " files." : "Attachment shared.");
      setReplyTo(null); await loadMessages(activeId);
    }
    setUploading(false);
  }

  function notifyTyping(value: string) {
    setDraft(value);
    if (channelRef.current && user) void channelRef.current.send({ type: "broadcast", event: "typing", payload: { userId: user.id, name: profileName || "Someone" } });
  }

  const visibleMessages = messages;

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
            <button onClick={() => void openProfile()} style={{ ...secondaryButton, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}> {profileName || user.email} </button>
            <button onClick={signOut} style={secondaryButton}>Sign out</button>
          </div>
          <div style={{ position: "relative" }}><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search all messages…" style={{ ...inputStyle, marginBottom: 12 }} />{search.trim().length >= 2 && <div style={{ position: "absolute", zIndex: 20, top: 48, left: 0, right: 0, maxHeight: 320, overflowY: "auto", background: "#101a2b", border: "1px solid #354663", borderRadius: 10, padding: 8, boxShadow: "0 12px 30px #0008" }}>{searchResults.map((item) => <button key={item.message_id} onClick={() => { setActiveId(item.conversation_id); setSearch(""); }} style={{ ...secondaryButton, display: "block", width: "100%", textAlign: "left", marginBottom: 5 }}><strong style={{ display: "block", fontSize: 12 }}>{item.body.slice(0, 150)}</strong><small style={{ color: "#8193b1" }}>{new Date(item.created_at).toLocaleString()}</small></button>)}{!searchResults.length && <small style={{ color: "#8193b1" }}>No matching messages found.</small>}</div>}</div>
          <div style={{ display: "flex", gap: 7, margin: "4px 0 12px" }}><button onClick={() => setShowAddStatus(true)} style={{ ...secondaryButton, flex: 1 }}>＋ Add status</button><button onClick={() => { void refreshStatuses(); setShowStatuses(true); }} style={{ ...secondaryButton, flex: 1 }}>Status · {statuses.length}</button></div>
          <button onClick={() => void openDiscoverChannels()} style={{ ...secondaryButton, width: "100%", marginBottom: 7, textAlign: "left" }}>Discover public channels</button><button onClick={() => void openMentions()} style={{ ...secondaryButton, width: "100%", marginBottom: 7, textAlign: "left" }}>@ Mentions</button><button onClick={() => void openSavedMessages()} style={{ ...secondaryButton, width: "100%", marginBottom: 7, textAlign: "left" }}>★ Saved Messages</button><button onClick={() => setShowFolders(true)} style={{ ...secondaryButton, width: "100%", marginBottom: 7, textAlign: "left" }}>Folders · {folders.length}</button><div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 9 }}><button onClick={() => setSelectedFolderId("")} style={{ ...secondaryButton, padding: "5px 8px", background: !selectedFolderId ? "#263f68" : undefined }}>All</button>{folders.map((folder) => <button key={folder.id} onClick={() => setSelectedFolderId(folder.id)} style={{ ...secondaryButton, padding: "5px 8px", background: selectedFolderId === folder.id ? "#263f68" : undefined }}>{folder.name}</button>)}</div>
          <div style={{ color: "#7184a3", fontSize: 11, letterSpacing: 1.5, margin: "8px 0" }}>YOUR CONVERSATIONS</div>
          <div style={{ display: "grid", gap: 7, overflowY: "auto" }}>
            {conversations.map((conversation) => (
              <button key={conversation.id} onClick={() => setActiveId(conversation.id)} style={{ textAlign: "left", padding: 12, borderRadius: 10, border: "1px solid " + (activeId === conversation.id ? "#6386d4" : "#26334b"), background: activeId === conversation.id ? "#1b2d4b" : "transparent", color: "#e7eefb", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}><span>{conversation.type === "channel" ? "📢" : conversation.id === LOUNGE_ID ? "🌐" : "👥"}</span><strong style={{ fontSize: 13 }}>{conversation.title || "Direct message"}</strong>{!!unreadCounts[conversation.id] && <span style={{ marginLeft: "auto", minWidth: 20, padding: "2px 6px", borderRadius: 99, background: "#86a8ff", color: "#081020", fontSize: 10, fontWeight: 800, textAlign: "center" }}>{unreadCounts[conversation.id] > 99 ? "99+" : unreadCounts[conversation.id]}</span>}</div>
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
              <div><strong style={{ fontSize: 17 }}>{activeConversation.title || "Conversation"}</strong><div style={{ color: "#8193b1", fontSize: 12, marginTop: 4 }}>{activeConversation.is_private ? "Private conversation" : "Public community"} · {onlineCount} online{activeConversation.is_announcement_only ? " · Announcements" : ""}{activeConversation.message_ttl_seconds ? " · Disappearing " + (activeConversation.message_ttl_seconds / 3600 >= 24 ? (activeConversation.message_ttl_seconds / 86400) + "d" : (activeConversation.message_ttl_seconds / 3600) + "h") : ""}</div></div>
              <div style={{ display: "flex", gap: 8 }}><button onClick={() => void exportConversationHistory()} disabled={busy} style={secondaryButton}>Export</button><button onClick={() => setShowSchedule(true)} style={secondaryButton}>Scheduled</button>{["owner","admin"].includes(activeConversation.role ?? "") && <button onClick={() => { setTtlSeconds(String(activeConversation.message_ttl_seconds ?? 0)); setShowConversationSettings(true); }} style={secondaryButton}>Privacy</button>}{activeConversation.type === "channel" && ["owner","admin"].includes(activeConversation.role ?? "") && <button onClick={() => void openChannelAnalytics()} style={secondaryButton}>Analytics</button>}<button onClick={() => void openSharedMedia()} style={secondaryButton}>Media</button><button onClick={() => void openPinnedMessages()} style={secondaryButton}>Pinned</button><button onClick={() => setShowTopics(true)} style={secondaryButton}>Topics</button><button onClick={() => setShowMembers(true)} style={secondaryButton}>Members / invite</button></div>
            </header>
            <div aria-live="polite" style={{ flex: 1, minHeight: 400, maxHeight: "calc(100vh - 230px)", overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {visibleMessages.map((message) => {
                const mine = message.sender_id === user.id;
                const files = message.attachments ?? [];
                const poll = Array.isArray(message.polls) ? message.polls[0] : message.polls;
                const contactCard = message.message_type === "contact" ? parseContactCard(message.body) : null;
                const reply = Array.isArray(message.reply) ? message.reply[0] : message.reply;
                return <article key={message.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "min(82%, 720px)", minWidth: 130 }}>
                  <div style={{ color: mine ? "#9db8ff" : "#8ce0b0", fontSize: 11, margin: "0 5px 5px" }}>{message.forwarded_from_id ? "↪ Forwarded · " : ""}{mine ? "You" : message.sender?.display_name || "Member"}{message.topic && <span> · #{(Array.isArray(message.topic) ? message.topic[0] : message.topic)?.name}</span>} · {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{message.edited_at ? " · Edited" : ""}{mine && message.receipts?.some((receipt) => receipt.read_at) ? " · ✓✓ Read" : ""}</div>
                  {reply && <div style={{ padding: "7px 10px", borderLeft: "3px solid #86a8ff", background: "#111f34", borderRadius: 7, color: "#aebfda", fontSize: 11, marginBottom: 4 }}>Replying to {reply.sender?.display_name || "member"}: {(reply.body || "Attachment").slice(0, 120)}</div>}
                  {editingId === message.id ? <div style={{ ...panel, padding: 9 }}><textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} /><div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}><button onClick={() => setEditingId("")} style={secondaryButton}>Cancel</button><button onClick={() => void editMessage(message.id)} style={primaryButton}>Save</button></div></div> : <div style={{ background: mine ? "#20365c" : "#1a2940", borderRadius: 13, padding: "11px 14px", lineHeight: 1.6, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                    {message.message_type === "location" ? <a href={message.body || "#"} target="_blank" rel="noreferrer" style={{ color: "#9db8ff" }}>📍 Open shared location in Maps</a> : contactCard ? <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 210 }}><img src={contactCard.avatar_url || "https://www.gravatar.com/avatar/?d=mp"} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} /><div><strong style={{ display: "block" }}>{contactCard.display_name}</strong><small style={{ color: "#9db8ff" }}>{contactCard.username ? "@" + contactCard.username : "SyncSpace member"}</small></div></div> : poll ? <div style={{ display: "grid", gap: 9, minWidth: 230 }}><strong>{poll.question}</strong>{[...poll.poll_options].sort((a,b) => a.position-b.position).map((option) => { const count = poll.poll_votes.filter((vote) => vote.option_id === option.id).length; const selected = poll.poll_votes.some((vote) => vote.option_id === option.id && vote.user_id === user.id); const total = poll.poll_votes.length; return <button key={option.id} onClick={() => void votePoll(poll, option.id)} disabled={!!poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now()} style={{ textAlign: "left", padding: 9, borderRadius: 8, border: "1px solid " + (selected ? "#86a8ff" : "#40516c"), background: selected ? "#263f68" : "#15243a", color: "#e7eefb" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span>{selected ? "✓ " : ""}{option.label}</span><small>{count}</small></div><div style={{ height: 4, background: "#34445d", borderRadius: 5, marginTop: 7 }}><div style={{ width: (total ? Math.round(count / total * 100) : 0) + "%", height: "100%", background: "#86a8ff", borderRadius: 5 }} /></div></button>; })}<small style={{ color: "#aebfda" }}>{poll.poll_votes.length} vote(s) · {poll.allows_multiple ? "Multiple answers" : "Choose one"}{poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now() ? " · Closed" : ""}</small></div> : files.length ? <div style={{ display: "grid", gridTemplateColumns: files.length > 1 ? "repeat(2,minmax(0,1fr))" : "minmax(0,1fr)", gap: 8 }}>
                      {files.map((file) => <div key={file.id} style={{ minWidth: 0, display: "grid", gap: 6, padding: files.length > 1 ? 6 : 0, background: files.length > 1 ? "#14233a" : "transparent", borderRadius: 9 }}>
                        {file.mime_type?.startsWith("image/") && file.signedUrl && <a href={file.signedUrl} target="_blank" rel="noreferrer"><img src={file.signedUrl} alt={file.file_name} style={{ width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 8 }} /></a>}
                        {file.mime_type?.startsWith("video/") && file.signedUrl && <video src={file.signedUrl} controls style={{ width: "100%", maxHeight: 320 }} />}
                        {file.mime_type?.startsWith("audio/") && file.signedUrl && <audio src={file.signedUrl} controls style={{ width: "100%" }} />}
                        <a href={file.signedUrl} target="_blank" rel="noreferrer" style={{ color: "#c8d8ff", fontSize: 12, overflowWrap: "anywhere" }}>📎 {file.file_name}</a><small style={{ color: "#aebfda" }}>{(file.size_bytes / 1024 / 1024).toFixed(2)} MB</small>
                      </div>)}
                    </div> : message.body}</div>}
                  <div style={{ display: "flex", gap: 9, flexWrap: "wrap", margin: "6px 4px 0", alignItems: "center" }}>
                    {["👍","❤️","😂"].map((emoji) => <button key={emoji} onClick={() => void toggleReaction(message, emoji)} style={{ ...secondaryButton, padding: "3px 7px", fontSize: 11, borderColor: message.reactions?.some((r) => r.emoji === emoji && r.user_id === user.id) ? "#86a8ff" : "#354663" }}>{emoji} {message.reactions?.filter((r) => r.emoji === emoji).length || ""}</button>)}
                    <button onClick={() => setReplyTo(message)} style={{ border: 0, background: "transparent", color: "#9db8ff", fontSize: 11, cursor: "pointer" }}>↩ Reply</button>
                    <button onClick={() => void saveMessage(message)} style={{ border: 0, background: "transparent", color: "#9db8ff", fontSize: 11, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setForwardMessageId(message.id)} style={{ border: 0, background: "transparent", color: "#9db8ff", fontSize: 11, cursor: "pointer" }}>Forward</button>
                    {["owner","admin"].includes(activeConversation.role ?? "") && <button onClick={() => void pinMessage(message)} style={{ border: 0, background: "transparent", color: "#9db8ff", fontSize: 11, cursor: "pointer" }}>Pin</button>}
                    {mine && <>{message.message_type !== "contact" && <button onClick={() => { setEditingId(message.id); setEditDraft(message.body ?? ""); }} style={{ border: 0, background: "transparent", color: "#9db8ff", fontSize: 11, cursor: "pointer" }}>Edit</button>}<button onClick={() => void deleteMessage(message.id)} style={{ border: 0, background: "transparent", color: "#ff9eae", fontSize: 11, cursor: "pointer" }}>Delete</button></>}
                  </div>
                </article>;
              })}
              {!visibleMessages.length && <div style={{ margin: "auto", color: "#8193b1", textAlign: "center" }}>{search ? "No messages match your search." : "No messages yet. Start the conversation."}</div>}
              {typingName && <div style={{ color: "#9db8ff", fontSize: 12 }}>{typingName} is typing…</div>}
            </div>
            {replyTo && <div style={{ padding: "9px 16px", background: "#14233a", borderTop: "1px solid #26334b", display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12, color: "#aebfda" }}>Replying to {replyTo.sender?.display_name || "member"}: {(replyTo.body || "Attachment").slice(0, 90)}</span><button onClick={() => setReplyTo(null)} style={{ ...secondaryButton, padding: "2px 8px" }}>×</button></div>}
            <form onSubmit={sendMessage} style={{ padding: 14, borderTop: "1px solid #26334b", display: "flex", gap: 9, alignItems: "center" }}>
              <input ref={fileRef} type="file" multiple onChange={uploadFile} disabled={uploading} style={{ display: "none" }} />
              <select aria-label="Message topic" value={topicId} onChange={(e) => setTopicId(e.target.value)} style={{ ...inputStyle, width: 130, padding: "9px 8px" }}><option value="">No topic</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || recording} style={{ ...secondaryButton, fontSize: 19 }}>{uploading ? "…" : "＋"}</button>
              <button type="button" onClick={() => void toggleVoiceRecording()} disabled={uploading} style={{ ...secondaryButton, color: recording ? "#ff9eae" : "#cbd8ec" }}>{recording ? "Stop voice" : "Voice"}</button>
              <button type="button" onClick={() => setShowContacts(true)} style={secondaryButton}>Contact</button>
              <button type="button" onClick={() => void shareCurrentLocation()} disabled={busy} style={secondaryButton}>Location</button>
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
      {showFolders && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 480px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Conversation folders</h2><form onSubmit={createFolder} style={{ display: "flex", gap: 8 }}><input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} maxLength={40} placeholder="New folder name" required style={inputStyle} /><button style={primaryButton}>Create</button></form>{activeConversation && <div style={{ display: "grid", gap: 7 }}><strong style={{ fontSize: 12 }}>Organise current conversation</strong><select value={folderAssignments[activeConversation.id] || ""} onChange={(e) => void assignActiveConversation(e.target.value)} style={inputStyle}><option value="">No folder</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></div>}<button onClick={() => setShowFolders(false)} style={secondaryButton}>Close</button></section></div>}
      {showMedia && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 700px)", maxHeight: "88vh", overflowY: "auto", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Shared media and files</h2>{sharedMedia.map((item) => <div key={item.id} style={{ display: "grid", gap: 7, padding: 10, borderRadius: 9, background: "#14233a" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}><strong style={{ fontSize: 13 }}>{item.file_name}</strong><small style={{ color: "#8193b1" }}>{(item.size_bytes / 1024 / 1024).toFixed(1)} MB</small></div>{item.mime_type?.startsWith("image/") ? <img src={item.signedUrl} alt={item.file_name} style={{ maxWidth: "100%", maxHeight: 280, objectFit: "contain" }} /> : item.mime_type?.startsWith("video/") ? <video src={item.signedUrl} controls style={{ maxWidth: "100%", maxHeight: 280 }} /> : item.mime_type?.startsWith("audio/") ? <audio src={item.signedUrl} controls style={{ width: "100%" }} /> : <a href={item.signedUrl} target="_blank" rel="noreferrer" style={{ color: "#9db8ff" }}>Open / download file</a>}<small style={{ color: "#8193b1" }}>{new Date(item.created_at).toLocaleString()}</small></div>)}{!sharedMedia.length && <small style={{ color: "#8193b1" }}>No shared files in this conversation yet.</small>}<button onClick={() => setShowMedia(false)} style={secondaryButton}>Close</button></section></div>}
      {showPinned && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 560px)", maxHeight: "85vh", overflowY: "auto", padding: 22, display: "grid", gap: 10 }}><h2 style={{ margin: 0 }}>Pinned messages</h2>{pinnedMessages.filter((item) => item.message).map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", padding: 8, background: "#14233a", borderRadius: 8 }}><span style={{ fontSize: 13 }}>{item.message?.body || "Pinned attachment"}</span>{["owner","admin"].includes(activeConversation?.role ?? "") && <button onClick={() => void unpinMessage(item.id)} style={secondaryButton}>Unpin</button>}</div>)}{!pinnedMessages.some((item) => item.message) && <small style={{ color: "#8193b1" }}>No pinned messages in this conversation.</small>}<button onClick={() => setShowPinned(false)} style={secondaryButton}>Close</button></section></div>}
      {showContacts && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 500px)", maxHeight: "85vh", overflowY: "auto", padding: 22, display: "grid", gap: 10 }}><h2 style={{ margin: 0 }}>Share a contact</h2><small style={{ color: "#8193b1" }}>Choose a member of this conversation to share their SyncSpace contact card.</small>{conversationMembers.filter((member) => member.user_id !== user?.id).map((member) => <button key={member.user_id} onClick={() => void shareContact(member.user_id)} style={{ ...secondaryButton, display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}><img src={member.avatar_url || "https://www.gravatar.com/avatar/?d=mp"} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} /><span><strong>{member.display_name}</strong><small style={{ display: "block", color: "#8193b1" }}>{member.username ? "@" + member.username : "Member"}</small></span></button>)}{conversationMembers.filter((member) => member.user_id !== user?.id).length === 0 && <small style={{ color: "#8193b1" }}>There are no other members to share in this conversation.</small>}<button onClick={() => setShowContacts(false)} style={secondaryButton}>Close</button></section></div>}
      {showMentions && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 560px)", maxHeight: "85vh", overflowY: "auto", padding: 22, display: "grid", gap: 10 }}><h2 style={{ margin: 0 }}>Your mentions</h2>{mentionItems.map((item) => { const message = Array.isArray(item.message) ? item.message[0] : item.message; const sender = message && Array.isArray(message.sender) ? message.sender[0] : message?.sender; return message ? <button key={item.message_id} onClick={() => { setActiveId(message.conversation_id); setShowMentions(false); }} style={{ ...secondaryButton, textAlign: "left" }}><strong>{sender?.display_name || "Member"} mentioned you</strong><span style={{ display: "block", marginTop: 5 }}>{message.body || "Attachment or shared content"}</span><small style={{ display: "block", color: "#8193b1", marginTop: 5 }}>{new Date(message.created_at).toLocaleString()}</small></button> : null; })}{!mentionItems.length && <small style={{ color: "#8193b1" }}>No mentions yet. Someone can mention you with @your_username in a conversation.</small>}<button onClick={() => setShowMentions(false)} style={secondaryButton}>Close</button></section></div>}
      {showSaved && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 560px)", maxHeight: "85vh", overflowY: "auto", padding: 22, display: "grid", gap: 10 }}><h2 style={{ margin: 0 }}>Saved Messages</h2>{savedMessages.filter((item) => item.message).map((item) => <button key={item.message_id} onClick={() => { setActiveId(item.message!.conversation_id); setShowSaved(false); }} style={{ ...secondaryButton, textAlign: "left" }}><strong>{item.message?.body || "Saved attachment"}</strong><small style={{ display: "block", color: "#8193b1" }}>{new Date(item.message?.created_at || item.created_at).toLocaleString()}</small></button>)}{!savedMessages.some((item) => item.message) && <small style={{ color: "#8193b1" }}>No saved messages yet. Use Save beneath a message to keep it here.</small>}<button onClick={() => setShowSaved(false)} style={secondaryButton}>Close</button></section></div>}
      {forwardMessageId && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 460px)", padding: 22, display: "grid", gap: 10 }}><h2 style={{ margin: 0 }}>Forward message</h2><p style={{ color: "#8193b1", fontSize: 12 }}>Choose a conversation to forward this text message into.</p>{conversations.filter((item) => item.id !== activeId).map((conversation) => <button key={conversation.id} onClick={() => void forwardTo(conversation.id)} style={{ ...secondaryButton, textAlign: "left" }}>{conversation.title || "Conversation"}</button>)}<button onClick={() => setForwardMessageId("")} style={secondaryButton}>Cancel</button></section></div>}
      {showAddStatus && <div style={modalStyle}><form onSubmit={createStatus} style={{ ...panel, width: "min(100%, 460px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Share a status</h2><input type="file" accept="image/*,video/*" onChange={(e) => setStatusFile(e.target.files?.[0] ?? null)} style={{ color: "#cbd8ec" }} /><textarea value={statusCaption} onChange={(e) => setStatusCaption(e.target.value)} maxLength={500} rows={3} placeholder="Add a caption (optional)" style={inputStyle} /><small style={{ color: "#8193b1" }}>Only people who share a conversation with you can view your status. It expires after 24 hours.</small><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={() => setShowAddStatus(false)} style={secondaryButton}>Cancel</button><button disabled={!statusFile} style={primaryButton}>Share status</button></div></form></div>}
      {showStatuses && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 560px)", maxHeight: "85vh", overflowY: "auto", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Recent statuses</h2>{statuses.map((status) => <button key={status.id} onClick={() => setActiveStatusId(status.id)} style={{ ...secondaryButton, display: "flex", gap: 12, alignItems: "center", textAlign: "left" }}><img src={status.owner?.avatar_url || "https://www.gravatar.com/avatar/?d=mp"} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} /><span><strong>{status.owner?.display_name || "Member"}</strong><small style={{ display: "block", color: "#8193b1" }}>{status.caption || "Status update"} · expires {new Date(status.expires_at).toLocaleTimeString()}</small></span></button>)}{!statuses.length && <small style={{ color: "#8193b1" }}>No active statuses from your contacts.</small>}<button onClick={() => setShowStatuses(false)} style={secondaryButton}>Close</button></section></div>}
      {activeStatusId && (() => { const status = statuses.find((item) => item.id === activeStatusId); return status ? <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 680px)", maxHeight: "90vh", padding: 16, display: "grid", gap: 10 }}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{status.owner?.display_name || "Member"}</strong><button onClick={() => setActiveStatusId("")} style={secondaryButton}>Close</button></div>{status.media_type?.startsWith("video/") ? <video src={status.signedUrl} controls autoPlay style={{ maxWidth: "100%", maxHeight: "70vh", margin: "0 auto" }} /> : <img src={status.signedUrl} alt={status.caption || "Status"} style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", margin: "0 auto" }} />}<p style={{ margin: 0, color: "#cbd8ec" }}>{status.caption}</p><small style={{ color: "#8193b1" }}>Expires {new Date(status.expires_at).toLocaleString()}</small></section></div> : null; })()}
      {showSchedule && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 520px)", maxHeight: "85vh", overflowY: "auto", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Scheduled messages</h2><p style={{ color: "#8193b1", fontSize: 12 }}>Messages are delivered automatically by the database scheduler, which checks once per minute.</p>{draft.trim() && <form onSubmit={scheduleMessage} style={{ display: "grid", gap: 8 }}><strong style={{ fontSize: 13 }}>Schedule your current draft</strong><textarea value={draft} readOnly rows={3} style={{ ...inputStyle, opacity: .8 }} /><input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} min={new Date(Date.now() + 60000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16)} required style={inputStyle} /><button style={primaryButton}>Schedule message</button></form>}<div style={{ display: "grid", gap: 8 }}><strong style={{ fontSize: 13 }}>Pending messages</strong>{scheduledMessages.map((item) => <div key={item.id} style={{ padding: 10, borderRadius: 8, background: "#14233a", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}><div><div style={{ fontSize: 13 }}>{item.body}</div><small style={{ color: "#8193b1" }}>{new Date(item.send_at).toLocaleString()}</small></div><button onClick={() => void cancelScheduledMessage(item.id)} style={secondaryButton}>Cancel</button></div>)}{!scheduledMessages.length && <small style={{ color: "#8193b1" }}>No pending scheduled messages in this conversation.</small>}</div><button onClick={() => setShowSchedule(false)} style={secondaryButton}>Close</button></section></div>}
      {showConversationSettings && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 440px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Message retention</h2><p style={{ color: "#8193b1", fontSize: 12 }}>New messages in this conversation can automatically disappear. Existing messages are not changed.</p><select value={ttlSeconds} onChange={(e) => setTtlSeconds(e.target.value)} style={inputStyle}><option value="0">Off</option><option value="3600">After 1 hour</option><option value="86400">After 24 hours</option><option value="604800">After 7 days</option><option value="2592000">After 30 days</option></select><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button onClick={() => setShowConversationSettings(false)} style={secondaryButton}>Cancel</button><button onClick={() => void saveMessageExpiry()} style={primaryButton}>Save</button></div></section></div>}
      {showTopics && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 460px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Conversation topics</h2><p style={{ color: "#8193b1", fontSize: 12 }}>Use topics to organise group discussions. Select a topic before sending a message.</p><div style={{ display: "grid", gap: 7 }}>{topics.map((topic) => <button key={topic.id} onClick={() => { setTopicId(topic.id); setShowTopics(false); }} style={{ ...secondaryButton, textAlign: "left" }}>#{topic.name}{topicId === topic.id ? " · Selected" : ""}</button>)}{!topics.length && <small style={{ color: "#8193b1" }}>No topics yet.</small>}</div>{["owner","admin"].includes(activeConversation?.role ?? "") && <form onSubmit={createTopic} style={{ display: "flex", gap: 8 }}><input value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} maxLength={80} placeholder="New topic name" required style={inputStyle} /><button style={primaryButton}>Add</button></form>}<button onClick={() => { setTopicId(""); setShowTopics(false); }} style={secondaryButton}>Clear topic / close</button></section></div>}
      {showPoll && <div style={modalStyle}><form onSubmit={createPoll} style={{ ...panel, width: "min(100%, 480px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Create a poll</h2><input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} maxLength={500} required placeholder="Ask a question" style={inputStyle} /><textarea value={pollOptions} onChange={(e) => setPollOptions(e.target.value)} rows={5} placeholder={"One answer per line\nOption 2"} style={{ ...inputStyle, resize: "vertical" }} /><label style={{ display: "flex", gap: 8, alignItems: "center", color: "#cbd8ec", fontSize: 13 }}><input type="checkbox" checked={pollMultiple} onChange={(e) => setPollMultiple(e.target.checked)} /> Allow multiple answers</label><small style={{ color: "#8193b1" }}>Add 2–10 options, one per line. Votes are visible to conversation members.</small><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={() => setShowPoll(false)} style={secondaryButton}>Cancel</button><button disabled={busy} style={primaryButton}>Share poll</button></div></form></div>}
      {showAnalytics && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 500px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Channel analytics</h2><p style={{ color: "#8193b1", fontSize: 12, margin: 0 }}>Activity summary for {activeConversation?.title || "this channel"}.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9 }}>{[["Members",channelAnalytics.members],["Total posts",channelAnalytics.messages],["Posts · 30 days",channelAnalytics.messages30d],["Shared files",channelAnalytics.files]].map(([label,value]) => <div key={label} style={{ padding: 14, background: "#14233a", borderRadius: 10 }}><strong style={{ display: "block", fontSize: 24 }}>{value}</strong><small style={{ color: "#8193b1" }}>{label}</small></div>)}</div><button onClick={() => setShowAnalytics(false)} style={secondaryButton}>Close</button></section></div>}
      {showDiscoverChannels && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 560px)", maxHeight: "85vh", overflowY: "auto", padding: 22, display: "grid", gap: 10 }}><h2 style={{ margin: 0 }}>Discover public channels</h2>{publicChannels.map((channel) => <div key={channel.id} style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", padding: 10, background: "#14233a", borderRadius: 9 }}><div><strong>{channel.title || "Channel"}</strong><small style={{ display: "block", color: "#8193b1" }}>{channel.description || "Public announcement channel"}</small></div><button onClick={() => void joinPublicChannel(channel.id)} style={primaryButton}>Follow</button></div>)}{!publicChannels.length && <small style={{ color: "#8193b1" }}>No new public channels are available right now.</small>}<button onClick={() => setShowDiscoverChannels(false)} style={secondaryButton}>Close</button></section></div>}
      {showCreate && <div style={modalStyle}><form onSubmit={createConversation} style={{ ...panel, width: "min(100%, 440px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Create a conversation</h2><div style={{ display: "flex", gap: 8 }}><button type="button" onClick={() => setNewType("group")} style={{ ...secondaryButton, flex: 1, background: newType === "group" ? "#20365c" : "transparent" }}>Group</button><button type="button" onClick={() => setNewType("channel")} style={{ ...secondaryButton, flex: 1, background: newType === "channel" ? "#20365c" : "transparent" }}>Channel</button></div><input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={newType === "group" ? "Group name" : "Channel name"} maxLength={100} required style={inputStyle} />{newType === "channel" && <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd8ec", fontSize: 13 }}><input type="checkbox" checked={!newChannelPrivate} onChange={(e) => setNewChannelPrivate(!e.target.checked)} /> Make this a public channel that people can discover and follow</label>}<p style={{ color: "#8193b1", fontSize: 12 }}>{newType === "channel" ? "Channels are announcement-first spaces. Only owners and admins can post. Public channels can be discovered and joined by members." : "Groups are private. Add people by their SyncSpace username after creation."}</p><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={() => setShowCreate(false)} style={secondaryButton}>Cancel</button><button disabled={busy} style={primaryButton}>Create</button></div></form></div>}

      {showMembers && activeConversation && <div style={modalStyle}><section style={{ ...panel, width: "min(100%, 480px)", padding: 22 }}><h2 style={{ marginTop: 0 }}>Members and invitations</h2><p style={{ color: "#8193b1", fontSize: 13 }}>Manage members and invite people by username. People must set a username in their profile to be found.</p><div style={{ display: "grid", gap: 7, maxHeight: 180, overflowY: "auto" }}><strong style={{ fontSize: 12 }}>Current members · {conversationMembers.length}</strong>{conversationMembers.map((member) => <div key={member.user_id} style={{ display: "flex", gap: 8, alignItems: "center", padding: 7, borderRadius: 8, background: "#14233a" }}><img src={member.avatar_url || "https://www.gravatar.com/avatar/?d=mp"} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} /><span style={{ flex: 1, minWidth: 0, fontSize: 12 }}>{member.display_name}<small style={{ display: "block", color: "#8193b1" }}>{member.username ? "@"+member.username : member.role}</small></span>{member.role === "owner" ? <small>Owner</small> : member.user_id === user.id ? <small>You · {member.role}</small> : ["owner","admin"].includes(activeConversation.role ?? "") ? <><select aria-label={"Role for "+member.display_name} value={member.role} onChange={(e) => void changeMemberRole(member.user_id,e.target.value)} style={{ ...inputStyle, width: 105, padding: "6px 5px", fontSize: 11 }}><option value="member">Member</option><option value="moderator">Moderator</option>{activeConversation.role === "owner" && <option value="admin">Admin</option>}</select>{activeConversation.type !== "direct" && activeConversation.role === "owner" && <button onClick={() => void transferOwnership(member.user_id)} style={{ ...secondaryButton, padding: "5px 7px" }}>Make owner</button>}<button onClick={() => void removeConversationMember(member.user_id)} style={{ ...secondaryButton, padding: "5px 7px" }}>Remove</button></> : <small>{member.role}</small>}</div>)}</div>{activeConversation.role !== "owner" && <button onClick={() => void leaveConversation()} style={{ ...secondaryButton, color: "#ff9eae" }}>Leave conversation</button>}{activeConversation.type !== "direct" && ["owner","admin"].includes(activeConversation.role ?? "") && <div style={{ display: "grid", gap: 8 }}><button type="button" onClick={() => void createInviteLink()} style={primaryButton}>Create 7-day invite link</button>{inviteLink && <input readOnly value={inviteLink} onFocus={(e) => e.currentTarget.select()} style={inputStyle} />}</div>}<div style={{ display: "grid", gap: 6 }}><strong style={{ fontSize: 12 }}>Existing invites</strong>{inviteRecords.map((invite) => <div key={invite.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 11, color: "#aebfda" }}><span>{invite.revoked_at ? "Revoked" : invite.expires_at && new Date(invite.expires_at) < new Date() ? "Expired" : "Active"} · {invite.uses_count}/{invite.max_uses ?? "∞"} joins</span>{!invite.revoked_at && ["owner","admin"].includes(activeConversation.role ?? "") && <button onClick={() => void revokeInvite(invite.id)} style={secondaryButton}>Revoke</button>}</div>)}</div>{activeConversation.type !== "direct" && <form onSubmit={findMembers} style={{ display: "flex", gap: 8 }}><input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="@username" style={inputStyle} /><button style={primaryButton}>Find</button></form>}<div style={{ display: "grid", gap: 8, marginTop: 14 }}>{activeConversation.type !== "direct" && memberResults.map((member) => <div key={member.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, background: "#14233a", borderRadius: 8 }}><span>{member.display_name} <small style={{ color: "#8193b1" }}>@{member.username}</small></span><div style={{ display: "flex", gap: 6 }}><button onClick={() => void addMember(member.id)} style={secondaryButton}>Add</button><button onClick={() => void startDirect(member)} style={secondaryButton}>Message</button><button onClick={() => void reportMember(member.id)} style={secondaryButton}>Report</button><button onClick={() => void blockMember(member.id)} style={secondaryButton}>Block</button></div></div>)}</div><button onClick={() => setShowMembers(false)} style={{ ...secondaryButton, width: "100%", marginTop: 14 }}>Close</button></section></div>}

      {showProfile && <div style={modalStyle}><form onSubmit={saveProfile} style={{ ...panel, width: "min(100%, 440px)", padding: 22, display: "grid", gap: 12 }}><h2 style={{ margin: 0 }}>Your profile</h2>{avatarUrl && <img src={avatarUrl} alt="Your profile" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "50%" }} />}<label style={{ color: "#cbd8ec", fontSize: 13 }}>Profile picture<input type="file" accept="image/*" onChange={uploadAvatar} style={{ display: "block", marginTop: 7, color: "#aebfda" }} /></label><label style={{ color: "#cbd8ec", fontSize: 13 }}>Display name<input value={profileName} onChange={(e) => setProfileName(e.target.value)} maxLength={60} required style={{ ...inputStyle, marginTop: 6 }} /></label><label style={{ color: "#cbd8ec", fontSize: 13 }}>Username<input value={profileUsername} onChange={(e) => setProfileUsername(e.target.value)} maxLength={24} placeholder="your_username" style={{ ...inputStyle, marginTop: 6 }} /></label><small style={{ color: "#8193b1" }}>Username must be unique and 3–24 letters, numbers or underscores. Email: {user.email}</small><div style={{ display: "grid", gap: 8, padding: 12, borderRadius: 9, background: "#14233a" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><strong style={{ fontSize: 12 }}>Signed-in devices</strong><button type="button" onClick={() => void signOutOtherSessions()} style={{ ...secondaryButton, color: "#ffb2be" }}>Sign out other sessions</button></div>{devices.map((device) => <div key={device.id} style={{ fontSize: 11, color: "#cbd8ec" }}><strong>{device.id === currentDeviceId ? "This device" : "Other device"}</strong> · {(device.platform || "Web").slice(0, 40)}<small style={{ display: "block", color: "#8193b1", overflowWrap: "anywhere" }}>{(device.device_name || "Browser").slice(0, 100)} · Seen {new Date(device.last_seen_at).toLocaleString()}</small></div>)}{!devices.length && <small style={{ color: "#8193b1" }}>No device records yet.</small>}</div><div style={{ display: "grid", gap: 9, padding: 12, borderRadius: 9, background: "#14233a" }}><strong style={{ fontSize: 12 }}>Privacy</strong><label style={{ display: "flex", gap: 8, alignItems: "center", color: "#cbd8ec", fontSize: 13 }}><input type="checkbox" checked={showOnlineStatus} onChange={(e) => setShowOnlineStatus(e.target.checked)} /> Share my online presence</label><label style={{ display: "flex", gap: 8, alignItems: "center", color: "#cbd8ec", fontSize: 13 }}><input type="checkbox" checked={showLastSeen} onChange={(e) => setShowLastSeen(e.target.checked)} /> Share my last-seen time</label></div><div style={{ display: "grid", gap: 7 }}><strong style={{ fontSize: 12 }}>Blocked accounts</strong>{blockedUsers.map((blocked) => <div key={blocked.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}><span>{blocked.display_name} {blocked.username ? "@"+blocked.username : ""}</span><button type="button" onClick={() => void unblockUser(blocked.id)} style={secondaryButton}>Unblock</button></div>)}{!blockedUsers.length && <small style={{ color: "#8193b1" }}>No blocked accounts.</small>}</div><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={() => setShowProfile(false)} style={secondaryButton}>Cancel</button><button style={primaryButton}>Save profile</button></div></form></div>}
    </main>
  );
}

const modalStyle: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 50, background: "rgba(2,8,18,.78)", display: "grid", placeItems: "center", padding: 16 };
