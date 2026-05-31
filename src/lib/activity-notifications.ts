import type { StoredNotification } from "./scenario-persistence";

export type ActivityNotificationInput = {
  tone: StoredNotification["tone"];
  title: string;
  body?: string;
  toast?: boolean;
};

export const createActivityNotification = ({ tone, title, body }: ActivityNotificationInput): StoredNotification => ({
  id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  tone,
  title,
  body,
  createdAt: new Date().toISOString(),
  read: false,
});

export const appendActivityNotification = (
  notifications: StoredNotification[],
  notification: StoredNotification,
) => [notification, ...notifications].slice(0, 20);

export const markActivityNotificationsRead = (notifications: StoredNotification[]) =>
  notifications.map((notification) => ({ ...notification, read: true }));
