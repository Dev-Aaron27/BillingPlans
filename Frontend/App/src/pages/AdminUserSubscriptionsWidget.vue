<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Receipt, Server, CalendarClock, ExternalLink } from "lucide-vue-next";
import axios from "axios";

interface Subscription {
  id: number;
  plan_id: number;
  plan_name: string | null;
  price_credits: number | null;
  billing_period_days: number | null;
  server_uuid: string | null;
  status: "active" | "suspended" | "cancelled" | "expired" | "pending";
  next_renewal_at: string | null;
  suspended_at: string | null;
  grace_started_at: string | null;
  cancelled_at: string | null;
  created_at: string | null;
}

function parseUserIdFromSearch(): number | null {
  const raw = new URLSearchParams(window.location.search).get("userId");
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const userId = ref<number | null>(parseUserIdFromSearch());
const loading = ref(true);
const loadError = ref<string | null>(null);
const subscriptions = ref<Subscription[]>([]);
const username = ref<string>("");

const formatDate = (v: string | null) => {
  if (!v) return "—";
  return new Date(v).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const periodLabel = (days: number | null) => {
  if (!days) return "—";
  if (days === 30 || days === 31) return "Monthly";
  if (days === 90) return "Quarterly";
  if (days === 180) return "Semi-annual";
  if (days === 365 || days === 366) return "Yearly";
  return `${days}d`;
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const statusVariant = (s: Subscription["status"]): BadgeVariant => {
  switch (s) {
    case "active": return "default";
    case "suspended": return "secondary";
    case "cancelled": return "destructive";
    case "expired": return "outline";
    default: return "outline";
  }
};

const statusLabel = (s: Subscription["status"]) => {
  return s.charAt(0).toUpperCase() + s.slice(1);
};

async function load() {
  const id = userId.value;
  if (id == null) {
    loading.value = false;
    loadError.value = "No user selected.";
    return;
  }

  loading.value = true;
  loadError.value = null;
  try {
    const res = await axios.get(`/api/admin/billingplans/users/${id}/subscriptions`);
    subscriptions.value = res.data?.data?.subscriptions ?? [];
    username.value = res.data?.data?.user?.username ?? "";
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
    loadError.value = msg ?? "Failed to load subscriptions";
  } finally {
    loading.value = false;
  }
}

onMounted(() => load());
</script>

<template>
  <div class="p-4 md:p-5 text-foreground">
    <div
      v-if="userId == null"
      class="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground"
    >
      {{ loadError || "No user id in widget context." }}
    </div>

    <div v-else-if="loading" class="flex items-center justify-center gap-2 py-16 text-muted-foreground">
      <Loader2 class="h-6 w-6 animate-spin" />
      <span class="text-sm">Loading subscriptions…</span>
    </div>

    <div
      v-else-if="loadError"
      class="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
    >
      {{ loadError }}
    </div>

    <div v-else class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-muted-foreground">
          <Receipt class="h-4 w-4 shrink-0" />
          <span class="text-xs font-semibold uppercase tracking-wide">Billing Plans</span>
          <span class="text-xs text-muted-foreground">({{ subscriptions.length }} subscription{{ subscriptions.length !== 1 ? 's' : '' }})</span>
        </div>
        <a
          href="/admin/billingplans"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-xs hover:bg-accent"
        >
          Open Billing Plans
          <ExternalLink class="h-3.5 w-3.5 opacity-70" />
        </a>
      </div>

      <div
        v-if="subscriptions.length === 0"
        class="rounded-lg border border-dashed border-border/50 py-10 text-center text-sm text-muted-foreground"
      >
        This user has no subscriptions yet.
      </div>

      <div v-else class="space-y-3">
        <Card
          v-for="sub in subscriptions"
          :key="sub.id"
          class="border-border/60 bg-card/40 p-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-2 mb-3">
            <div>
              <p class="font-medium text-sm">{{ sub.plan_name ?? `Plan #${sub.plan_id}` }}</p>
              <p class="text-xs text-muted-foreground">
                #{{ sub.id }}
                <span v-if="sub.price_credits != null"> · {{ sub.price_credits }} credits / {{ periodLabel(sub.billing_period_days) }}</span>
              </p>
            </div>
            <Badge :variant="statusVariant(sub.status)" class="capitalize text-[11px]">
              {{ statusLabel(sub.status) }}
            </Badge>
          </div>

          <div class="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
            <div v-if="sub.server_uuid" class="flex items-center gap-1.5 text-muted-foreground">
              <Server class="h-3.5 w-3.5 shrink-0" />
              <span class="font-mono break-all text-foreground/80">{{ sub.server_uuid }}</span>
            </div>
            <div v-else class="flex items-center gap-1.5 text-muted-foreground">
              <Server class="h-3.5 w-3.5 shrink-0" />
              <span class="italic">No server linked</span>
            </div>

            <div v-if="sub.status === 'active' && sub.next_renewal_at" class="flex items-center gap-1.5 text-muted-foreground">
              <CalendarClock class="h-3.5 w-3.5 shrink-0" />
              <span>Renews {{ formatDate(sub.next_renewal_at) }}</span>
            </div>
            <div v-else-if="sub.status === 'suspended' && sub.suspended_at" class="flex items-center gap-1.5 text-muted-foreground">
              <CalendarClock class="h-3.5 w-3.5 shrink-0" />
              <span>Suspended {{ formatDate(sub.suspended_at) }}</span>
            </div>
            <div v-else-if="sub.status === 'cancelled' && sub.cancelled_at" class="flex items-center gap-1.5 text-muted-foreground">
              <CalendarClock class="h-3.5 w-3.5 shrink-0" />
              <span>Cancelled {{ formatDate(sub.cancelled_at) }}</span>
            </div>
            <div v-else-if="sub.next_renewal_at" class="flex items-center gap-1.5 text-muted-foreground">
              <CalendarClock class="h-3.5 w-3.5 shrink-0" />
              <span>{{ formatDate(sub.next_renewal_at) }}</span>
            </div>
          </div>

          <p class="text-[10px] text-muted-foreground/60 mt-2">
            Created {{ formatDate(sub.created_at) }}
          </p>
        </Card>
      </div>
    </div>
  </div>
</template>
