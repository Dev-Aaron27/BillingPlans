<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useToast } from "vue-toastification";
import {
  Loader2, CreditCard, CalendarClock, PauseCircle, XCircle, Clock,
  ShoppingCart, AlertTriangle, CheckCircle2, Server, HardDrive,
  Cpu, Database, MemoryStick, Shield, Package, Infinity, ChevronDown,
  ChevronUp, CircleDollarSign, ArrowLeft, BarChart3, RefreshCw,
} from "lucide-vue-next";
import { useUserPlansAPI, type Plan } from "@/composables/usePlansAPI";
import { useUserSubscriptionsAPI, type Subscription } from "@/composables/useSubscriptionsAPI";
import { useUserCategoriesAPI, type Category, colorClasses } from "@/composables/useCategoriesAPI";

const toast = useToast();
const { loading: plansLoading, listPlans, subscribeToPlan } = useUserPlansAPI();
const { loading: subsLoading, listSubscriptions, cancelSubscription } = useUserSubscriptionsAPI();
const { listCategories } = useUserCategoriesAPI();

type Tab = "browse" | "my-subscriptions";
type ClientShellView = "main" | "subscribe";
const activeTab = ref<Tab>("browse");
const shellView = ref<ClientShellView>("main");
const plans = ref<Plan[]>([]);
const subscriptions = ref<Subscription[]>([]);
const categories = ref<Category[]>([]);
const activeCategoryId = ref<number | null>(null);
const userCredits = ref(0);


const planToSubscribe = ref<Plan | null>(null);
const serverName = ref("");
const chosenRealmId = ref<number | null>(null);
const chosenSpellId = ref<number | null>(null);
const subscribing = ref(false);
const showCancelConfirm = ref(false);
const subToCancel = ref<Subscription | null>(null);
const expandedPlanId = ref<number | null>(null);
const PERIOD_MAP: Record<number, string> = {
  1: "Daily", 7: "Weekly", 14: "Bi-Weekly", 30: "Monthly",
  90: "Quarterly", 180: "Semi-Annual", 365: "Annual",
};
function getPeriodLabel(days: number) {
  return PERIOD_MAP[days] ?? `Every ${days}d`;
}
function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function daysUntil(dt: string | null) {
  if (!dt) return "";
  const diff = Math.ceil((new Date(dt).getTime() - Date.now()) / 86400000);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}
function fmtMB(mb: number) {
  return mb >= 1024 ? (mb / 1024).toFixed(1).replace(/\.0$/, "") + " GB" : mb + " MB";
}

const loadData = async () => {
  try {
    const [pr, sr, cats] = await Promise.all([listPlans(), listSubscriptions(), listCategories()]);
    plans.value = pr.data;
    userCredits.value = pr.user_credits;
    subscriptions.value = sr.data;
    categories.value = cats;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Failed to load data");
  }
};

const filteredPlans = computed(() => {
  if (activeCategoryId.value === null) return plans.value;
  return plans.value.filter((p) => p.category_id === activeCategoryId.value);
});

const subscribeFilteredSpells = computed(() => {
  const plan = planToSubscribe.value;
  if (!plan?.user_can_choose_spell || !plan.allowed_spells_options?.length) return [];

  const opts = plan.allowed_spells_options;
  let realmId: number | null = null;

  if (plan.user_can_choose_realm) {
    const raw = chosenRealmId.value;
    if (raw == null) return [];
    realmId = Number(raw);
  } else if (plan.realms_id) {
    realmId = Number(plan.realms_id);
  }

  if (realmId === null || Number.isNaN(realmId)) return opts;
  return opts.filter((s) => Number(s.realm_id) === realmId);
});

const canConfirmSubscribe = computed(() => {
  const p = planToSubscribe.value;
  if (!p) return false;
  if (p.user_can_choose_realm && chosenRealmId.value == null) return false;
  if (p.user_can_choose_spell) {
    if (subscribeFilteredSpells.value.length === 0) return false;
    if (chosenSpellId.value == null) return false;
  }
  return true;
});

