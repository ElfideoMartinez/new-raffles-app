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

const SITE_ORIGIN = "https://raffleapp-dbc1b.web.app";
const DESTINATIONS: Record<NotificationDestination, string> = {
  adminSales: "/admin/sales",
  myPurchases: "/user/my-purchases",
};

/** Add a safe web click-through while retaining FCM's display notification. */
export function buildNotificationPayload(
  input: NotificationPayloadInput
): NotificationPayload {
  const path = DESTINATIONS[input.destination];
  if (!path) throw new Error("Unsupported notification destination");
  const notificationPath = input.path ?? path;
  if (!notificationPath.startsWith("/") || notificationPath.startsWith("//")) {
    throw new Error("Notification path must be a same-origin path");
  }

  const configuredOrigin = process.env.PUBLIC_SITE_URL || SITE_ORIGIN;
  const origin = new URL(configuredOrigin);
  if (origin.protocol !== "https:" && origin.hostname !== "localhost") {
    throw new Error("Notification site origin must use HTTPS");
  }
  const link = new URL(notificationPath, origin);
  if (link.origin !== origin.origin) {
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
        data: { url: notificationPath },
      },
      fcmOptions: { link: link.toString() },
    },
  };
}
