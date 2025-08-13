import webPush from 'web-push';
import subscriptionsModel from '../db/models/subscriptions.js';

// Set up your VAPID keys from the .env file
webPush.setVapidDetails(
  'mailto:mc230120743@student.unitar.my',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Sends a push notification to a specific user.
 * @param {string|number} userId - The ID of the user.
 * @param {string} userType - 'lecturer' or 'student'.
 * @param {object} payload - An object with { title, body }.
 */
async function sendNotificationToUser(userId, userType, payload) {
  // 1. Get all saved subscriptions for this user from the database
  const subscriptions = await subscriptionsModel.getPushSubscriptions(userId, userType);

  if (subscriptions.length === 0) {
    console.log(`No push subscriptions found for ${userType} ${userId}.`);
    return;
  }

  // 2. Create the notification payload string
  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: 'icons/unitar-favicon.png', // This path is relative to your frontend's public folder
  });

  // 3. Send the notification to each of the user's devices
  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(sub.subscription_object, notificationPayload);
    } catch (error) {
      console.error(`Error sending notification to endpoint for ${userType} ${userId}. Subscription might be expired.`, error.statusCode);
      // TODO: If error.statusCode is 410 (Gone), delete the subscription from your database.
    }
  }
}

export default {
  sendNotificationToUser,
};