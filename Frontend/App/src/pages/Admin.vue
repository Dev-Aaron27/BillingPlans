<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useToast } from "vue-toastification";
import {
  Loader2, Plus, Pencil, Trash2, CreditCard, Users,
  CheckCircle2, PauseCircle, XCircle, RefreshCw, Save, Settings,
  ShieldAlert, BarChart3, ToggleLeft, ToggleRight, ServerOff, Server, FileText,
  Mail, Clock, ChevronDown, ArrowLeft,
  Package, Infinity, FolderOpen, Tag, ExternalLink, CircleDollarSign,
} from "lucide-vue-next";
import {
  useAdminPlansAPI, type Plan, type PlanFormData, type PlanOptions,
} from "@/composables/usePlansAPI";
import {
  useAdminSubscriptionsAPI, type Subscription,
} from "@/composables/useSubscriptionsAPI";
import {
  useSettingsAPI, type BillingPlanSettings,
} from "@/composables/useSettingsAPI";
import {
  useAdminCategoriesAPI, type Category, type CategoryFormData,
  CATEGORY_COLORS, colorClasses,
} from "@/composables/useCategoriesAPI";

const toast = useToast();
const {
  loading: plansLoading, listPlans, createPlan, updatePlan, deletePlan, getOptions,
} = useAdminPlansAPI();
const {
  loading: subsLoading, listSubscriptions, getStats, cancelSubscription, refundSubscription,
} = useAdminSubscriptionsAPI();
const { loading: settingsLoading, getSettings, updateSettings } = useSettingsAPI();
const {
  loading: catsLoading, listCategories, createCategory, updateCategory, deleteCategory,
} = useAdminCategoriesAPI();


type Tab = "plans" | "categories" | "subscriptions" | "settings";
type View = "list" | "editor";

const activeTab = ref<Tab>("plans");
const currentView = ref<View>("list");
const editingPlan = ref<Plan | null>(null);


const categories = ref<Category[]>([]);
const catsTotalPages = ref(1);
const catsPage = ref(1);
const catsSearch = ref("");
const editingCategory = ref<Category | null>(null);
const showCatModal = ref(false);
const showDeleteCatConfirm = ref(false);
const catToDelete = ref<Category | null>(null);
const emptyCatForm = (): CategoryFormData => ({
  name: "", description: null, icon: null, color: "blue", sort_order: 0, is_active: true,
});
const catForm = ref<CategoryFormData>(emptyCatForm());

const plans = ref<Plan[]>([]);
const subscriptions = ref<Subscription[]>([]);
const stats = ref<{
  subscriptions: Record<string, number>;
  total_plans: number;
  active_plans: number;
  admin_refunds?: { total_credits_refunded: number; subscriptions_with_refunds: number };
} | null>(null);
const settings = ref<BillingPlanSettings | null>(null);
const settingsForm = ref<BillingPlanSettings>({
  suspend_servers: true, unsuspend_on_renewal: true, grace_period_days: 0,
  termination_days: 0, send_suspension_email: true, send_termination_email: true,
  allow_user_cancellation: true, generate_invoices: true,
});
const planOptions = ref<PlanOptions>({ nodes: [], realms: [], spells: [], categories: [] });


const plansPage = ref(1);
const plansTotalPages = ref(1);
const plansSearch = ref("");
const subsPage = ref(1);
const subsTotalPages = ref(1);
const subsSearch = ref("");
const subsStatusFilter = ref("");


const showDeleteConfirm = ref(false);
const planToDelete = ref<Plan | null>(null);
const showCancelSubConfirm = ref(false);
const subToCancel = ref<Subscription | null>(null);
const showRefundSubConfirm = ref(false);
const subToRefund = ref<Subscription | null>(null);
const refundCreditsInput = ref(1);

const PRESET_PERIODS = [
  { label: "Daily", days: 1 }, { label: "Weekly", days: 7 },
  { label: "Bi-Weekly", days: 14 }, { label: "Monthly", days: 30 },
  { label: "Quarterly", days: 90 }, { label: "Semi-Annual", days: 180 },
  { label: "Annual", days: 365 },
];

const emptyForm = (): PlanFormData => ({
  category_id: null,
  name: "", description: null, long_description: null,
  price_credits: 0, billing_period_days: 30, is_active: true, max_subscriptions: null,
  node_ids: [], realms_id: null, spell_id: null,
  memory: 512, cpu: 100, disk: 1024, swap: 0, io: 500,
  backup_limit: 0, database_limit: 0, allocation_limit: null,
  startup_override: null, image_override: null,
  user_can_choose_realm: false, allowed_realms: [],
  user_can_choose_spell: false, allowed_spells: [],
});
const planForm = ref<PlanFormData>(emptyForm());

const filteredSpells = computed(() =>
  planForm.value.realms_id
    ? planOptions.value.spells.filter((s) => s.realm_id === planForm.value.realms_id)
    : planOptions.value.spells
);


const allowedSpellsPool = computed(() =>
  planForm.value.realms_id
    ? planOptions.value.spells.filter((s) => s.realm_id === planForm.value.realms_id)
    : planOptions.value.spells
);

function toggleAllowedId(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((v) => v !== id) : [...list, id];
}

function getPeriodLabel(days: number) {
  return PRESET_PERIODS.find((p) => p.days === days)?.label ?? `${days}d`;
}
function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function openAdminPath(path: string) {
  const target = window.top ?? window;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  target.location.assign(normalized);
}

function statusBadgeClass(status: string) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    suspended: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    cancelled: "bg-red-500/20 text-red-400 border border-red-500/30",
    expired: "bg-red-500/20 text-red-400 border border-red-500/30",
    pending: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  };
  return map[status] ?? "bg-muted text-muted-foreground border border-border";
}

const loadPlans = async () => {
  try {
    const r = await listPlans(plansPage.value, 20, plansSearch.value);
    plans.value = r.data; plansTotalPages.value = r.total_pages;
  } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load plans"); }
};
const loadSubscriptions = async () => {
  try {
    const r = await listSubscriptions(subsPage.value, 20, subsStatusFilter.value, subsSearch.value);
    subscriptions.value = r.data; subsTotalPages.value = r.total_pages;
  } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load subscriptions"); }
};
const loadStats = async () => {
  try { stats.value = await getStats(); } catch {  }
};
const loadOptions = async () => {
  try { planOptions.value = await getOptions(); } catch {  }
};
const loadCategories = async () => {
  try {
    const r = await listCategories(catsPage.value, 50, catsSearch.value);
    categories.value = r.data; catsTotalPages.value = r.total_pages;
  } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load categories"); }
};

