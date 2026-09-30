import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowUpRight, BarChart3, Bell, BriefcaseBusiness, Check, ChevronLeft,
  CircleCheck, CircleDashed, Compass, FileText, Heart, Inbox, LockKeyhole, LogOut,
  MessageCircle, MoreHorizontal, Pencil, Plus, Radio, Search, Send, Settings2,
  ShieldCheck, SlidersHorizontal, Sparkles, Trash2, UserRound, Users, X
} from "lucide-react";
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from "wouter";
import {
  getGetAdminSummaryQueryKey, getGetCurrentUserQueryKey,
  getGetProfileQueryKey, getListCommentsQueryKey, getListConnectionsQueryKey,
  getListConversationsQueryKey, getListMessagesQueryKey, getListNotificationsQueryKey,
  getListPostsQueryKey, getListProfilesQueryKey, getListProjectsQueryKey,
  useCreateComment, useCreateConnectionRequest, useCreatePost, useCreateProject,
  useDeleteMessage, useEditMessage, useGetAdminSummary, useGetCurrentUser, useGetProfile,
  useListComments, useListConnections, useListConversations, useListMessages,
  useListNotifications, useListPosts, useListProfiles, useListProjects,
  useRespondToConnectionRequest, useSendMessage, useTogglePostLike, useUpdateMyProfile
} from "@workspace/api-client-react";
import type {
  Comment, Conversation, CurrentUser, Message, Post, Profile, Project, ProfileUpdateUserType
} from "@workspace/api-client-react";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import "./index.css";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function initials(profile?: Partial<Profile> | null) {
  return (profile?.fullName || profile?.username || "?").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ profile, size = "md" }: { profile?: Partial<Profile> | null; size?: "sm" | "md" | "lg" }) {
  const sizing = size === "lg" ? "h-16 w-16 text-xl" : size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  return profile?.avatarUrl ? (
    <img data-testid={`img-avatar-${profile.id || "current"}`} src={profile.avatarUrl} alt={profile.fullName || "Profile"} className={`${sizing} rounded-2xl object-cover`} />
  ) : (
    <div data-testid={`avatar-fallback-${profile?.id || "current"}`} className={`${sizing} grid shrink-0 place-items-center rounded-2xl bg-[hsl(267_91%_79%)] font-bold text-[hsl(249_25%_12%)]`}>
      {initials(profile)}
    </div>
  );
}

function LoadingState({ label = "Loading your space" }: { label?: string }) {
  return <div data-testid="status-loading" className="space-y-4 p-1" aria-label={label}>
    {[1, 2, 3].map((item) => <div key={item} className="skeleton h-24 rounded-3xl opacity-70" />)}
  </div>;
}

function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return <div data-testid="status-error" className="my-10 rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center">
    <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[hsl(var(--destructive)/.14)] text-[hsl(var(--destructive))]"><Radio size={20} /></div>
    <h2 className="display-font text-xl">A little static in the signal.</h2>
    <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">We could not load this part of Gridora. Try again in a moment.</p>
    {onRetry && <button data-testid="button-retry" onClick={onRetry} className="mt-5 rounded-full bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))]">Retry</button>}
  </div>;
}

function EmptyState({ icon: Icon, eyebrow, title, body, action }: { icon: typeof Inbox; eyebrow: string; title: string; body: string; action?: ReactNode }) {
  return <div data-testid="status-empty" className="relative overflow-hidden rounded-[2rem] border border-[hsl(var(--border))] bg-[linear-gradient(145deg,hsl(248_22%_14%),hsl(248_22%_10%))] px-7 py-12 text-center">
    <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full border border-[hsl(267_91%_79%/.12)]" />
    <div className="absolute -bottom-20 -left-8 h-40 w-40 rounded-full border border-[hsl(337_84%_73%/.1)]" />
    <div className="relative mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[hsl(267_91%_79%/.12)] text-[hsl(var(--primary))]"><Icon size={23} /></div>
    <div className="relative mono-font text-[10px] uppercase tracking-[.22em] text-[hsl(var(--primary))]">{eyebrow}</div>
    <h2 data-testid="text-empty-title" className="relative display-font mt-3 text-2xl">{title}</h2>
    <p className="relative mx-auto mt-3 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">{body}</p>
    {action && <div className="relative mt-6">{action}</div>}
  </div>;
}

function PublicHomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => { if (isLoaded && isSignedIn) setLocation("/app"); }, [isLoaded, isSignedIn, setLocation]);
  return <PublicHomeContent />;
}

