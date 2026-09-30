import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const usersTable = pgTable("gridora_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  emailKey: text("email_key").notNull().default(""),
  fullName: text("full_name").notNull(),
  username: text("username").notNull(),
  phone: text("phone"),
  userType: text("user_type").notNull().default("other"),
  bio: text("bio").notNull().default(""),
  location: text("location").notNull().default(""),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("gridora_users_email_key_unique").on(table.emailKey),
  uniqueIndex("gridora_users_phone_unique").on(table.phone),
]);

export const connectionsTable = pgTable(
  "gridora_connections",
  {
    id: serial("id").primaryKey(),
    requesterId: text("requester_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    recipientId: text("recipient_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [unique("gridora_connections_pair").on(table.requesterId, table.recipientId)],
);

export const messagesTable = pgTable("gridora_messages", {
  id: serial("id").primaryKey(),
  senderId: text("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  receiverId: text("receiver_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const postsTable = pgTable("gridora_posts", {
  id: serial("id").primaryKey(),
  authorId: text("author_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const likesTable = pgTable(
  "gridora_likes",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("gridora_likes_post_user").on(table.postId, table.userId)],
);

export const commentsTable = pgTable("gridora_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectsTable = pgTable("gridora_projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("requested"),
  clientId: text("client_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  designerId: text("designer_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationsTable = pgTable("gridora_notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reportsTable = pgTable("gridora_reports", {
  id: serial("id").primaryKey(),
  reporterId: text("reporter_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true, updatedAt: true });
export const insertConnectionSchema = createInsertSchema(connectionsTable).omit({ id: true, createdAt: true, respondedAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true, editedAt: true, deletedAt: true });
export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true, createdAt: true });
export const insertLikeSchema = createInsertSchema(likesTable).omit({ id: true, createdAt: true });
export const insertCommentSchema = createInsertSchema(commentsTable).omit({ id: true, createdAt: true });
export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Connection = typeof connectionsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type Post = typeof postsTable.$inferSelect;
export type Comment = typeof commentsTable.$inferSelect;
export type Project = typeof projectsTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;