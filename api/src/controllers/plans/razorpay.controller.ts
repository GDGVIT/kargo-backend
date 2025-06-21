import { Request, Response } from "express";
import Razorpay from "razorpay";
import env from "../../config/env";
import Plan from "../../models/plan.model";
import getUserFromSession from "../../utils/auth/getUserFromSession";
import User from "../../models/user.model";

const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID!,
  key_secret: env.RAZORPAY_KEY_SECRET!,
});

export const createOrder = async (req: Request, res: Response) => {
  try {
    const planId = req.params.id;
    const plan = await Plan.findById(planId);
    if (!plan || !plan.price) {
      console.error("Plan not found or price missing", { planId, plan });
      return res.status(404).json({ error: "Plan not found or price missing" });
    }
    const shortReceipt = `plan_${planId}_${Date.now()
      .toString()
      .slice(-8)}`.slice(0, 40);
    const order = await razorpay.orders.create({
      amount: plan.price, // price in paise
      currency: "INR",
      receipt: shortReceipt, // ensure <= 40 chars
      notes: { planId },
    });
    res.json({ order });
  } catch (err) {
    console.error("Razorpay order creation failed", err);
    res.status(500).json({
      error: "Failed to create order",
      details: err instanceof Error ? err.message : err,
    });
  }
};

export const verifyPayment = async (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;
  const crypto = require("crypto");
  const generated_signature = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET!)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");
  if (generated_signature === razorpay_signature) {
    // Find the Razorpay order to get the planId from notes
    try {
      const order = await razorpay.orders.fetch(razorpay_order_id);
      const planId = order.notes?.planId;
      if (!planId) {
        return res
          .status(400)
          .json({ success: false, error: "Plan ID not found in order notes" });
      }
      // Get user from session
      const user = await getUserFromSession(req);
      if (!user) {
        return res
          .status(401)
          .json({ success: false, error: "User not authenticated" });
      }
      user.plan = planId.toString();
      await user.save();
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Failed to upgrade plan",
        details: err instanceof Error ? err.message : err,
      });
    }
  } else {
    return res.status(400).json({ success: false, error: "Invalid signature" });
  }
};