function PublicHomeContent() {
  return <div className="gridora-noise min-h-[100dvh] overflow-hidden bg-[hsl(var(--background))]">
    <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-10">
      <Logo />
      <Link data-testid="link-home-sign-in" href="/sign-in" className="rounded-full border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold text-[hsl(var(--foreground))] transition hover:bg-[hsl(var(--muted))]">Sign in</Link>
    </header>
    <main className="relative mx-auto max-w-6xl px-5 pb-20 pt-12 sm:px-10 sm:pt-20">
      <div className="pointer-events-none absolute -right-32 top-10 h-96 w-96 rounded-full bg-[hsl(267_65%_32%/.22)] blur-3xl" />
      <div className="relative grid items-end gap-12 lg:grid-cols-[1.15fr_.85fr]">
        <div className="page-enter">
          <div className="mono-font mb-7 flex items-center gap-3 text-[11px] uppercase tracking-[.24em] text-[hsl(var(--primary))]"><span className="h-px w-10 bg-[hsl(var(--primary))]" />For the thoughtful ones</div>
          <h1 data-testid="text-home-headline" className="display-font max-w-3xl text-[clamp(3.5rem,10vw,8rem)] font-semibold leading-[.9] tracking-[-.075em]">Make room<br /><span className="text-[hsl(var(--primary))]">for better</span><br />connections.</h1>
          <p className="mt-8 max-w-md text-base leading-7 text-[hsl(var(--muted-foreground))]">Gridora is a quiet network for designers and clients who care about the work — and who they do it with.</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link data-testid="link-home-sign-up" href="/sign-up" className="group inline-flex items-center gap-3 rounded-full bg-[hsl(var(--primary))] px-6 py-3.5 font-bold text-[hsl(var(--primary-foreground))] transition hover:translate-y-[-2px]">Join Gridora <ArrowUpRight size={18} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link>
            <span className="mono-font text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Invite-led / low noise</span>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-md rise-in delay-2">
          <div className="absolute -inset-5 rounded-[3rem] border border-[hsl(267_91%_79%/.12)] rotate-3" />
          <div className="relative overflow-hidden rounded-[2.4rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-2xl shadow-[hsl(267_50%_10%/.3)]">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-4">
              <span className="display-font text-lg">Your signal</span><span className="mono-font text-[10px] text-[hsl(var(--primary))]">LIVE / 01</span>
            </div>
            <div className="my-8 flex items-center gap-4"><div className="grid h-20 w-20 place-items-center rounded-[1.6rem] bg-[hsl(337_84%_73%)] text-3xl font-bold text-[hsl(249_25%_12%)]">G</div><div><div className="display-font text-2xl">Good work,<br />better people.</div><div className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">A place to find your next yes.</div></div></div>
            <div className="space-y-2"><div className="flex items-center gap-3 rounded-2xl bg-[hsl(var(--muted))] p-3"><div className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" /><span className="text-sm">One intentional introduction</span><span className="mono-font ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">TODAY</span></div><div className="flex items-center gap-3 rounded-2xl bg-[hsl(var(--muted))] p-3"><div className="h-2 w-2 rounded-full bg-[hsl(182_70%_65%)]" /><span className="text-sm">No feed to keep up with</span><span className="mono-font ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">ALWAYS</span></div></div>
          </div>
        </div>
      </div>
      <section className="mt-28 grid gap-8 border-t border-[hsl(var(--border))] pt-8 sm:grid-cols-3">
        {[["01", "Find the right rhythm", "Discover people by practice, not performance."], ["02", "Build in private", "Conversations stay between the people in them."], ["03", "Let trust compound", "Good collaborations start with a real hello."]].map(([num, title, body]) => <div key={num} className="rise-in delay-3"><div className="mono-font text-[10px] text-[hsl(var(--primary))]">{num}</div><h2 className="display-font mt-5 text-2xl">{title}</h2><p className="mt-2 max-w-xs text-sm leading-6 text-[hsl(var(--muted-foreground))]">{body}</p></div>)}
      </section>
    </main>
    <footer className="mx-auto flex max-w-6xl items-center justify-between border-t border-[hsl(var(--border))] px-5 py-7 text-xs text-[hsl(var(--muted-foreground))] sm:px-10"><Logo small /><span className="mono-font text-[10px] tracking-[.16em]">MAKE SPACE FOR GOOD WORK</span></footer>
  </div>;
}

function Logo({ small = false }: { small?: boolean }) {
  return <Link data-testid="link-logo" href="/" className="inline-flex items-center gap-2"><div className={`${small ? "h-7 w-7 rounded-lg text-xs" : "h-8 w-8 rounded-xl text-sm"} grid place-items-center bg-[hsl(var(--primary))] font-extrabold text-[hsl(var(--primary-foreground))]`}>G</div><span className={`${small ? "text-sm" : "text-lg"} display-font font-bold tracking-[-.04em]`}>gridora</span></Link>;
}

