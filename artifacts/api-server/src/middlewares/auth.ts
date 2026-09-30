import { getAuth, clerkClient } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export type AuthenticatedRequest = Request & { userId: string };

export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  (req as AuthenticatedRequest).userId = userId;
  next();
}

export async function clerkProfile(userId: string) {
  const user = await clerkClient.users.getUser(userId);
  const primaryEmail = user.emailAddresses.find(
    (address) => address.id === user.primaryEmailAddressId,
  ) ?? user.emailAddresses[0];
  const email = primaryEmail?.emailAddress ?? "";
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const primaryPhone = user.phoneNumbers.find(
    (phoneNumber) => phoneNumber.id === user.primaryPhoneNumberId,
  );

  return {
    email,
    emailVerified: primaryEmail?.verification?.status === "verified",
    fullName,
    username: user.username ?? "",
    phone: primaryPhone?.verification?.status === "verified"
      ? primaryPhone.phoneNumber
      : null,
    avatarUrl: user.imageUrl ?? null,
  };
}