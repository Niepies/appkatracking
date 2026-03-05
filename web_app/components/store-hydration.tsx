"use client";

import { useEffect } from "react";
import { use_subscription_store, load_subscriptions, load_history, load_budget } from "@/store/subscription-store";

export function StoreHydration() {
  useEffect(() => {
    const stored_subs = load_subscriptions();
    const stored_history = load_history();
    const stored_budget = load_budget();
    use_subscription_store.setState({
      subscriptions: stored_subs,
      payment_history: stored_history,
      monthly_budget: stored_budget,
    });
  }, []);

  return null;
}