function AppHeader({ user }: { user?: CurrentUser }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsQuery = useListNotifications({ query: { queryKey: getListNotificationsQueryKey() } });
  const notifications = notificationsQuery.data || [];
  const unread = notifications.filter((item) => !item.read).length;
  return <header className="fixed inset-x-0 top-0 z-40 border-b border-[hsl(var(--border)/.8)] bg-[hsl(246_22%_8%/.92)] px-4 backdrop-blur-xl sm:px-8">
    <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between">
      <Logo />
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.55)] px-3 py-2 sm:flex"><span className="mono-font text-[9px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Your space</span><span className="h-1.5 w-1.5 rounded-full bg-[hsl(110_54%_69%)]" /></div>
        <button data-testid="button-notifications" onClick={() => setShowNotifications((value) => !value)} className="relative grid h-10 w-10 place-items-center rounded-full text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"><Bell size={18} />{unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />}</button>
        <Link data-testid="link-header-profile" href="/app/profile"><Avatar profile={user} size="sm" /></Link>
      </div>
    </div>
    {showNotifications && <div data-testid="panel-notifications" className="absolute right-4 top-[4.8rem] w-[min(360px,calc(100vw-2rem))] rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-4 shadow-2xl sm:right-8"><div className="mb-3 flex items-center justify-between"><span className="display-font text-lg">Notifications</span><span className="mono-font text-[10px] text-[hsl(var(--muted-foreground))]">{unread} unread</span></div>{notifications.length === 0 ? <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">Nothing new here.</p> : <div className="space-y-2">{notifications.slice(0, 5).map((note) => <div key={note.id} data-testid={`notification-${note.id}`} className="rounded-2xl bg-[hsl(var(--muted))] p-3"><div className="text-sm font-semibold">{note.title}</div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{note.body}</p></div>)}</div>}</div>}
  </header>;
}

const navItems = [
  { href: "/app", label: "Home", icon: Compass },
  { href: "/app/chat", label: "Chat", icon: MessageCircle },
  { href: "/app/contacts", label: "People", icon: Users },
  { href: "/app/profile", label: "Profile", icon: UserRound }
];

function BottomNav() {
  const [location] = useLocation();
  return <nav data-testid="nav-bottom" className="fixed inset-x-0 bottom-0 z-40 border-t border-[hsl(var(--border)/.9)] bg-[hsl(246_22%_8%/.96)] px-3 pb-[max(.65rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl sm:hidden">
    <div className="mx-auto flex max-w-md items-center justify-around">{navItems.map(({ href, label, icon: Icon }) => { const active = href === "/app" ? location === href : location.startsWith(href); return <Link key={href} data-testid={`link-nav-${label.toLowerCase()}`} href={href} className={`flex min-w-[4.3rem] flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[10px] font-semibold transition ${active ? "bg-[hsl(var(--primary)/.14)] text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}><Icon size={19} strokeWidth={active ? 2.4 : 1.8} /><span>{label}</span></Link>; })}</div>
  </nav>;
}

function DesktopRail() {
  const [location] = useLocation();
  return <aside className="fixed bottom-0 left-0 top-0 hidden w-64 border-r border-[hsl(var(--border))] bg-[hsl(247_24%_10%)] px-5 py-6 lg:block"><Logo /><div className="mt-14 space-y-1">{navItems.map(({ href, label, icon: Icon }) => { const active = href === "/app" ? location === href : location.startsWith(href); return <Link key={href} data-testid={`link-rail-${label.toLowerCase()}`} href={href} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${active ? "bg-[hsl(var(--primary)/.14)] text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"}`}><Icon size={18} />{label}</Link>; })}<Link data-testid="link-rail-settings" href="/app/settings" className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${location.startsWith("/app/settings") ? "bg-[hsl(var(--primary)/.14)] text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}><Settings2 size={18} />Settings</Link></div><div className="absolute bottom-7 left-5 right-5 rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)] p-4"><div className="mono-font text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Gridora note</div><p className="mt-3 text-sm leading-5 text-[hsl(var(--muted-foreground))]">Your attention is yours. Spend it well.</p></div></aside>;
}

function AppShell({ children }: { children: ReactNode }) {
  const current = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  if (current.isLoading) return <div className="gridora-noise min-h-[100dvh] p-5"><LoadingState label="Loading Gridora" /></div>;
  if (current.isError || !current.data) return <AuthGate><div /></AuthGate>;
  return <div className="gridora-noise min-h-[100dvh]"><AppHeader user={current.data} /><DesktopRail /><main className="app-scroll min-h-[100dvh] px-4 pb-28 pt-[6.5rem] sm:px-8 lg:ml-64"><div className="mx-auto max-w-4xl page-enter">{children}</div></main><BottomNav /></div>;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => { if (isLoaded && !isSignedIn) setLocation("/sign-in"); }, [isLoaded, isSignedIn, setLocation]);
  if (!isLoaded || !isSignedIn) return <div className="gridora-noise min-h-[100dvh] p-5"><LoadingState label="Checking session" /></div>;
  return <>{children}</>;
}

function FeedPage() {
  const postsQuery = useListPosts({ query: { queryKey: getListPostsQueryKey() } });
  const [body, setBody] = useState("");
  const createPost = useCreatePost();
  const client = useQueryClient();
  const submit = () => { if (!body.trim()) return; createPost.mutate({ data: { body: body.trim() } }, { onSuccess: () => { setBody(""); client.invalidateQueries({ queryKey: getListPostsQueryKey() }); } }); };
  return <AppShell><div className="flex items-end justify-between"><div><div className="mono-font text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">The quiet feed</div><h1 className="display-font mt-2 text-4xl tracking-[-.05em] sm:text-5xl">Make something<br /><span className="text-[hsl(var(--primary))]">worth sharing.</span></h1></div><div className="hidden rounded-2xl border border-[hsl(var(--border))] p-3 sm:block"><Sparkles size={18} className="text-[hsl(var(--accent))]" /></div></div>
    <div className="mt-8 rounded-[1.75rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:p-5"><div className="flex gap-3"><div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(var(--primary)/.16)] text-[hsl(var(--primary))]"><Pencil size={16} /></div><textarea data-testid="input-create-post" value={body} onChange={(event) => setBody(event.target.value)} placeholder="What are you working through?" rows={3} maxLength={5000} className="min-h-20 flex-1 resize-none bg-transparent pt-1 text-sm leading-6 text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))]" /></div><div className="mt-3 flex items-center justify-between border-t border-[hsl(var(--border))] pt-3"><span className="mono-font text-[10px] text-[hsl(var(--muted-foreground))]">{body.length}/5000</span><button data-testid="button-create-post" disabled={!body.trim() || createPost.isPending} onClick={submit} className="rounded-full bg-[hsl(var(--primary))] px-5 py-2 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-40">{createPost.isPending ? "Posting…" : "Share thought"}</button></div></div>
    <div className="mt-8">{postsQuery.isLoading ? <LoadingState /> : postsQuery.isError ? <ErrorState onRetry={() => postsQuery.refetch()} /> : postsQuery.data?.length ? <div className="space-y-4">{postsQuery.data.map((post) => <PostCard key={post.id} post={post} />)}</div> : <EmptyState icon={Inbox} eyebrow="A fresh canvas" title="Your feed is intentionally empty." body="When you or a connection shares something, it will land here. No filler. No performance." />}</div>
  </AppShell>;
}

