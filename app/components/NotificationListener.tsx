// Example: NotificationListener.js
import React, { useEffect } from "react";
import { onMessageListener } from "../firebaseMessaging"; // Adjust the import path as needed

const NotificationListener = () => {
  useEffect(() => {
    const listen = async () => {
      try {
        const notification = await onMessageListener();
        // Do something with the notification, e.g., show a toast
        alert(`Notification: ${notification.title} - ${notification.body}`);
      } catch (err) {
      }
    };
    listen();
  }, []);

  return null; // Or your UI
};

export default NotificationListener;