import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, usersTable, connectionsTable, messagesTable, postsTable, likesTable, commentsTable, projectsTable, notificationsTable, reportsTable } from "@workspace/db";
import {
  CreateCommentBody,
  CreateCommentParams,
  CreateConnectionRequestBody,
  CreatePostBody,
  CreateProjectBody,
  EditMessageBody,
  EditMessageParams,
  GetAdminSummaryResponse,
  GetCurrentUserResponse,
  GetProfileParams,
  GetProfileResponse,
  ListCommentsParams,
  ListCommentsResponse,
  ListConnectionsResponse,
  ListConversationsResponse,
  ListMessagesParams,
  ListMessagesResponse,
  ListNotificationsResponse,
  ListPostsResponse,
  ListProfilesQueryParams,
  ListProfilesResponse,
  ListProjectsResponse,
  RespondToConnectionRequestBody,
  RespondToConnectionRequestParams,
  SendMessageBody,
  SendMessageParams,
  TogglePostLikeParams,
  UpdateMyProfileBody,
} from "@workspace/api-zod";
import { clerkProfile, requireUser, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

const getUserId = (req: AuthenticatedRequest) => req.userId;

async function ensureUser(userId: string) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const configuredAdminIds = new Set(
    (process.env.ADMIN_CLERK_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (existing) {
    if (configuredAdminIds.has(userId) && existing.role !== "admin") {
      const [promoted] = await db
        .update(usersTable)
        .set({ role: "admin", updatedAt: new Date() })
        .where(eq(usersTable.id, userId))
        .returning();
      return promoted ?? existing;
    }
    return existing;
  }

  const profile = await clerkProfile(userId);
  const [created] = await db
    .insert(usersTable)
    .values({
      id: userId,
      email: profile.email,
      fullName: profile.fullName,
      username: profile.username,
      phone: profile.phone,
      avatarUrl: profile.avatarUrl,
      role: configuredAdminIds.has(userId) ? "admin" : "user",
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [retried] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!retried) throw new Error("Unable to create local user profile");
  return retried;
}

function profileOf(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    phone: user.phone,
    userType: user.userType as "designer" | "client" | "other",
    bio: user.bio,
    location: user.location,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

async function userById(id: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  return user;
}

async function areConnected(firstId: string, secondId: string) {
  const rows = await db
    .select({ status: connectionsTable.status })
    .from(connectionsTable)
    .where(
      or(
        and(eq(connectionsTable.requesterId, firstId), eq(connectionsTable.recipientId, secondId)),
        and(eq(connectionsTable.requesterId, secondId), eq(connectionsTable.recipientId, firstId)),
      ),
    );
  return rows.some((row) => row.status === "accepted");
}

async function count(table: typeof likesTable | typeof commentsTable | typeof reportsTable | typeof usersTable | typeof postsTable | typeof connectionsTable | typeof messagesTable | typeof projectsTable) {
  const [result] = await db.select({ count: sql<number>`count(*)` }).from(table);
  return Number(result?.count ?? 0);
}

router.get("/me", requireUser, async (req, res): Promise<void> => {
  const user = await ensureUser(getUserId(req as AuthenticatedRequest));
  res.json(GetCurrentUserResponse.parse({ ...profileOf(user), role: user.role }));
});

router.get("/profiles", requireUser, async (req, res): Promise<void> => {
  const parsed = ListProfilesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const currentUserId = getUserId(req as AuthenticatedRequest);
  await ensureUser(currentUserId);
  const filters = [];
  if (parsed.data.q) {
    filters.push(or(ilike(usersTable.fullName, `%${parsed.data.q}%`), ilike(usersTable.username, `%${parsed.data.q}%`)));
  }
  if (parsed.data.userType) filters.push(eq(usersTable.userType, parsed.data.userType));
  filters.push(sql`${usersTable.id} <> ${currentUserId}`);
  const users = await db.select().from(usersTable).where(and(...filters)).orderBy(desc(usersTable.createdAt));
  res.json(ListProfilesResponse.parse(users.map(profileOf)));
});

router.patch("/profiles/me", requireUser, async (req, res): Promise<void> => {
  const body = UpdateMyProfileBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const currentUserId = getUserId(req as AuthenticatedRequest);
  await ensureUser(currentUserId);
  const [updated] = await db
    .update(usersTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(usersTable.id, currentUserId))
    .returning();
  res.json(GetProfileResponse.parse(profileOf(updated)));
});

router.get("/profiles/:userId", requireUser, async (req, res): Promise<void> => {
  const params = GetProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = await userById(params.data.userId);
  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(GetProfileResponse.parse(profileOf(user)));
});

router.get("/connections", requireUser, async (req, res): Promise<void> => {
  const currentUserId = getUserId(req as AuthenticatedRequest);
  await ensureUser(currentUserId);
  const acceptedRows = await db
    .select({ connection: connectionsTable, other: usersTable })
    .from(connectionsTable)
    .innerJoin(
      usersTable,
      or(
        and(eq(connectionsTable.requesterId, currentUserId), eq(usersTable.id, connectionsTable.recipientId)),
        and(eq(connectionsTable.recipientId, currentUserId), eq(usersTable.id, connectionsTable.requesterId)),
      ),
    )
    .where(and(eq(connectionsTable.status, "accepted"), or(eq(connectionsTable.requesterId, currentUserId), eq(connectionsTable.recipientId, currentUserId))));
  const incomingRows = await db
    .select({ connection: connectionsTable, profile: usersTable })
    .from(connectionsTable)
    .innerJoin(usersTable, eq(usersTable.id, connectionsTable.requesterId))
    .where(and(eq(connectionsTable.recipientId, currentUserId), eq(connectionsTable.status, "pending")));
  const outgoingRows = await db
    .select({ connection: connectionsTable, profile: usersTable })
    .from(connectionsTable)
    .innerJoin(usersTable, eq(usersTable.id, connectionsTable.recipientId))
    .where(and(eq(connectionsTable.requesterId, currentUserId), eq(connectionsTable.status, "pending")));

  res.json(ListConnectionsResponse.parse({
    accepted: acceptedRows.map((row) => profileOf(row.other)),
    incoming: incomingRows.map((row) => ({ ...row.connection, profile: profileOf(row.profile) })),
    outgoing: outgoingRows.map((row) => ({ ...row.connection, profile: profileOf(row.profile) })),
  }));
});

router.post("/connections", requireUser, async (req, res): Promise<void> => {
  const body = CreateConnectionRequestBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const currentUserId = getUserId(req as AuthenticatedRequest);
  await ensureUser(currentUserId);
  if (body.data.recipientId === currentUserId || !(await userById(body.data.recipientId))) {
    res.status(400).json({ error: "Choose an existing user" });
    return;
  }
  const existing = await db.select().from(connectionsTable).where(
    or(
      and(eq(connectionsTable.requesterId, currentUserId), eq(connectionsTable.recipientId, body.data.recipientId)),
      and(eq(connectionsTable.requesterId, body.data.recipientId), eq(connectionsTable.recipientId, currentUserId)),
    ),
  ).limit(1);
  if (existing[0]) {
    res.status(400).json({ error: "A connection request already exists" });
    return;
  }
  const [connection] = await db.insert(connectionsTable).values({
    requesterId: currentUserId,
    recipientId: body.data.recipientId,
  }).returning();
  const actor = await userById(currentUserId);
  await db.insert(notificationsTable).values({
    userId: body.data.recipientId,
    type: "connection_request",
    title: "New connection request",
    body: actor?.fullName ? `${actor.fullName} wants to connect with you.` : "You have a new connection request.",
  });
  res.status(201).json(connection);
});

router.patch("/connections/:connectionId", requireUser, async (req, res): Promise<void> => {
  const params = RespondToConnectionRequestParams.safeParse(req.params);
  const body = RespondToConnectionRequestBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid connection response" });
    return;
  }
  const currentUserId = getUserId(req as AuthenticatedRequest);
  const [connection] = await db.select().from(connectionsTable).where(and(
    eq(connectionsTable.id, params.data.connectionId),
    eq(connectionsTable.recipientId, currentUserId),
    eq(connectionsTable.status, "pending"),
  ));
  if (!connection) {
    res.status(404).json({ error: "Connection request not found" });
    return;
  }
  const [updated] = await db.update(connectionsTable).set({ status: body.data.status, respondedAt: new Date() }).where(eq(connectionsTable.id, connection.id)).returning();
  await db.insert(notificationsTable).values({
    userId: connection.requesterId,
    type: "connection_response",
    title: body.data.status === "accepted" ? "Connection accepted" : "Connection request declined",
    body: body.data.status === "accepted" ? "You are now connected." : "Your connection request was declined.",
  });
  res.json(updated);
});

router.get("/conversations", requireUser, async (req, res): Promise<void> => {
  const currentUserId = getUserId(req as AuthenticatedRequest);
  await ensureUser(currentUserId);
  const accepted = await db.select({ other: usersTable }).from(connectionsTable).innerJoin(
    usersTable,
    or(
      and(eq(connectionsTable.requesterId, currentUserId), eq(usersTable.id, connectionsTable.recipientId)),
      and(eq(connectionsTable.recipientId, currentUserId), eq(usersTable.id, connectionsTable.requesterId)),
    ),
  ).where(and(eq(connectionsTable.status, "accepted"), or(eq(connectionsTable.requesterId, currentUserId), eq(connectionsTable.recipientId, currentUserId))));
  const conversations = await Promise.all(accepted.map(async ({ other }) => {
    const [latestMessage] = await db.select().from(messagesTable).where(or(
      and(eq(messagesTable.senderId, currentUserId), eq(messagesTable.receiverId, other.id)),
      and(eq(messagesTable.senderId, other.id), eq(messagesTable.receiverId, currentUserId)),
    )).orderBy(desc(messagesTable.createdAt)).limit(1);
    return { user: profileOf(other), latestMessage: latestMessage ?? null, unreadCount: 0 };
  }));
  res.json(ListConversationsResponse.parse(conversations));
});

router.get("/conversations/:userId/messages", requireUser, async (req, res): Promise<void> => {
  const params = ListMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const currentUserId = getUserId(req as AuthenticatedRequest);
  if (!(await areConnected(currentUserId, params.data.userId))) {
    res.status(403).json({ error: "Messages are only available to accepted connections" });
    return;
  }
  const messages = await db.select().from(messagesTable).where(or(
    and(eq(messagesTable.senderId, currentUserId), eq(messagesTable.receiverId, params.data.userId)),
    and(eq(messagesTable.senderId, params.data.userId), eq(messagesTable.receiverId, currentUserId)),
  )).orderBy(messagesTable.createdAt);
  res.json(ListMessagesResponse.parse(messages));
});

router.post("/conversations/:userId/messages", requireUser, async (req, res): Promise<void> => {
  const params = SendMessageParams.safeParse(req.params);
  const body = SendMessageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid message" });
    return;
  }
  const currentUserId = getUserId(req as AuthenticatedRequest);
  if (!(await areConnected(currentUserId, params.data.userId))) {
    res.status(403).json({ error: "Messages are only available to accepted connections" });
    return;
  }
  const [message] = await db.insert(messagesTable).values({ senderId: currentUserId, receiverId: params.data.userId, body: body.data.body }).returning();
  res.status(201).json(message);
});

router.patch("/messages/:messageId", requireUser, async (req, res): Promise<void> => {
  const params = EditMessageParams.safeParse(req.params);
  const body = EditMessageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid message" });
    return;
  }
  const currentUserId = getUserId(req as AuthenticatedRequest);
  const [message] = await db.update(messagesTable).set({ body: body.data.body, editedAt: new Date() }).where(and(eq(messagesTable.id, params.data.messageId), eq(messagesTable.senderId, currentUserId))).returning();
  if (!message) {
    res.status(403).json({ error: "Only the sender can edit this message" });
    return;
  }
  res.json(message);
});

router.delete("/messages/:messageId", requireUser, async (req, res): Promise<void> => {
  const params = EditMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const currentUserId = getUserId(req as AuthenticatedRequest);
  const deleted = await db.delete(messagesTable).where(and(eq(messagesTable.id, params.data.messageId), eq(messagesTable.senderId, currentUserId))).returning({ id: messagesTable.id });
  if (!deleted[0]) {
    res.status(403).json({ error: "Only the sender can delete this message" });
    return;
  }
  res.sendStatus(204);
});

router.get("/posts", requireUser, async (req, res): Promise<void> => {
  const currentUserId = getUserId(req as AuthenticatedRequest);
  await ensureUser(currentUserId);
  const posts = await db.select({ post: postsTable, author: usersTable }).from(postsTable).innerJoin(usersTable, eq(usersTable.id, postsTable.authorId)).orderBy(desc(postsTable.createdAt));
  const result = await Promise.all(posts.map(async ({ post, author }) => {
    const [likeCount] = await db.select({ count: sql<number>`count(*)` }).from(likesTable).where(eq(likesTable.postId, post.id));
    const [commentCount] = await db.select({ count: sql<number>`count(*)` }).from(commentsTable).where(eq(commentsTable.postId, post.id));
    const [liked] = await db.select({ id: likesTable.id }).from(likesTable).where(and(eq(likesTable.postId, post.id), eq(likesTable.userId, currentUserId))).limit(1);
    return { id: post.id, author: profileOf(author), body: post.body, likeCount: Number(likeCount?.count ?? 0), commentCount: Number(commentCount?.count ?? 0), likedByMe: Boolean(liked), createdAt: post.createdAt };
  }));
  res.json(ListPostsResponse.parse(result));
});

router.post("/posts", requireUser, async (req, res): Promise<void> => {
  const body = CreatePostBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const currentUserId = getUserId(req as AuthenticatedRequest);
  await ensureUser(currentUserId);
  const [post] = await db.insert(postsTable).values({ authorId: currentUserId, body: body.data.body }).returning();
  const author = await userById(currentUserId);
  res.status(201).json({ id: post.id, author: profileOf(author!), body: post.body, likeCount: 0, commentCount: 0, likedByMe: false, createdAt: post.createdAt });
});

router.post("/posts/:postId/like", requireUser, async (req, res): Promise<void> => {
  const params = TogglePostLikeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const currentUserId = getUserId(req as AuthenticatedRequest);
  const existing = await db.select({ id: likesTable.id }).from(likesTable).where(and(eq(likesTable.postId, params.data.postId), eq(likesTable.userId, currentUserId))).limit(1);
  if (existing[0]) await db.delete(likesTable).where(eq(likesTable.id, existing[0].id));
  else await db.insert(likesTable).values({ postId: params.data.postId, userId: currentUserId });
  const [likeCount] = await db.select({ count: sql<number>`count(*)` }).from(likesTable).where(eq(likesTable.postId, params.data.postId));
  res.json({ liked: !existing[0], likeCount: Number(likeCount?.count ?? 0) });
});

router.get("/posts/:postId/comments", requireUser, async (req, res): Promise<void> => {
  const params = ListCommentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const comments = await db.select({ comment: commentsTable, author: usersTable }).from(commentsTable).innerJoin(usersTable, eq(usersTable.id, commentsTable.authorId)).where(eq(commentsTable.postId, params.data.postId)).orderBy(commentsTable.createdAt);
  res.json(ListCommentsResponse.parse(comments.map(({ comment, author }) => ({ id: comment.id, author: profileOf(author), body: comment.body, createdAt: comment.createdAt }))));
});

router.post("/posts/:postId/comments", requireUser, async (req, res): Promise<void> => {
  const params = CreateCommentParams.safeParse(req.params);
  const body = CreateCommentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid comment" });
    return;
  }
  const currentUserId = getUserId(req as AuthenticatedRequest);
  await ensureUser(currentUserId);
  const [comment] = await db.insert(commentsTable).values({ postId: params.data.postId, authorId: currentUserId, body: body.data.body }).returning();
  const author = await userById(currentUserId);
  res.status(201).json({ id: comment.id, author: profileOf(author!), body: comment.body, createdAt: comment.createdAt });
});