function PostCard({ post }: { post: Post }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const commentsQuery = useListComments(post.id, { query: { enabled: commentsOpen, queryKey: getListCommentsQueryKey(post.id) } });
  const like = useTogglePostLike();
  const createComment = useCreateComment();
  const client = useQueryClient();
  const sendComment = () => { if (!commentBody.trim()) return; createComment.mutate({ postId: post.id, data: { body: commentBody.trim() } }, { onSuccess: () => { setCommentBody(""); client.invalidateQueries({ queryKey: getListCommentsQueryKey(post.id) }); client.invalidateQueries({ queryKey: getListPostsQueryKey() }); } }); };
  return <article data-testid={`card-post-${post.id}`} className="rounded-[1.75rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-6"><div className="flex items-start gap-3"><Avatar profile={post.author} size="sm" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span data-testid={`text-post-author-${post.id}`} className="font-bold">{post.author.fullName}</span><span className="text-xs text-[hsl(var(--muted-foreground))]">@{post.author.username}</span><span className="text-xs text-[hsl(var(--muted-foreground))]">· {relativeTime(post.createdAt)}</span></div><span className="mono-font text-[9px] uppercase tracking-[.14em] text-[hsl(var(--primary))]">{post.author.userType}</span></div><div aria-hidden="true" className="p-2 text-[hsl(var(--muted-foreground))]"><MoreHorizontal size={18} /></div></div><p data-testid={`text-post-body-${post.id}`} className="mt-5 whitespace-pre-wrap text-[15px] leading-7 text-[hsl(var(--foreground)/.9)]">{post.body}</p><div className="mt-5 flex items-center gap-2 border-t border-[hsl(var(--border))] pt-3"><button data-testid={`button-like-post-${post.id}`} onClick={() => like.mutate({ postId: post.id }, { onSuccess: () => client.invalidateQueries({ queryKey: getListPostsQueryKey() }) })} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${post.likedByMe ? "bg-[hsl(337_84%_73%/.14)] text-[hsl(var(--accent))]" : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"}`}><Heart size={15} fill={post.likedByMe ? "currentColor" : "none"} />{post.likeCount}</button><button data-testid={`button-comments-post-${post.id}`} onClick={() => setCommentsOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><MessageCircle size={15} />{post.commentCount}</button></div>{commentsOpen && <div className="mt-3 border-t border-[hsl(var(--border))] pt-4">{commentsQuery.isLoading ? <div className="skeleton h-12 rounded-2xl" /> : commentsQuery.data?.length ? <div className="space-y-3">{commentsQuery.data.map((comment) => <CommentRow key={comment.id} comment={comment} />)}</div> : <p className="py-2 text-xs text-[hsl(var(--muted-foreground))]">Be the first to add a thoughtful reply.</p>}<div className="mt-4 flex items-center gap-2"><input data-testid={`input-comment-${post.id}`} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendComment(); }} placeholder="Add a reply" className="min-w-0 flex-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.7)] px-4 py-2.5 text-xs outline-none focus:border-[hsl(var(--primary))]" /><button data-testid={`button-comment-${post.id}`} onClick={sendComment} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Send size={15} /></button></div></div>}</article>;
}

function CommentRow({ comment }: { comment: Comment }) {
  return <div data-testid={`row-comment-${comment.id}`} className="flex gap-2"><Avatar profile={comment.author} size="sm" /><div className="rounded-2xl bg-[hsl(var(--muted))] px-3 py-2"><div className="text-xs font-bold">{comment.author.fullName}</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{comment.body}</p></div></div>;
}

function ChatPage() {
  const conversationsQuery = useListConversations({ query: { queryKey: getListConversationsQueryKey() } });
  return <AppShell><div className="flex items-end justify-between"><div><div className="mono-font text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Private line</div><h1 className="display-font mt-2 text-4xl tracking-[-.05em]">Conversations</h1></div><Link data-testid="link-chat-contacts" href="/app/contacts" className="rounded-full border border-[hsl(var(--border))] p-3 text-[hsl(var(--primary))]"><Plus size={18} /></Link></div><div className="mt-8">{conversationsQuery.isLoading ? <LoadingState /> : conversationsQuery.isError ? <ErrorState onRetry={() => conversationsQuery.refetch()} /> : conversationsQuery.data?.length ? <div className="space-y-2">{conversationsQuery.data.map((conversation) => <ConversationRow key={conversation.user.id} conversation={conversation} />)}</div> : <EmptyState icon={MessageCircle} eyebrow="No open lines" title="Your conversations start with a connection." body="Say hello when you find someone whose work makes you pause." action={<Link data-testid="link-empty-chat-contacts" href="/app/contacts" className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">Find people <ArrowUpRight size={16} /></Link>} />}</div></AppShell>;
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  return <Link data-testid={`link-conversation-${conversation.user.id}`} href={`/app/chat/${conversation.user.id}`} className="flex items-center gap-3 rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/.55)]"><Avatar profile={conversation.user} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><span className="font-bold">{conversation.user.fullName}</span><span className="mono-font text-[9px] text-[hsl(var(--muted-foreground))]">{conversation.latestMessage ? relativeTime(conversation.latestMessage.createdAt) : ""}</span></div><p className="mt-1 truncate text-sm text-[hsl(var(--muted-foreground))]">{conversation.latestMessage?.body || "Start the conversation."}</p></div>{conversation.unreadCount > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[hsl(var(--accent))] px-1.5 text-[10px] font-bold text-[hsl(var(--accent-foreground))]">{conversation.unreadCount}</span>}<ChevronLeft size={16} className="rotate-180 text-[hsl(var(--muted-foreground))]" /></Link>;
}

