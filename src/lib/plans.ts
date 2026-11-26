import { PlanTier } from "@prisma/client";

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  priceLabel: string;
  tagline: string;
  maxParticipants: number;
  maxZipMb: number;
  allowPasscode: boolean;
  allowSafeMode: boolean;
  allowFeedbackExport: boolean;
  allowAllowlist: boolean;
  allowPersonalInvites: boolean;
  allowPdfSlides: boolean;
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  FREE: {
    tier: "FREE",
    name: "Free",
    priceLabel: "$0",
    tagline: "Core isolated site sharing & live video for quick demos.",
    maxParticipants: 10,
    maxZipMb: 10,
    allowPasscode: false,
    allowSafeMode: false,
    allowFeedbackExport: false,
    allowAllowlist: false,
    allowPersonalInvites: false,
    allowPdfSlides: true
  },
  PLUS: {
    tier: "PLUS",
    name: "Plus",
    priceLabel: "$12/mo",
    tagline: "Built for teachers, freelancers, and live interactive classes.",
    maxParticipants: 30,
    maxZipMb: 25,
    allowPasscode: true,
    allowSafeMode: true,
    allowFeedbackExport: true,
    allowAllowlist: false,
    allowPersonalInvites: false,
    allowPdfSlides: true
  },
  PRO: {
    tier: "PRO",
    name: "Pro",
    priceLabel: "$29/mo",
    tagline: "Verified anti-raid class security, personal links & agency workflows.",
    maxParticipants: 100,
    maxZipMb: 25,
    allowPasscode: true,
    allowSafeMode: true,
    allowFeedbackExport: true,
    allowAllowlist: true,
    allowPersonalInvites: true,
    allowPdfSlides: true
  }
};

export function getPlanConfig(tier?: PlanTier | null): PlanConfig {
  if (!tier || !(tier in PLAN_CONFIGS)) {
    return PLAN_CONFIGS.FREE;
  }
  return PLAN_CONFIGS[tier];
}
