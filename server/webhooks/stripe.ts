import { Request, Response } from "express";
import { stripe } from "../stripe";
import { ENV } from "../_core/env";
import * as db from "../db";

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];
  
  if (!sig) {
    console.error("[Webhook] No stripe-signature header");
    return res.status(400).send("No signature");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      ENV.stripeWebhookSecret || ""
    );
  } catch (err: any) {
    console.error("[Webhook] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

  // Handle test events
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({
      verified: true,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const userId = parseInt(session.client_reference_id || session.metadata?.user_id);
        
        if (!userId) {
          console.error("[Webhook] No user ID in checkout session");
          break;
        }

        const subscriptionId = session.subscription;
        const customerId = session.customer;

        if (subscriptionId && customerId) {
          const subscription: any = await stripe.subscriptions.retrieve(subscriptionId as string);
          const priceId = subscription.items.data[0]?.price.id;

          const plans = await db.getAllSubscriptionPlans();
          const plan = plans.find(p => p.stripePriceId === priceId);

          if (plan) {
            const existing = await db.getUserSubscription(userId);
            
            if (existing) {
              await db.updateUserSubscription(userId, {
                planId: plan.id,
                stripeSubscriptionId: subscriptionId as string,
                status: subscription.status as any,
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              });
            } else {
              await db.createUserSubscription({
                userId,
                planId: plan.id,
                stripeCustomerId: customerId as string,
                stripeSubscriptionId: subscriptionId as string,
                status: subscription.status as any,
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              });
            }

            console.log(`[Webhook] Subscription created for user ${userId}, plan: ${plan.name}`);
          }
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as any;
        const userId = parseInt(invoice.metadata?.user_id || "0");

        if (userId && invoice.amount_paid > 0) {
          await db.createPaymentRecord({
            userId,
            stripeInvoiceId: invoice.id,
            stripePaymentIntentId: invoice.payment_intent,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: "succeeded",
            description: `Subscription payment`,
          });
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing event:", error);
    res.status(500).send("Webhook processing failed");
  }
}