function ChatThreadPage() {
  const { userId = "" } = useParams<{ userId: string }>();
  const current = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const profileQuery = useGetProfile(userId, { query: { enabled: Boolean(userId), queryKey: getGetProfileQueryKey(userId) } });
  const messagesQuery = useListMessages(userId, { query: { enabled: Boolean(userId), queryKey: getListMessagesQueryKey(userId) } });
  const send = useSendMessage();
  const edit = useEditMessage();
  const remove = useDeleteMessage();
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const other = profileQuery.data;
  const submit = () => { if (!body.trim()) return; send.mutate({ userId, data: { body: body.trim() } }, { onSuccess: () => { setBody(""); client.invalidateQueries({ queryKey: getListMessagesQueryKey(userId) }); client.invalidateQueries({ queryKey: getListConversationsQueryKey() }); } }); };
  return <AppShell><div className="flex items-center gap-3 border-b border-[hsl(var(--border))] pb-5"><Link data-testid="link-chat-back" href="/app/chat" className="grid h-9 w-9 place-items-center rounded-full border border-[hsl(var(--border))]"><ArrowLeft size={17} /></Link><Avatar profile={other} /><div><div className="font-bold">{other?.fullName || "Conversation"}</div><div className="text-xs text-[hsl(var(--muted-foreground))]">{other ? `@${other.username} · ${other.userType}` : "Private line"}</div></div></div><div className="flex min-h-[55vh] flex-col justify-end py-6">{messagesQuery.isLoading ? <LoadingState /> : messagesQuery.isError ? <ErrorState onRetry={() => messagesQuery.refetch()} /> : messagesQuery.data?.length ? <div className="space-y-3">{messagesQuery.data.map((message) => <MessageBubble key={message.id} message={message} isMine={message.senderId === current.data?.id} editingId={editingId} editingBody={editingBody} setEditingBody={setEditingBody} onStartEdit={() => { setEditingId(message.id); setEditingBody(message.body); }} onCancelEdit={() => setEditingId(null)} onSaveEdit={() => { if (editingBody.trim()) edit.mutate({ messageId: message.id, data: { body: editingBody.trim() } }, { onSuccess: () => { setEditingId(null); client.invalidateQueries({ queryKey: getListMessagesQueryKey(userId) }); } }); }} onDelete={() => { if (window.confirm("Delete this message?")) remove.mutate({ messageId: message.id }, { onSuccess: () => client.invalidateQueries({ queryKey: getListMessagesQueryKey(userId) }) }); }} />)}</div> : <EmptyState icon={LockKeyhole} eyebrow="Private by design" title="Start with a real hello." body="This line is just between you and this connection. Keep it human." />}</div><div className="sticky bottom-24 flex items-end gap-2 rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-xl sm:bottom-4"><textarea data-testid="input-send-message" value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} rows={1} placeholder="Write something worth sending…" className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]" /><button data-testid="button-send-message" onClick={submit} disabled={!body.trim() || send.isPending} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] disabled:opacity-40"><Send size={17} /></button></div></AppShell>;
}

function MessageBubble({ message, isMine, editingId, editingBody, setEditingBody, onStartEdit, onCancelEdit, onSaveEdit, onDelete }: { message: Message; isMine: boolean; editingId: number | null; editingBody: string; setEditingBody: (value: string) => void; onStartEdit: () => void; onCancelEdit: () => void; onSaveEdit: () => void; onDelete: () => void }) {
  const editing = editingId === message.id;
  return <div data-testid={`row-message-${message.id}`} className={`group flex ${isMine ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] ${isMine ? "items-end" : "items-start"} flex flex-col`}><div className={`rounded-[1.35rem] px-4 py-3 text-sm leading-6 ${isMine ? "rounded-br-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "rounded-bl-md bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"}`}>{editing ? <div className="space-y-2"><textarea data-testid={`input-edit-message-${message.id}`} value={editingBody} onChange={(event) => setEditingBody(event.target.value)} className="min-w-[190px] resize-none rounded-xl bg-[hsl(249_25%_12%/.2)] p-2 outline-none" /><div className="flex gap-2"><button data-testid={`button-save-message-${message.id}`} onClick={onSaveEdit} className="rounded-full bg-[hsl(var(--foreground)/.15)] px-3 py-1 text-xs">Save</button><button data-testid={`button-cancel-message-${message.id}`} onClick={onCancelEdit} className="rounded-full px-3 py-1 text-xs">Cancel</button></div></div> : message.deletedAt ? <span className="italic opacity-60">Message deleted</span> : message.body}</div><div className="mt-1 flex items-center gap-2 px-1"><span className="mono-font text-[9px] text-[hsl(var(--muted-foreground))]">{relativeTime(message.createdAt)}</span>{message.editedAt && <span className="text-[9px] text-[hsl(var(--muted-foreground))]">edited</span>}{isMine && !message.deletedAt && !editing && <span className="flex gap-1 sm:hidden sm:group-hover:flex"><button data-testid={`button-edit-message-${message.id}`} onClick={onStartEdit} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"><Pencil size={12} /></button><button data-testid={`button-delete-message-${message.id}`} onClick={onDelete} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"><Trash2 size={12} /></button></span>}</div></div></div>;
}