watch(chosenRealmId, () => {
  const spells = subscribeFilteredSpells.value;
  if (
    chosenSpellId.value !== null &&
    !spells.some((s) => s.id === chosenSpellId.value)
  ) {
    chosenSpellId.value = null;
  }
});

const closeSubscribeFlow = () => {
  shellView.value = "main";
  planToSubscribe.value = null;
  serverName.value = "";
  chosenRealmId.value = null;
  chosenSpellId.value = null;
};

const startSubscribe = (plan: Plan) => {
  if (plan.is_sold_out) {
    toast.error("This plan is sold out.");
    return;
  }
  if (!plan.can_afford) {
    toast.error(`You need ${(plan.price_credits - userCredits.value).toLocaleString()} more credits.`);
    return;
  }
  planToSubscribe.value = plan;
  serverName.value = plan.name;
  chosenRealmId.value = null;
  chosenSpellId.value = null;
  if (plan.user_can_choose_realm && plan.allowed_realms_options?.length === 1) {
    chosenRealmId.value = plan.allowed_realms_options[0].id;
  }
  shellView.value = "subscribe";
};

const executeSubscribe = async () => {
  if (!planToSubscribe.value) return;
  subscribing.value = true;
  try {
    const realmId =
      chosenRealmId.value != null ? Number(chosenRealmId.value) : undefined;
    const spellId =
      chosenSpellId.value != null ? Number(chosenSpellId.value) : undefined;
    const result = await subscribeToPlan(planToSubscribe.value.id, {
      server_name: serverName.value.trim() || undefined,
      chosen_realm_id: realmId,
      chosen_spell_id: spellId,
    });
    userCredits.value = result.new_credits_balance;
    toast.success(`Subscribed to ${planToSubscribe.value.name}!${result.server_uuid ? " Your server is being set up." : ""}`);
    closeSubscribeFlow();
    await loadData();
    activeTab.value = "my-subscriptions";
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Failed to subscribe");
  } finally {
    subscribing.value = false;
  }
};

const confirmCancelSub = (sub: Subscription) => { subToCancel.value = sub; showCancelConfirm.value = true; };
const executeCancelSub = async () => {
  if (!subToCancel.value) return;
  try {
    await cancelSubscription(subToCancel.value.id);
    toast.success("Subscription cancelled.");
    showCancelConfirm.value = false; subToCancel.value = null;
    await loadData();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Failed to cancel subscription");
  }
};

const toggleExpand = (planId: number) => {
  expandedPlanId.value = expandedPlanId.value === planId ? null : planId;
};

const activeSubscriptions = computed(() =>
  subscriptions.value.filter((s) => s.status === "active" || s.status === "suspended")
);
const pastSubscriptions = computed(() =>
  subscriptions.value.filter((s) => s.status === "cancelled" || s.status === "expired")
);
const balanceAfter = computed(() =>
  planToSubscribe.value ? userCredits.value - planToSubscribe.value.price_credits : 0
);

onMounted(loadData);
</script>