const openCatModal = (cat?: Category) => {
  editingCategory.value = cat ?? null;
  catForm.value = cat
    ? { name: cat.name, description: cat.description, icon: cat.icon, color: cat.color, sort_order: cat.sort_order, is_active: cat.is_active }
    : emptyCatForm();
  showCatModal.value = true;
};
const saveCat = async () => {
  try {
    if (editingCategory.value) {
      await updateCategory(editingCategory.value.id, catForm.value);
      toast.success("Category updated!");
    } else {
      await createCategory(catForm.value);
      toast.success("Category created!");
    }
    showCatModal.value = false;
    await Promise.all([loadCategories(), loadOptions()]);
  } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save category"); }
};
const confirmDeleteCat = (cat: Category) => { catToDelete.value = cat; showDeleteCatConfirm.value = true; };
const executeDeleteCat = async () => {
  if (!catToDelete.value) return;
  try {
    await deleteCategory(catToDelete.value.id);
    toast.success("Category deleted.");
    showDeleteCatConfirm.value = false; catToDelete.value = null;
    await Promise.all([loadCategories(), loadOptions(), loadPlans()]);
  } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to delete category"); }
};
const loadSettings = async () => {
  try {
    const s = await getSettings(); settings.value = s; settingsForm.value = { ...s };
  } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load settings"); }
};
const saveSettings = async () => {
  try {
    const u = await updateSettings(settingsForm.value); settings.value = u; settingsForm.value = { ...u };
    toast.success("Settings saved!");
  } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save settings"); }
};

const openCreate = () => {
  editingPlan.value = null;
  planForm.value = emptyForm();
  currentView.value = "editor";
};
const openEdit = (plan: Plan) => {
  editingPlan.value = plan;
  planForm.value = {
    category_id: plan.category_id ?? null,
    name: plan.name, description: plan.description, long_description: plan.long_description,
    price_credits: plan.price_credits, billing_period_days: plan.billing_period_days,
    is_active: !!plan.is_active, max_subscriptions: plan.max_subscriptions,
    node_ids: Array.isArray(plan.node_ids)
      ? [...plan.node_ids]
      : typeof plan.node_ids === 'string'
        ? JSON.parse(plan.node_ids)
        : (plan.node_id != null ? [plan.node_id] : []),
    realms_id: plan.realms_id, spell_id: plan.spell_id,
    memory: plan.memory ?? 512, cpu: plan.cpu ?? 100, disk: plan.disk ?? 1024,
    swap: plan.swap ?? 0, io: plan.io ?? 500, backup_limit: plan.backup_limit ?? 0,
    database_limit: plan.database_limit ?? 0, allocation_limit: plan.allocation_limit,
    startup_override: plan.startup_override, image_override: plan.image_override,
    user_can_choose_realm: plan.user_can_choose_realm ?? false,
    allowed_realms: Array.isArray(plan.allowed_realms) ? plan.allowed_realms : [],
    user_can_choose_spell: plan.user_can_choose_spell ?? false,
    allowed_spells: Array.isArray(plan.allowed_spells) ? plan.allowed_spells : [],
  };
  currentView.value = "editor";
};
const cancelEditor = () => { currentView.value = "list"; };

const onRealmChange = () => {
  if (planForm.value.spell_id) {
    const spell = planOptions.value.spells.find((s) => s.id === planForm.value.spell_id);
    if (!spell || spell.realm_id !== planForm.value.realms_id) {
      planForm.value.spell_id = null;
      planForm.value.startup_override = null;
      planForm.value.image_override = null;
    }
  }
};
const onSpellChange = () => {
  const spell = planOptions.value.spells.find((s) => s.id === planForm.value.spell_id);
  if (spell) {
    if (!planForm.value.startup_override) planForm.value.startup_override = spell.startup ?? null;
    if (!planForm.value.image_override) planForm.value.image_override = spell.docker_image ?? null;
  }
};

const savePlan = async () => {
  try {
    const payload = { ...planForm.value };
    if (editingPlan.value) {
      await updatePlan(editingPlan.value.id, payload);
      toast.success("Plan updated!");
    } else {
      await createPlan(payload);
      toast.success("Plan created!");
    }
    currentView.value = "list";
    await loadPlans(); await loadStats();
  } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save plan"); }
};

const confirmDelete = (plan: Plan) => { planToDelete.value = plan; showDeleteConfirm.value = true; };
const executeDelete = async () => {
  if (!planToDelete.value) return;
  try {
    await deletePlan(planToDelete.value.id);
    toast.success("Plan deleted!"); showDeleteConfirm.value = false; planToDelete.value = null;
    await loadPlans(); await loadStats();
  } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to delete plan"); }
};
const confirmCancelSub = (sub: Subscription) => { subToCancel.value = sub; showCancelSubConfirm.value = true; };
const executeCancelSub = async () => {
  if (!subToCancel.value) return;
  try {
    await cancelSubscription(subToCancel.value.id);
    toast.success("Subscription cancelled!"); showCancelSubConfirm.value = false; subToCancel.value = null;
    await loadSubscriptions(); await loadStats();
  } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to cancel subscription"); }
};

const confirmRefundSub = (sub: Subscription) => {
  subToRefund.value = sub;
  refundCreditsInput.value = Math.max(1, Number(sub.price_credits) || 1);
  showRefundSubConfirm.value = true;
};
const executeRefundSub = async () => {
  if (!subToRefund.value) return;
  const amt = Math.floor(Number(refundCreditsInput.value));
  if (!Number.isFinite(amt) || amt < 1) {
    toast.error("Enter a valid credit amount (at least 1).");
    return;
  }
  try {
    const r = await refundSubscription(subToRefund.value.id, amt);
    toast.success(
      `Refunded ${r.credits_refunded.toLocaleString()} credits. User balance: ${r.user_credits_balance.toLocaleString()}. ` +
        `Running total on this subscription: ${r.admin_credits_refunded_total.toLocaleString()} cr.`
    );
    showRefundSubConfirm.value = false;
    subToRefund.value = null;
    await loadSubscriptions();
  } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to refund"); }
};

const totalSubscriptions = computed(() => {
  if (!stats.value) return 0;
  return Object.values(stats.value.subscriptions).reduce((a, b) => a + b, 0);
});
const editorTitle = computed(() => editingPlan.value ? `Edit — ${editingPlan.value.name}` : "New Plan");

onMounted(() => Promise.all([loadPlans(), loadSubscriptions(), loadStats(), loadSettings(), loadOptions(), loadCategories()]));
</script>