function ContactsPage() {
  const [tab, setTab] = useState<"discover" | "requests" | "connected">("discover");
  const [search, setSearch] = useState("");
  const profilesQuery = useListProfiles({ q: search || undefined }, { query: { queryKey: getListProfilesQueryKey({ q: search || undefined }) } });
  const connectionsQuery = useListConnections({ query: { queryKey: getListConnectionsQueryKey() } });
  const request = useCreateConnectionRequest();
  const respond = useRespondToConnectionRequest();
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: getListConnectionsQueryKey() });
  const connections = connectionsQuery.data;
  return <AppShell><div><div className="mono-font text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">The directory</div><h1 className="display-font mt-2 text-4xl tracking-[-.05em]">People worth knowing.</h1><p className="mt-3 max-w-md text-sm leading-6 text-[hsl(var(--muted-foreground))]">Search by name, username, or practice. Gridora only shows people who chose to be findable.</p></div><div className="mt-7 flex items-center gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4"><Search size={17} className="text-[hsl(var(--muted-foreground))]" /><input data-testid="input-search-profiles" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a person" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]" /><SlidersHorizontal size={16} className="text-[hsl(var(--muted-foreground))]" /></div><div className="mt-6 flex gap-1 overflow-x-auto border-b border-[hsl(var(--border))]">{[["discover", "Discover"], ["requests", `Requests${connections?.incoming.length ? ` · ${connections.incoming.length}` : ""}`], ["connected", `Connected${connections?.accepted.length ? ` · ${connections.accepted.length}` : ""}`]].map(([value, label]) => <button key={value} data-testid={`button-contact-tab-${value}`} onClick={() => setTab(value as typeof tab)} className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-bold ${tab === value ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-[hsl(var(--muted-foreground))]"}`}>{label}</button>)}</div><div className="mt-6">{tab === "discover" && (profilesQuery.isLoading ? <LoadingState /> : profilesQuery.isError ? <ErrorState onRetry={() => profilesQuery.refetch()} /> : profilesQuery.data?.length ? <div className="grid gap-3 sm:grid-cols-2">{profilesQuery.data.map((profile) => <ProfileCard key={profile.id} profile={profile} onConnect={() => request.mutate({ data: { recipientId: profile.id } }, { onSuccess: refresh })} pending={request.isPending} />)}</div> : <EmptyState icon={Users} eyebrow="No new signals" title="Nobody surfaced yet." body="Try a different search, or come back when the directory grows around you." />)}{tab === "requests" && <RequestList requests={connections?.incoming || []} respond={respond} onDone={refresh} />}{tab === "connected" && (connections?.accepted.length ? <div className="grid gap-3 sm:grid-cols-2">{connections.accepted.map((profile) => <ProfileCard key={profile.id} profile={profile} connected />)}</div> : <EmptyState icon={CircleDashed} eyebrow="Not yet" title="Your circle is still forming." body="Send a note to someone whose work you trust. The best networks start small." />)}</div></AppShell>;
}

function ProfileCard({ profile, onConnect, pending, connected }: { profile: Profile; onConnect?: () => void; pending?: boolean; connected?: boolean }) {
  return <div data-testid={`card-profile-${profile.id}`} className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/.5)]"><div className="flex items-start gap-3"><Avatar profile={profile} /><div className="min-w-0 flex-1"><div className="truncate font-bold">{profile.fullName}</div><div className="truncate text-xs text-[hsl(var(--muted-foreground))]">@{profile.username}</div></div><span className="rounded-full bg-[hsl(var(--primary)/.1)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--primary))]">{profile.userType}</span></div><p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-[hsl(var(--muted-foreground))]">{profile.bio || "No bio yet."}</p><div className="mt-4 flex items-center justify-between gap-2 text-xs text-[hsl(var(--muted-foreground))]"><span>{profile.location || "Location private"}</span>{connected ? <span className="inline-flex items-center gap-1 text-[hsl(110_54%_69%)]"><CircleCheck size={14} />Connected</span> : onConnect && <button data-testid={`button-connect-${profile.id}`} disabled={pending} onClick={onConnect} className="rounded-full bg-[hsl(var(--primary))] px-3 py-2 font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50">{pending ? "Sending…" : "Connect"}</button>}</div></div>;
}

function RequestList({ requests, respond, onDone }: { requests: Array<{ id: number; profile: Profile }>; respond: ReturnType<typeof useRespondToConnectionRequest>; onDone: () => void }) {
  if (!requests.length) return <EmptyState icon={Inbox} eyebrow="Clear inbox" title="No connection requests." body="When someone reaches out, you can decide if the connection feels right." />;
  return <div className="space-y-3">{requests.map((request) => <div key={request.id} data-testid={`card-request-${request.id}`} className="flex items-center gap-3 rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"><Avatar profile={request.profile} /><div className="min-w-0 flex-1"><div className="truncate font-bold">{request.profile.fullName}</div><div className="text-xs text-[hsl(var(--muted-foreground))]">@{request.profile.username} wants to connect</div></div><div className="flex gap-1"><button data-testid={`button-accept-request-${request.id}`} onClick={() => respond.mutate({ connectionId: request.id, data: { status: "accepted" } }, { onSuccess: onDone })} className="grid h-9 w-9 place-items-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Check size={16} /></button><button data-testid={`button-reject-request-${request.id}`} onClick={() => respond.mutate({ connectionId: request.id, data: { status: "rejected" } }, { onSuccess: onDone })} className="grid h-9 w-9 place-items-center rounded-full border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"><X size={16} /></button></div></div>)}</div>;
}

function ProfilePage() {
  const current = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const projects = useListProjects({ query: { queryKey: getListProjectsQueryKey() } });
  const [editing, setEditing] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  return <AppShell><ProfileEditor user={current.data} editing={editing} setEditing={setEditing} /><section className="mt-8"><div className="mb-4 flex items-end justify-between"><div><div className="mono-font text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Your workbench</div><h2 className="display-font mt-2 text-2xl">Projects</h2></div><button data-testid="button-open-project-form" onClick={() => setProjectOpen((value) => !value)} className="grid h-10 w-10 place-items-center rounded-full border border-[hsl(var(--border))] text-[hsl(var(--primary))]"><Plus size={18} /></button></div>{projectOpen && <ProjectForm onClose={() => setProjectOpen(false)} />}{projects.isLoading ? <div className="skeleton h-24 rounded-3xl" /> : projects.data?.length ? <div className="space-y-2">{projects.data.map((project) => <ProjectRow key={project.id} project={project} />)}</div> : <div className="rounded-3xl border border-dashed border-[hsl(var(--border))] p-7 text-center"><BriefcaseBusiness className="mx-auto text-[hsl(var(--muted-foreground))]" size={20} /><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Keep your active collaborations close.</p></div>}</section></AppShell>;
}

function ProfileEditor({ user, editing, setEditing }: { user?: CurrentUser; editing: boolean; setEditing: (value: boolean) => void }) {
  const update = useUpdateMyProfile();
  const client = useQueryClient();
  const [form, setForm] = useState({ fullName: user?.fullName || "", username: user?.username || "", bio: user?.bio || "", location: user?.location || "", userType: user?.userType || "other" as ProfileUpdateUserType, phone: user?.phone || "" });
  useEffect(() => { if (user) setForm({ fullName: user.fullName, username: user.username, bio: user.bio, location: user.location, userType: user.userType, phone: user.phone || "" }); }, [user]);
  const save = () => update.mutate({ data: { ...form, phone: form.phone || null } }, { onSuccess: () => { setEditing(false); client.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); } });
  if (!user) return <LoadingState />;
  return <section className="rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7"><div className="flex items-start gap-4"><Avatar profile={user} size="lg" /><div className="min-w-0 flex-1"><div className="mono-font text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Current profile</div><h1 data-testid="text-profile-name" className="display-font mt-2 truncate text-3xl tracking-[-.05em]">{user.fullName}</h1><p className="text-sm text-[hsl(var(--muted-foreground))]">@{user.username} · {user.email}</p></div><button data-testid="button-edit-profile" onClick={() => setEditing(!editing)} className="rounded-full border border-[hsl(var(--border))] p-3 text-[hsl(var(--primary))]"><Pencil size={16} /></button></div>{editing ? <div className="mt-7 space-y-4 border-t border-[hsl(var(--border))] pt-6"><Field label="Full name" value={form.fullName} onChange={(value) => setForm({ ...form, fullName: value })} testId="input-profile-full-name" /><Field label="Username" value={form.username} onChange={(value) => setForm({ ...form, username: value })} testId="input-profile-username" /><Field label="Location" value={form.location} onChange={(value) => setForm({ ...form, location: value })} testId="input-profile-location" /><div><label className="mb-2 block text-xs font-bold text-[hsl(var(--muted-foreground))]">Practice</label><select data-testid="select-profile-type" value={form.userType} onChange={(event) => setForm({ ...form, userType: event.target.value as ProfileUpdateUserType })} className="h-12 w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-4 text-sm outline-none"><option value="designer">Designer</option><option value="client">Client</option><option value="other">Other</option></select></div><div><label className="mb-2 block text-xs font-bold text-[hsl(var(--muted-foreground))]">Bio</label><textarea data-testid="input-profile-bio" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} rows={4} className="w-full resize-none rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4 text-sm outline-none" /></div><div className="flex justify-end gap-2"><button data-testid="button-cancel-profile" onClick={() => setEditing(false)} className="rounded-full px-4 py-2.5 text-sm text-[hsl(var(--muted-foreground))]">Cancel</button><button data-testid="button-save-profile" disabled={update.isPending} onClick={save} className="rounded-full bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))]">{update.isPending ? "Saving…" : "Save profile"}</button></div></div> : <div className="mt-7 border-t border-[hsl(var(--border))] pt-5"><p className="max-w-2xl text-sm leading-7 text-[hsl(var(--foreground)/.85)]">{user.bio || "Add a little context so the right people know how to start."}</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-[hsl(var(--primary)/.12)] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))]">{user.userType}</span>{user.location && <span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1.5 text-xs text-[hsl(var(--muted-foreground))]">{user.location}</span>}</div></div>}</section>;
}

