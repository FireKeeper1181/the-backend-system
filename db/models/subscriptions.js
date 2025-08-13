import db from "../knex.js";

async function savePushSubscription(userId, userType, subscriptionObject) {
  const endpoint = subscriptionObject.endpoint;

  const existing = await db('push_subscriptions')
    .where({
      user_id: userId,
      user_type: userType,
    })
    .andWhereRaw("json_extract(subscription_object, '$.endpoint') = ?", [endpoint])
    .first();

  if (existing) {
    return existing;
  }

  const [subscription_id] = await db('push_subscriptions').insert({
    user_id: userId,
    user_type: userType,
    subscription_object: JSON.stringify(subscriptionObject),
  });

  return db('push_subscriptions').where({ subscription_id }).first();
}

async function getPushSubscriptions(userId, userType) {
  const subscriptions = await db('push_subscriptions')
    .where({
      user_id: userId,
      user_type: userType,
    });

  return subscriptions.map(sub => ({
    ...sub,
    subscription_object: JSON.parse(sub.subscription_object),
  }));
}

export default {
  savePushSubscription,
  getPushSubscriptions,
};