router.get("/projects", requireUser, async (req, res): Promise<void> => {
  const currentUserId = getUserId(req as AuthenticatedRequest);
  await ensureUser(currentUserId);
  const projects = await db.select().from(projectsTable).where(or(eq(projectsTable.clientId, currentUserId), eq(projectsTable.designerId, currentUserId))).orderBy(desc(projectsTable.createdAt));
  res.json(ListProjectsResponse.parse(projects));
});

router.post("/projects", requireUser, async (req, res): Promise<void> => {
  const body = CreateProjectBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const currentUserId = getUserId(req as AuthenticatedRequest);
  await ensureUser(currentUserId);
  const [project] = await db.insert(projectsTable).values({ title: body.data.title, description: body.data.description, clientId: currentUserId, designerId: body.data.designerId ?? null }).returning();
  res.status(201).json(project);
});

router.get("/notifications", requireUser, async (req, res): Promise<void> => {
  const currentUserId = getUserId(req as AuthenticatedRequest);
  await ensureUser(currentUserId);
  const notifications = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, currentUserId)).orderBy(desc(notificationsTable.createdAt));
  res.json(ListNotificationsResponse.parse(notifications));
});

router.get("/admin/summary", requireUser, async (req, res): Promise<void> => {
  const currentUserId = getUserId(req as AuthenticatedRequest);
  const user = await ensureUser(currentUserId);
  if (user.role !== "admin") {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  res.json(GetAdminSummaryResponse.parse({
    users: await count(usersTable),
    posts: await count(postsTable),
    likes: await count(likesTable),
    comments: await count(commentsTable),
    connections: await count(connectionsTable),
    messages: await count(messagesTable),
    projects: await count(projectsTable),
    reports: await count(reportsTable),
  }));
});

export default router;