function Field({ label, value, onChange, testId }: { label: string; value: string; onChange: (value: string) => void; testId: string }) {
  return <div><label className="mb-2 block text-xs font-bold text-[hsl(var(--muted-foreground))]">{label}</label><input data-testid={testId} value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-4 text-sm outline-none focus:border-[hsl(var(--primary))]" /></div>;
}

function ProjectForm({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const create = useCreateProject();
  const client = useQueryClient();
  return <div className="mb-4 rounded-3xl border border-[hsl(var(--primary)/.4)] bg-[hsl(var(--card))] p-4"><input data-testid="input-project-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Project title" className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]" /><textarea data-testid="input-project-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are you trying to make?" rows={3} className="w-full resize-none bg-transparent py-2 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]" /><div className="flex justify-end gap-2 border-t border-[hsl(var(--border))] pt-3"><button data-testid="button-cancel-project" onClick={onClose} className="rounded-full px-4 py-2 text-xs text-[hsl(var(--muted-foreground))]">Cancel</button><button data-testid="button-create-project" disabled={!title.trim() || !description.trim() || create.isPending} onClick={() => create.mutate({ data: { title: title.trim(), description: description.trim() } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListProjectsQueryKey() }); onClose(); } })} className="rounded-full bg-[hsl(var(--primary))] px-4 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))]">Create project</button></div></div>;
}

function ProjectRow({ project }: { project: Project }) {
  return <div data-testid={`row-project-${project.id}`} className="flex items-center gap-3 rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--accent)/.14)] text-[hsl(var(--accent))]"><FileText size={17} /></div><div className="min-w-0 flex-1"><div className="truncate font-bold">{project.title}</div><div className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{project.description}</div></div><span className="rounded-full bg-[hsl(var(--muted))] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{project.status.replace("_", " ")}</span></div>;
}

function SettingsPage() {
  const { signOut } = useClerk();
  const current = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  return <AppShell><div className="mono-font text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Your controls</div><h1 className="display-font mt-2 text-4xl tracking-[-.05em]">Settings</h1><div className="mt-8 space-y-3"><div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="flex items-center gap-3"><ShieldCheck className="text-[hsl(var(--primary))]" size={20} /><div><div className="font-bold">Account</div><div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{current.data?.email || "Your account details"}</div></div></div><Link data-testid="link-settings-profile" href="/app/profile" className="mt-5 flex items-center justify-between rounded-2xl bg-[hsl(var(--muted))] px-4 py-3 text-sm font-semibold">Edit profile <ArrowUpRight size={16} /></Link></div><div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="flex items-center gap-3"><LockKeyhole className="text-[hsl(var(--accent))]" size={20} /><div><div className="font-bold">Privacy by default</div><div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Your profile and messages stay in your control.</div></div></div></div><button data-testid="button-sign-out" onClick={() => signOut({ redirectUrl: basePath || "/" })} className="flex w-full items-center justify-between rounded-3xl border border-[hsl(var(--destructive)/.35)] bg-[hsl(var(--destructive)/.08)] px-5 py-4 text-sm font-bold text-[hsl(var(--destructive))]">Sign out <LogOut size={18} /></button></div></AppShell>;
}