<template>
  <div class="w-full h-full overflow-auto min-h-screen">

    <div v-if="shellView === 'subscribe' && planToSubscribe" class="container mx-auto max-w-4xl px-4 md:px-8 py-6">
      <div class="flex items-center gap-3 mb-6">
        <button
          type="button"
          @click="closeSubscribeFlow"
          class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft class="h-4 w-4" />Back to plans
        </button>
        <span class="text-muted-foreground/40">/</span>
        <h1 class="text-base font-semibold text-foreground truncate">Subscribe</h1>
      </div>

      <div class="mb-6">
        <h2 class="text-2xl font-bold tracking-tight text-foreground">{{ planToSubscribe.name }}</h2>
        <p class="text-sm text-muted-foreground mt-0.5">Confirm nest, server type, and name — same layout as the panel admin billing area.</p>
      </div>

      <div class="space-y-5">
        <div v-if="planToSubscribe.has_server_template" class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div class="px-5 py-4 border-b border-border bg-muted/30">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Included resources</p>
          </div>
          <div class="p-5">
            <div class="flex flex-wrap gap-2">
              <span class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <MemoryStick class="h-4 w-4 text-blue-400 shrink-0" />
                <span class="font-semibold text-foreground">{{ fmtMB(planToSubscribe.memory) }}</span>
                <span class="text-xs text-muted-foreground">RAM</span>
              </span>
              <span class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <Cpu class="h-4 w-4 text-emerald-400 shrink-0" />
                <span class="font-semibold text-foreground">{{ planToSubscribe.cpu }}%</span>
                <span class="text-xs text-muted-foreground">CPU</span>
              </span>
              <span class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <HardDrive class="h-4 w-4 text-orange-400 shrink-0" />
                <span class="font-semibold text-foreground">{{ fmtMB(planToSubscribe.disk) }}</span>
                <span class="text-xs text-muted-foreground">Disk</span>
              </span>
              <span v-if="planToSubscribe.backup_limit > 0" class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <Shield class="h-4 w-4 text-cyan-400 shrink-0" />
                <span class="font-semibold text-foreground">{{ planToSubscribe.backup_limit }}</span>
                <span class="text-xs text-muted-foreground">Backups</span>
              </span>
              <span v-if="planToSubscribe.database_limit > 0" class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <Database class="h-4 w-4 text-purple-400 shrink-0" />
                <span class="font-semibold text-foreground">{{ planToSubscribe.database_limit }}</span>
                <span class="text-xs text-muted-foreground">DBs</span>
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="planToSubscribe.user_can_choose_realm && planToSubscribe.allowed_realms_options?.length"
          class="bg-card border border-border rounded-xl shadow-sm p-5 space-y-3"
        >
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">Nest <span class="text-red-400">*</span></label>
            <p class="text-xs text-muted-foreground mb-2">Game category for your server.</p>
            <select
              v-model="chosenRealmId"
              class="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option disabled :value="null">Select a nest…</option>
              <option v-for="r in planToSubscribe.allowed_realms_options" :key="r.id" :value="r.id">
                {{ r.name }}
              </option>
            </select>
          </div>
        </div>

        <div
          v-if="planToSubscribe.user_can_choose_spell && planToSubscribe.allowed_spells_options?.length"
          class="bg-card border border-border rounded-xl shadow-sm p-5 space-y-3"
        >
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">Egg (server type) <span class="text-red-400">*</span></label>
            <p class="text-xs text-muted-foreground mb-2">
              <template v-if="planToSubscribe.user_can_choose_realm && chosenRealmId == null">Select a nest first.</template>
              <template v-else-if="subscribeFilteredSpells.length === 0">No eggs for this nest — ask an admin to allow eggs for this nest.</template>
              <template v-else>Only eggs for your selected nest are listed.</template>
            </p>
            <select
              v-model="chosenSpellId"
              :disabled="subscribeFilteredSpells.length === 0"
              class="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option disabled :value="null">
                {{ subscribeFilteredSpells.length ? "Choose an egg…" : "No eggs for this nest" }}
              </option>
              <option v-for="s in subscribeFilteredSpells" :key="s.id" :value="s.id">
                {{ s.name }}
              </option>
            </select>
          </div>
        </div>

        <div v-if="planToSubscribe.has_server_template" class="bg-card border border-border rounded-xl shadow-sm p-5 space-y-3">
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">Server name</label>
            <input
              v-model="serverName"
              type="text"
              placeholder="e.g. My Minecraft server"
              maxlength="100"
              class="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p class="text-xs text-muted-foreground mt-1.5">Shown in your server list.</p>
          </div>
        </div>

        <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div class="px-5 py-4 border-b border-border bg-muted/30">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment</p>
          </div>
          <div class="divide-y divide-border">
            <div class="flex justify-between items-center px-5 py-3 gap-4 text-sm">
              <span class="text-muted-foreground">Billing cycle</span>
              <span class="font-medium text-foreground">{{ getPeriodLabel(planToSubscribe.billing_period_days) }}</span>
            </div>
            <div class="flex justify-between items-center px-5 py-3 gap-4 text-sm">
              <span class="text-muted-foreground">Due now</span>
              <span class="text-base font-bold text-foreground tabular-nums">
                {{ planToSubscribe.price_credits.toLocaleString() }} <span class="text-sm font-normal text-muted-foreground">credits</span>
              </span>
            </div>
            <div class="flex justify-between items-center px-5 py-3 gap-4 text-sm bg-muted/20">
              <span class="text-muted-foreground">Balance after</span>
              <span
                :class="[
                  'font-semibold tabular-nums',
                  balanceAfter < 0 ? 'text-red-400' : 'text-emerald-400',
                ]"
              >
                {{ balanceAfter.toLocaleString() }} credits
              </span>
            </div>
          </div>
        </div>

        <p class="text-xs text-muted-foreground leading-relaxed px-0.5">
          Renews every {{ getPeriodLabel(planToSubscribe.billing_period_days).toLowerCase() }}. If you lack credits at renewal, your subscription may be suspended per host policy.
        </p>
      </div>

      <div class="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-border">
        <button
          type="button"
          @click="closeSubscribeFlow"
          class="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          @click="executeSubscribe"
          :disabled="subscribing || !canConfirmSubscribe"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors shadow-sm"
        >
          <Loader2 v-if="subscribing" class="h-4 w-4 animate-spin" />
          <ShoppingCart v-else class="h-4 w-4" />
          Confirm and pay
        </button>
      </div>
    </div>

    <div v-else class="container mx-auto max-w-7xl px-4 md:px-8 py-6">

      <div class="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
            <CreditCard class="h-6 w-6 text-primary" />Billing Plans
          </h1>
          <p class="text-sm text-muted-foreground mt-0.5">Subscribe to server plans billed in credits — same look as the admin billing tools.</p>
        </div>
        <button
          type="button"
          @click="loadData"
          class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          <Loader2 v-if="plansLoading || subsLoading" class="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <RefreshCw v-else class="h-3.5 w-3.5 text-muted-foreground" />
          Refresh
        </button>
      </div>

      
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div class="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Balance</p>
            <div class="bg-primary/10 rounded-lg p-1.5"><CreditCard class="h-3.5 w-3.5 text-primary" /></div>
          </div>
          <p class="text-2xl font-bold text-foreground tabular-nums">{{ userCredits.toLocaleString() }}</p>
          <p class="text-xs text-muted-foreground mt-0.5">credits available</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active</p>
            <div class="bg-emerald-500/10 rounded-lg p-1.5"><CheckCircle2 class="h-3.5 w-3.5 text-emerald-500" /></div>
          </div>
          <p class="text-2xl font-bold text-foreground">{{ activeSubscriptions.length }}</p>
          <p class="text-xs text-muted-foreground mt-0.5">subscriptions</p>
        </div>
        <div class="hidden sm:block bg-card border border-border rounded-xl p-4 shadow-sm col-span-2 sm:col-span-1">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Plans</p>
            <div class="bg-blue-500/10 rounded-lg p-1.5"><BarChart3 class="h-3.5 w-3.5 text-blue-500" /></div>
          </div>
          <p class="text-2xl font-bold text-foreground">{{ plans.length }}</p>
          <p class="text-xs text-muted-foreground mt-0.5">available to you</p>
        </div>
      </div>

      
      <div class="flex gap-1 mb-5 bg-muted/50 rounded-xl p-1 w-fit flex-wrap">
        <button
          type="button"
          @click="activeTab = 'browse'"
          :class="['inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all', activeTab === 'browse' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground']"
        >
          <ShoppingCart class="h-4 w-4" />Browse plans
        </button>
        <button
          type="button"
          @click="activeTab = 'my-subscriptions'"
          :class="['inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all', activeTab === 'my-subscriptions' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground']"
        >
          <Clock class="h-4 w-4" />My subscriptions
          <span
            v-if="activeSubscriptions.length > 0"
            class="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
          >
            {{ activeSubscriptions.length }}
          </span>
        </button>
      </div>

      
      <div v-if="activeTab === 'browse'">
        
        <div v-if="categories.length > 0" class="flex gap-2 mb-5 flex-wrap">
          <button
            @click="activeCategoryId = null"
            :class="['inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all',
              activeCategoryId === null ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30']">
            All <span class="opacity-60 text-xs">({{ plans.length }})</span>
          </button>
          <button
            v-for="cat in categories" :key="cat.id"
            @click="activeCategoryId = cat.id"
            :class="['inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all',
              colorClasses(cat.color, activeCategoryId === cat.id)]">
            <span v-if="cat.icon" class="text-base leading-none">{{ cat.icon }}</span>
            {{ cat.name }}
            <span class="opacity-60 text-xs">({{ cat.plan_count }})</span>
          </button>
        </div>

        <div v-if="plansLoading" class="flex justify-center py-20">
          <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>

        <div v-else-if="filteredPlans.length === 0" class="text-center py-20 bg-card border border-border rounded-xl">
          <CreditCard class="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p class="text-muted-foreground">{{ activeCategoryId ? 'No plans in this category.' : 'No plans are currently available.' }}</p>
          <button v-if="activeCategoryId" @click="activeCategoryId = null" class="mt-3 text-sm text-primary hover:underline">Show all plans</button>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <div
            v-for="plan in filteredPlans" :key="plan.id"
            class="bg-card border border-border rounded-xl shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-md"
            :class="{
              'border-primary/50 shadow-primary/10': !plan.is_sold_out && plan.can_afford,
              'opacity-60': plan.is_sold_out,
            }"
          >
            
            <div class="p-5 flex-1">
              
              <div v-if="plan.category" class="mb-2">
                <span :class="['inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium', colorClasses(plan.category.color)]">
                  <span v-if="plan.category.icon">{{ plan.category.icon }}</span>
                  {{ plan.category.name }}
                </span>
              </div>
              <div class="flex items-start justify-between gap-2 mb-1">
                <h3 class="font-semibold text-base text-foreground leading-tight">{{ plan.name }}</h3>
                <span v-if="plan.is_sold_out"
                  class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                  Sold Out
                </span>
                <span v-else-if="plan.slots_available != null && plan.slots_available <= 5"
                  class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  {{ plan.slots_available }} left
                </span>
              </div>

              <p v-if="plan.description" class="text-sm text-muted-foreground mb-3 leading-relaxed">
                {{ plan.description }}
              </p>

              
              <div class="bg-muted/40 rounded-lg p-4 mb-4 text-center">
                <div class="flex items-baseline justify-center gap-1.5">
                  <span class="text-3xl font-bold text-foreground">{{ plan.price_credits.toLocaleString() }}</span>
                  <span class="text-muted-foreground text-sm">credits</span>
                </div>
                <div class="flex items-center justify-center gap-1.5 mt-1 text-muted-foreground text-xs">
                  <CalendarClock class="h-3.5 w-3.5" />
                  <span>Billed {{ getPeriodLabel(plan.billing_period_days) }}</span>
                </div>
              </div>

              
              <div v-if="plan.has_server_template" class="space-y-1.5 mb-3">
                <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">What you get</p>
                <div class="grid grid-cols-2 gap-1.5">
                  <div class="flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-2">
                    <MemoryStick class="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <div>
                      <p class="text-xs font-medium text-foreground">{{ fmtMB(plan.memory) }}</p>
                      <p class="text-[10px] text-muted-foreground">RAM</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-2">
                    <Cpu class="h-3.5 w-3.5 text-green-400 shrink-0" />
                    <div>
                      <p class="text-xs font-medium text-foreground">{{ plan.cpu }}%</p>
                      <p class="text-[10px] text-muted-foreground">CPU</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-2">
                    <HardDrive class="h-3.5 w-3.5 text-orange-400 shrink-0" />
                    <div>
                      <p class="text-xs font-medium text-foreground">{{ fmtMB(plan.disk) }}</p>
                      <p class="text-[10px] text-muted-foreground">Storage</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-2">
                    <Database class="h-3.5 w-3.5 text-purple-400 shrink-0" />
                    <div>
                      <p class="text-xs font-medium text-foreground">{{ plan.database_limit }}</p>
                      <p class="text-[10px] text-muted-foreground">Databases</p>
                    </div>
                  </div>
                </div>

                
                <button @click="toggleExpand(plan.id)"
                  class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1">
                  <ChevronDown v-if="expandedPlanId !== plan.id" class="h-3.5 w-3.5" />
                  <ChevronUp v-else class="h-3.5 w-3.5" />
                  {{ expandedPlanId === plan.id ? 'Less details' : 'More details' }}
                </button>

                
                <div v-if="expandedPlanId === plan.id" class="grid grid-cols-2 gap-1.5 mt-1">
                  <div class="flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-2">
                    <Shield class="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    <div>
                      <p class="text-xs font-medium text-foreground">{{ plan.backup_limit }}</p>
                      <p class="text-[10px] text-muted-foreground">Backups</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-2">
                    <Package class="h-3.5 w-3.5 text-pink-400 shrink-0" />
                    <div>
                      <p class="text-xs font-medium text-foreground">
                        <span v-if="plan.allocation_limit">{{ plan.allocation_limit }}</span>
                        <Infinity v-else class="h-3 w-3 inline" />
                      </p>
                      <p class="text-[10px] text-muted-foreground">Ports</p>
                    </div>
                  </div>
                </div>

                
                <div v-if="expandedPlanId === plan.id && plan.long_description"
                  class="mt-2 text-xs text-muted-foreground bg-muted/20 rounded-lg p-3 leading-relaxed whitespace-pre-line">
                  {{ plan.long_description }}
                </div>
              </div>

              
              <div v-else class="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2 mb-3">
                <Server class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p class="text-xs text-muted-foreground">Subscription only — no server auto-provisioned</p>
              </div>

              
              <div v-if="!plan.can_afford && !plan.is_sold_out"
                class="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2 mb-3">
                <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
                <span>Need {{ (plan.price_credits - userCredits).toLocaleString() }} more credits</span>
              </div>
            </div>

            
            <div class="px-5 pb-5">
              <button
                @click="startSubscribe(plan)"
                :disabled="!plan.can_afford || !!plan.is_sold_out"
                :class="[
                  'w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                  plan.can_afford && !plan.is_sold_out
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                    : 'bg-muted text-muted-foreground cursor-not-allowed',
                ]"
              >
                <ShoppingCart class="h-4 w-4" />
                {{ plan.is_sold_out ? 'Sold Out' : !plan.can_afford ? 'Insufficient Credits' : 'Subscribe Now' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      
      <div v-if="activeTab === 'my-subscriptions'">
        <div v-if="subsLoading" class="flex justify-center py-20">
          <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>

        <div v-else-if="subscriptions.length === 0" class="text-center py-20 bg-card border border-border rounded-xl">
          <Clock class="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p class="font-medium text-muted-foreground">No subscriptions yet</p>
          <button @click="activeTab = 'browse'"
            class="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <ShoppingCart class="h-4 w-4" />Browse Plans
          </button>
        </div>

        <div v-else class="space-y-6">

          
          <div v-if="activeSubscriptions.length > 0">
            <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Active Subscriptions</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="sub in activeSubscriptions" :key="sub.id"
                class="bg-card border rounded-xl shadow-sm overflow-hidden"
                :class="sub.status === 'suspended' ? 'border-amber-500/40' : 'border-emerald-500/20'"
              >
                <div class="p-5">
                  <div class="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 class="font-semibold text-foreground">{{ sub.plan_name }}</h3>
                      <p v-if="sub.plan_description" class="text-xs text-muted-foreground mt-0.5">{{ sub.plan_description }}</p>
                    </div>
                    <span :class="['shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border', sub.status === 'active' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30']">
                      {{ sub.status.charAt(0).toUpperCase() + sub.status.slice(1) }}
                    </span>
                  </div>

                  <div class="grid grid-cols-2 gap-2 mb-3">
                    <div class="bg-muted/30 rounded-lg px-3 py-2">
                      <p class="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Cost</p>
                      <p class="text-sm font-semibold text-foreground">{{ sub.price_credits.toLocaleString() }} <span class="text-xs font-normal text-muted-foreground">cr</span></p>
                      <p class="text-[10px] text-muted-foreground">per {{ getPeriodLabel(sub.billing_period_days).toLowerCase() }}</p>
                    </div>
                    <div class="bg-muted/30 rounded-lg px-3 py-2">
                      <p class="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Next Renewal</p>
                      <p class="text-xs font-semibold text-foreground">{{ daysUntil(sub.next_renewal_at) }}</p>
                      <p class="text-[10px] text-muted-foreground">{{ formatDate(sub.next_renewal_at) }}</p>
                    </div>
                  </div>

                  
                  <div v-if="sub.server_uuid" class="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2 mb-3">
                    <Server class="h-3.5 w-3.5 text-primary shrink-0" />
                    <div class="min-w-0">
                      <p class="text-[10px] text-muted-foreground uppercase tracking-wide">Server</p>
                      <p class="text-xs font-mono text-muted-foreground truncate">{{ sub.server_uuid }}</p>
                    </div>
                    <CheckCircle2 class="h-3.5 w-3.5 text-emerald-400 shrink-0 ml-auto" />
                  </div>

                  <div
                    v-if="Number(sub.admin_credits_refunded_total ?? 0) > 0"
                    class="flex items-start gap-2 text-xs text-violet-700 dark:text-violet-300 bg-violet-500/10 rounded-lg px-3 py-2 mb-3 border border-violet-500/20"
                  >
                    <CircleDollarSign class="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Staff added <strong>{{ Number(sub.admin_credits_refunded_total ?? 0).toLocaleString() }} cr</strong> to your balance for this subscription
                      <span v-if="sub.admin_refunded_at"> (latest {{ formatDate(sub.admin_refunded_at) }})</span>.
                    </span>
                  </div>

                  
                  <div v-if="sub.status === 'suspended'"
                    class="flex items-start gap-2 text-xs text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2 mb-3">
                    <PauseCircle class="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>Suspended — insufficient credits at renewal. Top up your balance and your server will be restored at the next billing cycle.</span>
                  </div>

                  <button
                    v-if="sub.status === 'active'"
                    @click="confirmCancelSub(sub)"
                    class="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/15 transition-colors"
                  >
                    <XCircle class="h-3.5 w-3.5" />Cancel Subscription
                  </button>
                </div>
              </div>
            </div>
          </div>

          
          <div v-if="pastSubscriptions.length > 0">
            <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Past Subscriptions</h2>
            <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-border bg-muted/40">
                    <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Plan</th>
                    <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Cost</th>
                    <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                    <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">Ended</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border opacity-70">
                  <tr v-for="sub in pastSubscriptions" :key="sub.id" class="hover:opacity-90 transition-opacity">
                    <td class="px-4 py-3 font-medium">
                      {{ sub.plan_name }}
                      <span
                        v-if="Number(sub.admin_credits_refunded_total ?? 0) > 0"
                        class="mt-1 flex items-center gap-1 text-[10px] font-normal text-violet-600 dark:text-violet-400"
                      >
                        <CircleDollarSign class="h-3 w-3 shrink-0" />
                        +{{ Number(sub.admin_credits_refunded_total ?? 0).toLocaleString() }} cr from staff
                      </span>
                    </td>
                    <td class="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">{{ sub.price_credits.toLocaleString() }} cr / {{ getPeriodLabel(sub.billing_period_days) }}</td>
                    <td class="px-4 py-3">
                      <span class="inline-flex px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400 border border-red-500/30">
                        {{ sub.status.charAt(0).toUpperCase() + sub.status.slice(1) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                      {{ formatDate(sub.cancelled_at ?? sub.created_at) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

    </div>

    
    <Teleport to="body">
      <div v-if="showCancelConfirm && subToCancel" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" @click.self="showCancelConfirm = false">
        <div class="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm">
          <div class="px-6 py-4 border-b border-border"><h2 class="text-base font-semibold">Cancel Subscription?</h2></div>
          <div class="p-6">
            <p class="text-sm text-muted-foreground mb-5">
              Cancel your <strong class="text-foreground">{{ subToCancel.plan_name }}</strong> subscription?
              No refund will be issued.
              <span v-if="subToCancel.server_uuid" class="block mt-2 text-amber-500">
                Your server will be suspended when the subscription ends.
              </span>
            </p>
            <div class="flex gap-3">
              <button @click="showCancelConfirm = false" class="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Keep It</button>
              <button @click="executeCancelSub" :disabled="subsLoading"
                class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60 transition-colors">
                <Loader2 v-if="subsLoading" class="h-4 w-4 animate-spin" />Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>