<template>
  <div class="w-full h-full overflow-auto min-h-screen">

    
    <div v-if="activeTab === 'plans' && currentView === 'editor'" class="container mx-auto max-w-4xl px-4 md:px-8 py-6">
      
      <div class="flex items-center gap-3 mb-6">
        <button @click="cancelEditor" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft class="h-4 w-4" />Back to Plans
        </button>
        <span class="text-muted-foreground/40">/</span>
        <h1 class="text-base font-semibold text-foreground">{{ editorTitle }}</h1>
      </div>

      <form @submit.prevent="savePlan" class="space-y-5">

        
        <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div class="px-5 py-3 border-b border-border bg-muted/30">
            <h3 class="text-sm font-semibold text-foreground">Plan Details</h3>
          </div>
          <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="block text-sm font-medium mb-1.5">Plan Name <span class="text-red-400">*</span></label>
              <input v-model="planForm.name" required placeholder="e.g. Starter Minecraft Server"
                class="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            
            <div class="md:col-span-2">
              <label class="block text-sm font-medium mb-1.5 flex items-center gap-1.5"><Tag class="h-3.5 w-3.5 text-muted-foreground" />Category</label>
              <div class="relative">
                <select v-model.number="planForm.category_id"
                  class="flex h-9 w-full rounded-lg border border-input bg-background pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none">
                  <option :value="null">— No category —</option>
                  <option v-for="c in planOptions.categories" :key="c.id" :value="c.id">
                    {{ c.icon ? c.icon + ' ' : '' }}{{ c.name }}
                  </option>
                </select>
                <ChevronDown class="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              <p v-if="!planOptions.categories.length" class="text-xs text-muted-foreground mt-1">
                No categories yet — <button type="button" @click="activeTab = 'categories'" class="text-primary hover:underline">create one first</button>.
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium mb-1.5">Price (credits) <span class="text-red-400">*</span></label>
              <input v-model.number="planForm.price_credits" type="number" min="0" required
                class="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1.5">Billing Period</label>
              <div class="relative">
                <select v-model.number="planForm.billing_period_days"
                  class="flex h-9 w-full rounded-lg border border-input bg-background pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none">
                  <option v-for="p in PRESET_PERIODS" :key="p.days" :value="p.days">{{ p.label }} ({{ p.days }}d)</option>
                  <option v-if="!PRESET_PERIODS.find((p) => p.days === planForm.billing_period_days)" :value="planForm.billing_period_days">Custom ({{ planForm.billing_period_days }}d)</option>
                </select>
                <ChevronDown class="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Package class="h-3.5 w-3.5 text-muted-foreground" />Stock Limit
              </label>
              <input v-model.number="planForm.max_subscriptions" type="number" min="1" placeholder="Leave blank for unlimited"
                class="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <p class="text-xs text-muted-foreground mt-1">Max concurrent active subscriptions. Leave blank for no limit.</p>
            </div>

            <div class="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
              <div><p class="text-sm font-medium">Plan Active</p><p class="text-xs text-muted-foreground">Inactive = hidden from users</p></div>
              <button type="button" @click="planForm.is_active = !planForm.is_active" class="shrink-0">
                <ToggleRight v-if="planForm.is_active" class="h-8 w-8 text-primary" />
                <ToggleLeft v-else class="h-8 w-8 text-muted-foreground" />
              </button>
            </div>

            <div class="md:col-span-2">
              <label class="block text-sm font-medium mb-1.5">Short Description <span class="text-muted-foreground font-normal">(shown in plan cards)</span></label>
              <input v-model="planForm.description" placeholder="A brief one-line summary..."
                class="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div class="md:col-span-2">
              <label class="block text-sm font-medium mb-1.5">Full Description <span class="text-muted-foreground font-normal">(shown on detail page)</span></label>
              <textarea v-model="planForm.long_description" rows="4" placeholder="Detailed description of what's included — features, limits, notes..."
                class="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
          </div>
        </div>

        
        <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div class="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-foreground flex items-center gap-2"><Server class="h-4 w-4 text-primary" />Server Template</h3>
              <p class="text-xs text-muted-foreground mt-0.5">Automatically provision a server when a user subscribes</p>
            </div>
            <span v-if="!planForm.spell_id" class="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">No template</span>
            <span v-else class="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">Configured</span>
          </div>
          <div class="p-5 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Nest (Realm)</label>
                <div class="relative">
                  <select v-model.number="planForm.realms_id" @change="onRealmChange"
                    class="flex h-9 w-full rounded-lg border border-input bg-background pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none">
                    <option :value="null">— None —</option>
                    <option v-for="r in planOptions.realms" :key="r.id" :value="r.id">{{ r.name }}</option>
                  </select>
                  <ChevronDown class="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Egg (Spell)</label>
                <div class="relative">
                  <select v-model.number="planForm.spell_id" @change="onSpellChange" :disabled="!planForm.realms_id"
                    class="flex h-9 w-full rounded-lg border border-input bg-background pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none disabled:opacity-50 disabled:cursor-not-allowed">
                    <option :value="null">— Select egg —</option>
                    <option v-for="s in filteredSpells" :key="s.id" :value="s.id">{{ s.name }}</option>
                  </select>
                  <ChevronDown class="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Nodes</label>
                <div class="relative">
                  <select v-model="planForm.node_ids" multiple
                    class="flex h-9 w-full rounded-lg border border-input bg-background pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none">
                    <option v-for="n in planOptions.nodes" :key="n.id" :value="n.id">{{ n.name }}</option>
                  </select>
                  <ChevronDown class="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
                <p class="text-xs text-muted-foreground mt-1">Select one or more nodes. The first node with enough resources will be used for provisioning.</p>
              </div>
            </div>

            
            <div class="border-t border-border pt-4 space-y-4">
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">User Choice & Access Control</p>
              <p class="text-xs text-muted-foreground -mt-2">Allow subscribers to pick their own realm/egg, or restrict which ones are available.</p>

              
              <div class="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium text-foreground">Let user choose Realm (Nest)</p>
                    <p class="text-xs text-muted-foreground mt-0.5">User picks a realm at subscribe time instead of using the forced realm above</p>
                  </div>
                  <button type="button" @click="planForm.user_can_choose_realm = !planForm.user_can_choose_realm"
                    :class="planForm.user_can_choose_realm ? 'bg-primary' : 'bg-input'"
                    class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring">
                    <span :class="planForm.user_can_choose_realm ? 'translate-x-5' : 'translate-x-0'"
                      class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform" />
                  </button>
                </div>
                <template v-if="planForm.user_can_choose_realm">
                  <div>
                    <p class="text-xs font-semibold text-muted-foreground mb-2">Whitelist — allowed realms <span class="font-normal">(empty = all realms)</span></p>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
                      <label v-for="r in planOptions.realms" :key="r.id"
                        class="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md cursor-pointer transition-colors"
                        :class="planForm.allowed_realms.includes(r.id) ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-background border border-border hover:bg-muted/50'">
                        <input type="checkbox" class="sr-only" :checked="planForm.allowed_realms.includes(r.id)"
                          @change="planForm.allowed_realms = toggleAllowedId(planForm.allowed_realms, r.id)" />
                        <span class="w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center transition-colors"
                          :class="planForm.allowed_realms.includes(r.id) ? 'bg-primary border-primary' : 'border-muted-foreground/40'">
                          <svg v-if="planForm.allowed_realms.includes(r.id)" class="w-2 h-2 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </span>
                        {{ r.name }}
                      </label>
                    </div>
                    <p v-if="planForm.allowed_realms.length" class="text-xs text-primary mt-1.5">{{ planForm.allowed_realms.length }} realm(s) whitelisted</p>
                    <p v-else class="text-xs text-muted-foreground mt-1.5">All realms allowed</p>
                  </div>
                </template>
              </div>

              
              <div class="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium text-foreground">Let user choose Spell (Egg)</p>
                    <p class="text-xs text-muted-foreground mt-0.5">User picks an egg at subscribe time instead of using the forced egg above</p>
                  </div>
                  <button type="button" @click="planForm.user_can_choose_spell = !planForm.user_can_choose_spell"
                    :class="planForm.user_can_choose_spell ? 'bg-primary' : 'bg-input'"
                    class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring">
                    <span :class="planForm.user_can_choose_spell ? 'translate-x-5' : 'translate-x-0'"
                      class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform" />
                  </button>
                </div>
                <template v-if="planForm.user_can_choose_spell">
                  <div>
                    <p class="text-xs font-semibold text-muted-foreground mb-2">Whitelist — allowed eggs <span class="font-normal">(empty = all eggs{{ planForm.realms_id ? ' in selected realm' : '' }})</span></p>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
                      <label v-for="s in allowedSpellsPool" :key="s.id"
                        class="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md cursor-pointer transition-colors"
                        :class="planForm.allowed_spells.includes(s.id) ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-background border border-border hover:bg-muted/50'">
                        <input type="checkbox" class="sr-only" :checked="planForm.allowed_spells.includes(s.id)"
                          @change="planForm.allowed_spells = toggleAllowedId(planForm.allowed_spells, s.id)" />
                        <span class="w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center transition-colors"
                          :class="planForm.allowed_spells.includes(s.id) ? 'bg-primary border-primary' : 'border-muted-foreground/40'">
                          <svg v-if="planForm.allowed_spells.includes(s.id)" class="w-2 h-2 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </span>
                        {{ s.name }}
                      </label>
                    </div>
                    <p v-if="planForm.allowed_spells.length" class="text-xs text-primary mt-1.5">{{ planForm.allowed_spells.length }} egg(s) whitelisted</p>
                    <p v-else class="text-xs text-muted-foreground mt-1.5">All eggs allowed</p>
                  </div>
                </template>
              </div>
            </div>

            
            <template v-if="planForm.spell_id || planForm.user_can_choose_spell">
              <div class="border-t border-border pt-4">
                <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Resources</p>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label class="block text-xs text-muted-foreground mb-1 flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full bg-blue-400 mr-0.5"></span>RAM (MB)</label>
                    <input v-model.number="planForm.memory" type="number" min="128" step="128"
                      class="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label class="block text-xs text-muted-foreground mb-1 flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full bg-green-400 mr-0.5"></span>CPU (%)</label>
                    <input v-model.number="planForm.cpu" type="number" min="0" max="10000"
                      class="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label class="block text-xs text-muted-foreground mb-1 flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full bg-orange-400 mr-0.5"></span>Disk (MB)</label>
                    <input v-model.number="planForm.disk" type="number" min="512" step="512"
                      class="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label class="block text-xs text-muted-foreground mb-1">Swap (MB)</label>
                    <input v-model.number="planForm.swap" type="number" min="0"
                      class="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label class="block text-xs text-muted-foreground mb-1">Backups</label>
                    <input v-model.number="planForm.backup_limit" type="number" min="0"
                      class="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label class="block text-xs text-muted-foreground mb-1">Databases</label>
                    <input v-model.number="planForm.database_limit" type="number" min="0"
                      class="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label class="block text-xs text-muted-foreground mb-1">Allocations</label>
                    <input v-model.number="planForm.allocation_limit" type="number" min="0" placeholder="Unlimited"
                      class="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label class="block text-xs text-muted-foreground mb-1">Block IO</label>
                    <input v-model.number="planForm.io" type="number" min="10" max="1000"
                      class="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>
              </div>

              <div class="border-t border-border pt-4 space-y-3">
                <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Overrides <span class="font-normal normal-case text-muted-foreground/60">(leave blank to use egg defaults)</span></p>
                <div>
                  <label class="block text-xs text-muted-foreground mb-1">Startup Command</label>
                  <input v-model="planForm.startup_override" placeholder="Use egg default"
                    class="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label class="block text-xs text-muted-foreground mb-1">Docker Image</label>
                  <input v-model="planForm.image_override" placeholder="Use egg default"
                    class="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
            </template>
          </div>
        </div>

        
        <div class="flex items-center justify-between">
          <button type="button" @click="cancelEditor" class="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
            <ArrowLeft class="h-4 w-4" />Cancel
          </button>
          <button type="submit" :disabled="plansLoading"
            class="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm">
            <Loader2 v-if="plansLoading" class="h-4 w-4 animate-spin" />
            <Save v-else class="h-4 w-4" />
            {{ editingPlan ? "Save Changes" : "Create Plan" }}
          </button>
        </div>
      </form>
    </div>

    
    <div v-else class="container mx-auto max-w-7xl px-4 md:px-8 py-6">

      
      <div class="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard class="h-6 w-6 text-primary" />Billing Plans
          </h1>
          <p class="text-sm text-muted-foreground mt-0.5">Manage renewable server plans and subscriptions</p>
        </div>
        <button v-if="activeTab === 'plans'" @click="openCreate"
          class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
          <Plus class="h-4 w-4" />New Plan
        </button>
        <button v-if="activeTab === 'categories'" @click="openCatModal()"
          class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
          <Plus class="h-4 w-4" />New Category
        </button>
      </div>

      
      <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <div class="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Plans</p>
            <div class="bg-primary/10 rounded-lg p-1.5"><CreditCard class="h-3.5 w-3.5 text-primary" /></div>
          </div>
          <p class="text-2xl font-bold">{{ stats?.total_plans ?? 0 }}</p>
          <p class="text-xs text-muted-foreground mt-0.5">{{ stats?.active_plans ?? 0 }} active</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active</p>
            <div class="bg-emerald-500/10 rounded-lg p-1.5"><CheckCircle2 class="h-3.5 w-3.5 text-emerald-500" /></div>
          </div>
          <p class="text-2xl font-bold">{{ stats?.subscriptions.active ?? 0 }}</p>
          <p class="text-xs text-muted-foreground mt-0.5">subscriptions</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Suspended</p>
            <div class="bg-amber-500/10 rounded-lg p-1.5"><PauseCircle class="h-3.5 w-3.5 text-amber-500" /></div>
          </div>
          <p class="text-2xl font-bold">{{ stats?.subscriptions.suspended ?? 0 }}</p>
          <p class="text-xs text-muted-foreground mt-0.5">no credits</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</p>
            <div class="bg-blue-500/10 rounded-lg p-1.5"><Users class="h-3.5 w-3.5 text-blue-500" /></div>
          </div>
          <p class="text-2xl font-bold">{{ totalSubscriptions }}</p>
          <p class="text-xs text-muted-foreground mt-0.5">all time</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-4 shadow-sm col-span-2 xl:col-span-1">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Staff refunds</p>
            <div class="bg-violet-500/10 rounded-lg p-1.5"><CircleDollarSign class="h-3.5 w-3.5 text-violet-500" /></div>
          </div>
          <p class="text-2xl font-bold">{{ (stats?.admin_refunds?.total_credits_refunded ?? 0).toLocaleString() }}</p>
          <p class="text-xs text-muted-foreground mt-0.5">cr to users · {{ stats?.admin_refunds?.subscriptions_with_refunds ?? 0 }} subs</p>
        </div>
      </div>

      
      <div class="flex gap-1 mb-5 bg-muted/50 rounded-xl p-1 w-fit flex-wrap">
        <button v-for="tab in [{ key: 'plans', label: 'Plans', icon: CreditCard }, { key: 'categories', label: 'Categories', icon: FolderOpen }, { key: 'subscriptions', label: 'Subscriptions', icon: BarChart3 }, { key: 'settings', label: 'Settings', icon: Settings }]"
          :key="tab.key" @click="activeTab = tab.key as Tab; currentView = 'list'"
          :class="['inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all', activeTab === tab.key ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground']">
          <component :is="tab.icon" class="h-4 w-4" />{{ tab.label }}
        </button>
      </div>

      
      <div v-if="activeTab === 'plans'">
        <div class="flex items-center gap-3 mb-4 flex-wrap">
          <input v-model="plansSearch" @input="plansPage = 1; loadPlans()" type="text" placeholder="Search plans..."
            class="flex h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full md:w-64" />
        </div>

        <div v-if="plansLoading" class="flex justify-center py-16"><Loader2 class="h-7 w-7 animate-spin text-muted-foreground" /></div>

        <div v-else-if="plans.length === 0" class="text-center py-16 bg-card border border-border rounded-xl">
          <CreditCard class="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p class="font-medium text-muted-foreground">No plans yet</p>
          <button @click="openCreate" class="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus class="h-4 w-4" />Create First Plan
          </button>
        </div>

        <div v-else class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-muted/40">
                <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Plan</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">Category</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Price</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Period</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Stock</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Server</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th class="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="plan in plans" :key="plan.id" class="hover:bg-muted/20 transition-colors group">
                <td class="px-4 py-3">
                  <div class="font-medium text-foreground">{{ plan.name }}</div>
                  <div v-if="plan.description" class="text-xs text-muted-foreground mt-0.5 line-clamp-1">{{ plan.description }}</div>
                </td>
                <td class="px-4 py-3 hidden sm:table-cell">
                  <span v-if="plan.category" :class="['inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border', colorClasses(plan.category.color)]">
                    <span v-if="plan.category.icon">{{ plan.category.icon }}</span>
                    {{ plan.category.name }}
                  </span>
                  <span v-else class="text-xs text-muted-foreground/40">—</span>
                </td>
                <td class="px-4 py-3">
                  <span class="font-semibold">{{ plan.price_credits.toLocaleString() }}</span>
                  <span class="text-muted-foreground text-xs ml-1">cr</span>
                </td>
                <td class="px-4 py-3 text-muted-foreground text-xs">{{ getPeriodLabel(plan.billing_period_days) }}</td>
                <td class="px-4 py-3 hidden md:table-cell">
                  <div v-if="plan.max_subscriptions" class="flex items-center gap-1.5">
                    <div class="h-1.5 rounded-full bg-muted flex-1 max-w-[60px] overflow-hidden">
                      <div class="h-full bg-primary rounded-full transition-all"
                        :style="{ width: Math.min(100, Math.round(((plan.active_subscription_count ?? 0) / plan.max_subscriptions) * 100)) + '%' }" />
                    </div>
                    <span class="text-xs text-muted-foreground whitespace-nowrap">{{ plan.active_subscription_count ?? 0 }} / {{ plan.max_subscriptions }}</span>
                  </div>
                  <div v-else class="flex items-center gap-1 text-xs text-muted-foreground">
                    <Infinity class="h-3 w-3" />{{ plan.active_subscription_count ?? 0 }} active
                  </div>
                </td>
                <td class="px-4 py-3 hidden lg:table-cell">
                  <div class="flex flex-col gap-0.5">
                    <span v-if="plan.spell_id || plan.user_can_choose_spell" class="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full w-fit">
                      <Server class="h-3 w-3" />{{ plan.user_can_choose_spell ? 'User picks egg' : 'Configured' }}
                    </span>
                    <span v-if="plan.user_can_choose_realm" class="inline-flex items-center gap-1 text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full w-fit">
                      User picks realm
                    </span>
                    <span v-if="!plan.spell_id && !plan.user_can_choose_spell && !plan.user_can_choose_realm" class="text-xs text-muted-foreground/40">—</span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', plan.is_active ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-muted text-muted-foreground border-border']">
                    {{ plan.is_active ? "Active" : "Inactive" }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button @click="openEdit(plan)" class="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Edit">
                      <Pencil class="h-3.5 w-3.5" />
                    </button>
                    <button @click="confirmDelete(plan)" class="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                      <Trash2 class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="plansTotalPages > 1" class="flex items-center justify-center gap-2 mt-5">
          <button @click="plansPage--; loadPlans()" :disabled="plansPage <= 1" class="rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40 transition-colors">Previous</button>
          <span class="text-sm text-muted-foreground">{{ plansPage }} / {{ plansTotalPages }}</span>
          <button @click="plansPage++; loadPlans()" :disabled="plansPage >= plansTotalPages" class="rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40 transition-colors">Next</button>
        </div>
      </div>

      
      <div v-if="activeTab === 'categories'">
        <div class="flex items-center gap-3 mb-4 flex-wrap">
          <input v-model="catsSearch" @input="catsPage = 1; loadCategories()" type="text" placeholder="Search categories..."
            class="flex h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full md:w-64" />
        </div>

        <div v-if="catsLoading" class="flex justify-center py-16"><Loader2 class="h-7 w-7 animate-spin text-muted-foreground" /></div>

        <div v-else-if="categories.length === 0" class="text-center py-16 bg-card border border-border rounded-xl">
          <FolderOpen class="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p class="font-medium text-muted-foreground">No categories yet</p>
          <p class="text-sm text-muted-foreground/60 mt-1 mb-4">Create categories to organise your plans like in WHMCS</p>
          <button @click="openCatModal()" class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus class="h-4 w-4" />Create First Category
          </button>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="cat in categories" :key="cat.id"
            class="bg-card border border-border rounded-xl shadow-sm p-5 flex flex-col gap-3 hover:border-primary/30 transition-colors">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <div v-if="cat.icon" class="text-2xl leading-none">{{ cat.icon }}</div>
                <div v-else class="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FolderOpen class="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p class="font-semibold text-foreground">{{ cat.name }}</p>
                  <p v-if="cat.description" class="text-xs text-muted-foreground line-clamp-1 mt-0.5">{{ cat.description }}</p>
                </div>
              </div>
              <span :class="['shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', colorClasses(cat.color)]">
                {{ cat.color ?? 'default' }}
              </span>
            </div>

            <div class="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
              <div class="flex items-center gap-3">
                <span class="flex items-center gap-1">
                  <CreditCard class="h-3 w-3" />{{ cat.plan_count ?? 0 }} plan{{ (cat.plan_count ?? 0) !== 1 ? 's' : '' }}
                </span>
                <span :class="['px-1.5 py-0.5 rounded text-[10px] font-medium', cat.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground']">
                  {{ cat.is_active ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <div class="flex items-center gap-1">
                <button @click="openCatModal(cat)" class="p-1.5 rounded-md hover:bg-muted transition-colors" title="Edit">
                  <Pencil class="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
                <button @click="confirmDeleteCat(cat)" class="p-1.5 rounded-md hover:bg-red-500/10 transition-colors" title="Delete">
                  <Trash2 class="h-3.5 w-3.5 text-muted-foreground hover:text-red-400" />
                </button>
              </div>
            </div>
          </div>
        </div>

        
        <div v-if="catsTotalPages > 1" class="flex items-center justify-center gap-2 mt-6">
          <button @click="catsPage--; loadCategories()" :disabled="catsPage <= 1" class="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted transition-colors">Prev</button>
          <span class="text-sm text-muted-foreground">{{ catsPage }} / {{ catsTotalPages }}</span>
          <button @click="catsPage++; loadCategories()" :disabled="catsPage >= catsTotalPages" class="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted transition-colors">Next</button>
        </div>
      </div>

      
      <div v-if="activeTab === 'subscriptions'">
        <div class="flex items-center gap-3 mb-4 flex-wrap">
          <input v-model="subsSearch" @input="subsPage = 1; loadSubscriptions()" type="text" placeholder="Search user, plan..."
            class="flex h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full md:w-64" />
          <select v-model="subsStatusFilter" @change="subsPage = 1; loadSubscriptions()"
            class="flex h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
          <button @click="loadSubscriptions" class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent transition-colors">
            <RefreshCw class="h-3.5 w-3.5" />Refresh
          </button>
        </div>

        <div v-if="subsLoading" class="flex justify-center py-16"><Loader2 class="h-7 w-7 animate-spin text-muted-foreground" /></div>

        <div v-else-if="subscriptions.length === 0" class="text-center py-16 bg-card border border-border rounded-xl">
          <Users class="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p class="font-medium text-muted-foreground">No subscriptions found</p>
        </div>

        <div v-else class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-muted/40">
                <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">#</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">User</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Plan</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Next Renewal</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Server</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden xl:table-cell">Created</th>
                <th class="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide min-w-[9rem]">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="sub in subscriptions" :key="sub.id" class="hover:bg-muted/20 transition-colors group">
                <td class="px-4 py-3 text-muted-foreground text-xs font-mono">#{{ sub.id }}</td>
                <td class="px-4 py-3">
                  <div class="font-medium">{{ sub.username ?? "User #" + sub.user_id }}</div>
                  <div class="text-xs text-muted-foreground">{{ sub.email ?? "" }}</div>
                  <button
                    v-if="sub.user_uuid"
                    type="button"
                    @click="openAdminPath(`/admin/users/${sub.user_uuid}/edit`)"
                    class="mt-1.5 inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <ExternalLink class="h-3 w-3 shrink-0" />
                    Go to user
                  </button>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium">{{ sub.plan_name }}</div>
                  <div class="text-xs text-muted-foreground">{{ sub.price_credits.toLocaleString() }} cr / {{ getPeriodLabel(sub.billing_period_days) }}</div>
                  <div
                    v-if="Number(sub.admin_credits_refunded_total ?? 0) > 0"
                    class="mt-1.5 inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-700 dark:text-violet-300"
                    title="Credits returned to the user via admin refunds (running total)"
                  >
                    <CircleDollarSign class="h-3 w-3 shrink-0 opacity-80" />
                    <span>Refunded {{ Number(sub.admin_credits_refunded_total ?? 0).toLocaleString() }} cr total</span>
                    <span v-if="sub.admin_refunded_at" class="font-normal text-violet-600/80 dark:text-violet-400/90">
                      · last {{ formatDate(sub.admin_refunded_at) }}
                    </span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span :class="['inline-flex px-2 py-0.5 rounded-full text-xs font-medium', statusBadgeClass(sub.status)]">
                    {{ sub.status.charAt(0).toUpperCase() + sub.status.slice(1) }}
                  </span>
                </td>
                <td class="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">{{ formatDate(sub.next_renewal_at) }}</td>
                <td class="px-4 py-3 hidden lg:table-cell">
                  <template v-if="sub.server_uuid">
                    <div class="font-medium text-sm">{{ sub.server_name || "Unknown server" }}</div>
                    <div class="font-mono text-[10px] text-muted-foreground mt-0.5">{{ sub.server_uuid.substring(0, 8) }}…</div>
                    <button
                      v-if="sub.server_id != null"
                      type="button"
                      @click="openAdminPath(`/admin/servers/${sub.server_id}/edit`)"
                      class="mt-1.5 inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <ExternalLink class="h-3 w-3 shrink-0" />
                      Go to server
                    </button>
                  </template>
                  <span v-else class="text-muted-foreground/40 text-xs">—</span>
                </td>
                <td class="px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell">{{ formatDate(sub.created_at) }}</td>
                <td class="px-4 py-3 text-right">
                  <div class="flex flex-col items-end gap-1 sm:flex-row sm:justify-end sm:flex-wrap">
                    <button
                      type="button"
                      @click="confirmRefundSub(sub)"
                      class="inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all"
                    >
                      <CircleDollarSign class="h-3 w-3" />Refund
                    </button>
                    <button
                      v-if="sub.status !== 'cancelled' && sub.status !== 'expired'"
                      type="button"
                      @click="confirmCancelSub(sub)"
                      class="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/5 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/15 transition-all"
                    >
                      <XCircle class="h-3 w-3" />Cancel
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="subsTotalPages > 1" class="flex items-center justify-center gap-2 mt-5">
          <button @click="subsPage--; loadSubscriptions()" :disabled="subsPage <= 1" class="rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40 transition-colors">Previous</button>
          <span class="text-sm text-muted-foreground">{{ subsPage }} / {{ subsTotalPages }}</span>
          <button @click="subsPage++; loadSubscriptions()" :disabled="subsPage >= subsTotalPages" class="rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40 transition-colors">Next</button>
        </div>
      </div>

      
      <div v-if="activeTab === 'settings'">
        <div class="max-w-3xl space-y-6">

          
          <div class="bg-card border border-border rounded-xl shadow-sm p-5">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Billing Lifecycle</p>
            <div class="flex items-center gap-1 flex-wrap text-xs font-mono">
              <span class="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">Renewal Due</span>
              <span class="text-muted-foreground">→</span>
              <span class="px-2.5 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30">Grace Period ({{ settingsForm.grace_period_days }}d)</span>
              <span class="text-muted-foreground">→</span>
              <span class="px-2.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold">Suspended</span>
              <span class="text-muted-foreground">→</span>
              <span class="px-2.5 py-1.5 rounded-lg" :class="settingsForm.termination_days === 0 ? 'bg-muted/40 text-muted-foreground border border-border' : 'bg-red-500/15 text-red-400 border border-red-500/30 font-semibold'">
                {{ settingsForm.termination_days === 0 ? 'Never Terminated' : `Terminated + Deleted (${settingsForm.termination_days}d)` }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground mt-3">
              <strong>Cancellation:</strong> server is <strong>suspended immediately</strong>.
              <template v-if="settingsForm.termination_days > 0"> If it stays suspended for {{ settingsForm.termination_days }} day(s), the server is <strong class="text-red-400">permanently deleted</strong>.</template>
              <template v-else> Suspended servers are <strong>never auto-deleted</strong> (manage manually).</template>
            </p>
          </div>

          
          <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div class="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/30">
              <div class="rounded-md bg-amber-500/10 p-1.5"><ServerOff class="h-4 w-4 text-amber-500" /></div>
              <div>
                <h3 class="text-sm font-semibold">Server Actions</h3>
                <p class="text-xs text-muted-foreground">What happens to the Wings server on billing events</p>
              </div>
            </div>
            <div class="divide-y divide-border">
              <div class="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p class="text-sm font-medium">Suspend server when renewal fails</p>
                  <p class="text-xs text-muted-foreground mt-0.5">Automatically suspend the Wings server when the account runs out of credits</p>
                </div>
                <button type="button" @click="settingsForm.suspend_servers = !settingsForm.suspend_servers" class="shrink-0">
                  <ToggleRight v-if="settingsForm.suspend_servers" class="h-8 w-8 text-primary" />
                  <ToggleLeft v-else class="h-8 w-8 text-muted-foreground" />
                </button>
              </div>
              <div class="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p class="text-sm font-medium">Unsuspend server when payment succeeds</p>
                  <p class="text-xs text-muted-foreground mt-0.5">Automatically restore the server when the subscription is successfully renewed</p>
                </div>
                <button type="button" @click="settingsForm.unsuspend_on_renewal = !settingsForm.unsuspend_on_renewal" class="shrink-0">
                  <ToggleRight v-if="settingsForm.unsuspend_on_renewal" class="h-8 w-8 text-primary" />
                  <ToggleLeft v-else class="h-8 w-8 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>

          
          <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div class="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/30">
              <div class="rounded-md bg-blue-500/10 p-1.5"><Clock class="h-4 w-4 text-blue-400" /></div>
              <div>
                <h3 class="text-sm font-semibold">Time Windows</h3>
                <p class="text-xs text-muted-foreground">Grace and termination periods</p>
              </div>
            </div>
            <div class="divide-y divide-border">
              <div class="px-5 py-4">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="text-sm font-medium">Grace period</p>
                    <p class="text-xs text-muted-foreground mt-0.5">Days after a failed renewal before the subscription is suspended. Set to <strong>0</strong> to suspend immediately.</p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <input v-model.number="settingsForm.grace_period_days" type="number" min="0" max="30" class="flex h-9 w-20 rounded-lg border border-input bg-background px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring" />
                    <span class="text-xs text-muted-foreground w-16">{{ settingsForm.grace_period_days === 0 ? 'Immediate' : settingsForm.grace_period_days + ' day(s)' }}</span>
                  </div>
                </div>
              </div>
              <div class="px-5 py-4">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="text-sm font-medium">Termination period</p>
                    <p class="text-xs text-muted-foreground mt-0.5">Days after suspension before the subscription is <strong>auto-cancelled</strong> and the server is <strong class="text-red-400">permanently deleted from Wings</strong>. Set to <strong>0</strong> to never auto-terminate.</p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <input v-model.number="settingsForm.termination_days" type="number" min="0" max="365" class="flex h-9 w-20 rounded-lg border border-input bg-background px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring" />
                    <span class="text-xs text-muted-foreground w-16">{{ settingsForm.termination_days === 0 ? 'Disabled' : settingsForm.termination_days + ' day(s)' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          
          <div class="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div class="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/30">
              <div class="rounded-md bg-purple-500/10 p-1.5"><ShieldAlert class="h-4 w-4 text-purple-400" /></div>
              <div>
                <h3 class="text-sm font-semibold">Notifications & Permissions</h3>
                <p class="text-xs text-muted-foreground">Emails and user-facing options</p>
              </div>
            </div>
            <div class="divide-y divide-border">
              <div class="flex items-center justify-between gap-4 px-5 py-4">
                <div class="flex items-start gap-2.5">
                  <Mail class="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p class="text-sm font-medium">Suspension email</p>
                    <p class="text-xs text-muted-foreground mt-0.5">Notify the user when their subscription and server are suspended due to insufficient credits</p>
                  </div>
                </div>
                <button type="button" @click="settingsForm.send_suspension_email = !settingsForm.send_suspension_email" class="shrink-0">
                  <ToggleRight v-if="settingsForm.send_suspension_email" class="h-8 w-8 text-primary" />
                  <ToggleLeft v-else class="h-8 w-8 text-muted-foreground" />
                </button>
              </div>
              <div class="flex items-center justify-between gap-4 px-5 py-4">
                <div class="flex items-start gap-2.5">
                  <Mail class="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p class="text-sm font-medium">Termination email</p>
                    <p class="text-xs text-muted-foreground mt-0.5">Notify the user when their subscription is auto-terminated and the server is deleted</p>
                  </div>
                </div>
                <button type="button" @click="settingsForm.send_termination_email = !settingsForm.send_termination_email" class="shrink-0">
                  <ToggleRight v-if="settingsForm.send_termination_email" class="h-8 w-8 text-primary" />
                  <ToggleLeft v-else class="h-8 w-8 text-muted-foreground" />
                </button>
              </div>
              <div class="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p class="text-sm font-medium">Allow user cancellation</p>
                  <p class="text-xs text-muted-foreground mt-0.5">Let users cancel their own subscriptions from the billing page. The server is suspended immediately on cancellation.</p>
                </div>
                <button type="button" @click="settingsForm.allow_user_cancellation = !settingsForm.allow_user_cancellation" class="shrink-0">
                  <ToggleRight v-if="settingsForm.allow_user_cancellation" class="h-8 w-8 text-primary" />
                  <ToggleLeft v-else class="h-8 w-8 text-muted-foreground" />
                </button>
              </div>
              <div class="flex items-center justify-between gap-4 px-5 py-4">
                <div class="flex items-start gap-2.5">
                  <FileText class="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p class="text-sm font-medium">Generate invoices</p>
                    <p class="text-xs text-muted-foreground mt-0.5">Automatically create a <strong>billingcore</strong> invoice marked as paid whenever a user purchases or renews a plan. Invoices are visible to users in their billing dashboard.</p>
                  </div>
                </div>
                <button type="button" @click="settingsForm.generate_invoices = !settingsForm.generate_invoices" class="shrink-0">
                  <ToggleRight v-if="settingsForm.generate_invoices" class="h-8 w-8 text-primary" />
                  <ToggleLeft v-else class="h-8 w-8 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>

          <div class="flex justify-end">
            <button @click="saveSettings" :disabled="settingsLoading" class="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm">
              <Loader2 v-if="settingsLoading" class="h-4 w-4 animate-spin" /><Save v-else class="h-4 w-4" />Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>

    
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" @click.self="showDeleteConfirm = false">
        <div class="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm">
          <div class="px-6 py-4 border-b border-border"><h2 class="text-base font-semibold">Delete Plan</h2></div>
          <div class="p-6">
            <p class="text-sm text-muted-foreground mb-5">Delete <strong class="text-foreground">{{ planToDelete?.name }}</strong>? Plans with active subscriptions cannot be deleted.</p>
            <div class="flex gap-3">
              <button @click="showDeleteConfirm = false" class="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Cancel</button>
              <button @click="executeDelete" :disabled="plansLoading" class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60 transition-colors">
                <Loader2 v-if="plansLoading" class="h-4 w-4 animate-spin" /><Trash2 v-else class="h-4 w-4" />Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    
    <Teleport to="body">
      <div v-if="showCancelSubConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" @click.self="showCancelSubConfirm = false">
        <div class="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm">
          <div class="px-6 py-4 border-b border-border"><h2 class="text-base font-semibold">Cancel Subscription</h2></div>
          <div class="p-6">
            <p class="text-sm text-muted-foreground mb-5">Cancel subscription <strong class="text-foreground">#{{ subToCancel?.id }}</strong> for <strong class="text-foreground">{{ subToCancel?.username ?? "User #" + subToCancel?.user_id }}</strong>? No refund issued.</p>
            <div class="flex gap-3">
              <button @click="showCancelSubConfirm = false" class="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Go Back</button>
              <button @click="executeCancelSub" :disabled="subsLoading" class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60 transition-colors">
                <Loader2 v-if="subsLoading" class="h-4 w-4 animate-spin" />Cancel Sub
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    
    <Teleport to="body">
      <div v-if="showRefundSubConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" @click.self="showRefundSubConfirm = false">
        <div class="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm">
          <div class="px-6 py-4 border-b border-border"><h2 class="text-base font-semibold">Refund credits</h2></div>
          <div class="p-6 space-y-4">
            <p class="text-sm text-muted-foreground">
              Add credits to <strong class="text-foreground">{{ subToRefund?.username ?? "User #" + subToRefund?.user_id }}</strong>
              for subscription <strong class="text-foreground">#{{ subToRefund?.id }}</strong>.
              Default is this plan's price ({{ subToRefund?.price_credits?.toLocaleString() ?? "—" }} cr).
            </p>
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">Credits to add</label>
              <input
                v-model.number="refundCreditsInput"
                type="number"
                min="1"
                step="1"
                class="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div class="flex gap-3">
              <button type="button" @click="showRefundSubConfirm = false" class="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Go back</button>
              <button type="button" @click="executeRefundSub" :disabled="subsLoading" class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60 transition-colors">
                <Loader2 v-if="subsLoading" class="h-4 w-4 animate-spin" />
                <CircleDollarSign v-else class="h-4 w-4" />
                Refund
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    
    <Teleport to="body">
      <div v-if="showCatModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" @click.self="showCatModal = false">
        <div class="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
          <div class="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 class="text-base font-semibold">{{ editingCategory ? 'Edit Category' : 'New Category' }}</h2>
            <button @click="showCatModal = false" class="text-muted-foreground hover:text-foreground transition-colors"><XCircle class="h-5 w-5" /></button>
          </div>
          <div class="p-6 space-y-4">

            
            <div class="flex gap-3">
              <div class="w-20 flex-shrink-0">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">Icon (emoji)</label>
                <input v-model="catForm.icon" maxlength="4" placeholder="🎮"
                  class="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-center text-lg focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div class="flex-1">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">Name <span class="text-red-400">*</span></label>
                <input v-model="catForm.name" placeholder="e.g. Minecraft, Game Servers..."
                  class="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
              <input v-model="catForm.description" placeholder="Short description shown to users..."
                class="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-2">Color</label>
              <div class="flex flex-wrap gap-2">
                <button v-for="c in CATEGORY_COLORS" :key="c.value" type="button"
                  @click="catForm.color = c.value"
                  :class="['px-3 py-1 rounded-full text-xs font-medium border transition-all', colorClasses(c.value, catForm.color === c.value)]">
                  {{ c.label }}
                </button>
              </div>
            </div>

            
            <div class="flex gap-3 items-end">
              <div class="w-28">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">Sort Order</label>
                <input v-model.number="catForm.sort_order" type="number" min="0"
                  class="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div class="flex items-center justify-between flex-1 p-3 rounded-lg border border-border bg-muted/20">
                <p class="text-sm font-medium">Active</p>
                <button type="button" @click="catForm.is_active = !catForm.is_active" class="shrink-0">
                  <ToggleRight v-if="catForm.is_active" class="h-7 w-7 text-primary" />
                  <ToggleLeft v-else class="h-7 w-7 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div class="flex gap-3 pt-1">
              <button @click="showCatModal = false" class="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Cancel</button>
              <button @click="saveCat" :disabled="catsLoading || !catForm.name.trim()"
                class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors">
                <Loader2 v-if="catsLoading" class="h-4 w-4 animate-spin" />
                <Save v-else class="h-4 w-4" />
                {{ editingCategory ? 'Save Changes' : 'Create Category' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    
    <Teleport to="body">
      <div v-if="showDeleteCatConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" @click.self="showDeleteCatConfirm = false">
        <div class="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm">
          <div class="px-6 py-4 border-b border-border"><h2 class="text-base font-semibold">Delete Category</h2></div>
          <div class="p-6">
            <p class="text-sm text-muted-foreground mb-5">
              Delete <strong class="text-foreground">{{ catToDelete?.name }}</strong>?
              Plans in this category will become uncategorised — they won't be deleted.
            </p>
            <div class="flex gap-3">
              <button @click="showDeleteCatConfirm = false" class="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Cancel</button>
              <button @click="executeDeleteCat" :disabled="catsLoading" class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60 transition-colors">
                <Loader2 v-if="catsLoading" class="h-4 w-4 animate-spin" /><Trash2 v-else class="h-4 w-4" />Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