function AdminPage() {
  const summary = useGetAdminSummary({ query: { queryKey: getGetAdminSummaryQueryKey() } });
  const metrics = summary.data ? [["users", summary.data.users, Users], ["posts", summary.data.posts, FileText], ["likes", summary.data.likes, Heart], ["comments", summary.data.comments, MessageCircle], ["connections", summary.data.connections, CircleCheck], ["messages", summary.data.messages, Inbox], ["projects", summary.data.projects, BriefcaseBusiness], ["reports", summary.data.reports, ShieldCheck]] as const : [];
  return <AppShell><div className="flex items-end justify-between"><div><div className="mono-font text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Behind the curtain</div><h1 className="display-font mt-2 text-4xl tracking-[-.05em]">Admin portal</h1></div><BarChart3 className="text-[hsl(var(--primary))]" /></div>{summary.isLoading ? <div className="mt-8 grid grid-cols-2 gap-3">{[1, 2, 3, 4].map((item) => <div key={item} className="skeleton h-28 rounded-3xl" />)}</div> : summary.isError ? <ErrorState onRetry={() => summary.refetch()} /> : <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">{metrics.map(([label, value, Icon]) => <div key={label} data-testid={`metric-${label}`} className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"><Icon size={17} className="text-[hsl(var(--primary))]" /><div className="mono-font mt-5 text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">{label}</div><div className="display-font mt-1 text-3xl">{value}</div></div>)}</div>}<div className="mt-8 rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={17} className="text-[hsl(110_54%_69%)]" /> Protected workspace</div><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Server authorization controls access to this view. This surface only renders real platform totals.</p></div></AppShell>;
}

function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  return <div className="gridora-noise flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-4 py-10"><div className="w-full max-w-[440px]"><div className="mb-8 flex items-center justify-between"><Logo /><Link data-testid="link-auth-home" href="/" className="text-xs text-[hsl(var(--muted-foreground))]">Back to Gridora</Link></div>{mode === "sign-in" ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /> : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />}</div></div>;
}

function ClerkQueryInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  useEffect(() => addListener(({ user }) => { if (!user) client.clear(); }), [addListener, client]);
  return null;
}

function RoutedApp() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={PublicHomeRoute} />
    <Route path="/sign-in/*?" component={() => <AuthPage mode="sign-in" />} />
    <Route path="/sign-up/*?" component={() => <AuthPage mode="sign-up" />} />
    <Route path="/app/chat/:userId" component={() => <AuthGate><ChatThreadPage /></AuthGate>} />
    <Route path="/app/chat" component={() => <AuthGate><ChatPage /></AuthGate>} />
    <Route path="/app/contacts" component={() => <AuthGate><ContactsPage /></AuthGate>} />
    <Route path="/app/settings" component={() => <AuthGate><SettingsPage /></AuthGate>} />
    <Route path="/app/profile" component={() => <AuthGate><ProfilePage /></AuthGate>} />
    <Route path="/app/admin" component={() => <AuthGate><AdminPage /></AuthGate>} />
    <Route path="/app" component={() => <AuthGate><FeedPage /></AuthGate>} />
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function relativeTime(value?: string) {
  if (!value) return "";
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

const appearance = {
  variables: {
    colorPrimary: "hsl(267 91% 79%)",
    colorForeground: "hsl(250 38% 95%)",
    colorMutedForeground: "hsl(250 16% 64%)",
    colorBackground: "hsl(248 22% 12%)",
    colorInput: "hsl(249 20% 16%)",
    colorInputForeground: "hsl(250 38% 95%)",
    colorDanger: "hsl(4 74% 66%)",
    colorNeutral: "hsl(252 18% 20%)",
    fontFamily: "Manrope, sans-serif",
    borderRadius: "1rem"
  },
  elements: {
    rootBox: "w-full",
    cardBox: "bg-[hsl(248_22%_12%)] border border-[hsl(252_20%_23%)] rounded-[2rem] w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent",
    footer: "!shadow-none !border-0 !bg-transparent",
    headerTitle: "text-[hsl(250_38%_95%)] font-bold",
    headerSubtitle: "text-[hsl(250_16%_64%)]",
    socialButtonsBlockButtonText: { color: "hsl(250 38% 95%)", fontWeight: 600 },
    formFieldLabel: "text-[hsl(250_38%_95%)]",
    footerActionLink: "text-[hsl(267_91%_79%)]",
    footerActionText: "text-[hsl(250_16%_64%)]",
    dividerText: "text-[hsl(250_16%_64%)]",
    formButtonPrimary: "bg-[hsl(267_91%_79%)] text-[hsl(249_25%_12%)] hover:bg-[hsl(267_91%_84%)]",
    formFieldInput: "bg-[hsl(249_20%_16%)] border-[hsl(252_20%_26%)] text-[hsl(250_38%_95%)]",
    socialButtonsBlockButton: {
      backgroundColor: "hsl(249 20% 16%)",
      borderColor: "hsl(252 20% 26%)"
    },
    alert: "bg-[hsl(4_74%_66%/.12)]",
    alertText: "text-[hsl(4_74%_80%)]"
  }
};

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

function ClerkApp() {
  const [, setLocation] = useLocation();
  if (!clerkPubKey) return <PublicHomeContent />;
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: "Welcome back", subtitle: "Keep making room for good work." } }, signUp: { start: { title: "Make room", subtitle: "Join a quieter creative network." } } }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to))}><QueryClientProvider client={queryClient}><ClerkQueryInvalidator /><RoutedApp /></QueryClientProvider></ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkApp /></WouterRouter>;
}

export default App;