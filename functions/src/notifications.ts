export type NotificationDestination = "adminSales" | "myPurchases";

export interface NotificationPayloadInput {
  title: string;
  body: string;
  destination: NotificationDestination;
  path?: string;
  imageUrl?: string;
}

export interface NotificationPayload {
  notification: { title: string; body: string; imageUrl?: string };
  webpush: {
    notification: { icon?: string; data: { url: string } };
    fcmOptions: { link: string };
  };
}

export interface NotificationTokenRow {
  userId: string;
  token: unknown;
  enabled?: unknown;
}

const SITE_ORIGIN = "https://rifasmtz.web.app";
const DESTINATIONS: Record<NotificationDestination, string> = {
  adminSales: "/admin/sales",
  myPurchases: "/user/my-purchases",
};

/** Keep links on the production Hosting site and preserve standard FCM display. */
export function buildNotificationPayload(
  input: NotificationPayloadInput
): NotificationPayload {
  const defaultPath = DESTINATIONS[input.destination];
  if (!defaultPath) throw new Error("Unsupported notification destination");
  const path = input.path ?? defaultPath;
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Notification path must be a same-origin path");
  }
  const link = new URL(path, SITE_ORIGIN);
  if (link.origin !== SITE_ORIGIN) {
    throw new Error("Notification path must be a same-origin path");
  }

  return {
    notification: {
      title: input.title,
      body: input.body,
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
    },
    webpush: {
      notification: {
        ...(input.imageUrl ? { icon: input.imageUrl } : {}),
        data: { url: path },
      },
      fcmOptions: { link: link.toString() },
    },
  };
}

/** Index enabled device tokens by account so private outcomes aren't broadcast. */
export function tokensByUser(rows: NotificationTokenRow[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.userId || typeof row.token !== "string" || !row.token || row.enabled === false) continue;
    const tokens = result.get(row.userId) ?? [];
    tokens.push(row.token);
    result.set(row.userId, tokens);
  }
  return result;
}
