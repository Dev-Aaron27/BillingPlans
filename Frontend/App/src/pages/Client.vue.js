import { ref, onMounted, computed, watch } from "vue";
import { useToast } from "vue-toastification";
import { Loader2, CreditCard, CalendarClock, PauseCircle, XCircle, Clock, ShoppingCart, AlertTriangle, CheckCircle2, Server, HardDrive, Cpu, Database, MemoryStick, Shield, Package, Infinity, ChevronDown, ChevronUp, CircleDollarSign, ArrowLeft, BarChart3, RefreshCw, } from "lucide-vue-next";
import { useUserPlansAPI } from "@/composables/usePlansAPI";
import { useUserSubscriptionsAPI } from "@/composables/useSubscriptionsAPI";
import { useUserCategoriesAPI, colorClasses } from "@/composables/useCategoriesAPI";
const toast = useToast();
const { loading: plansLoading, listPlans, subscribeToPlan } = useUserPlansAPI();
const { loading: subsLoading, listSubscriptions, cancelSubscription } = useUserSubscriptionsAPI();
const { listCategories } = useUserCategoriesAPI();
const activeTab = ref("browse");
const shellView = ref("main");
const plans = ref([]);
const subscriptions = ref([]);
const categories = ref([]);
const activeCategoryId = ref(null);
const userCredits = ref(0);
const planToSubscribe = ref(null);
const serverName = ref("");
const chosenRealmId = ref(null);
const chosenSpellId = ref(null);
const subscribing = ref(false);
const showCancelConfirm = ref(false);
const subToCancel = ref(null);
const expandedPlanId = ref(null);
const PERIOD_MAP = {
    1: "Daily", 7: "Weekly", 14: "Bi-Weekly", 30: "Monthly",
    90: "Quarterly", 180: "Semi-Annual", 365: "Annual",
};
function getPeriodLabel(days) {
    return PERIOD_MAP[days] ?? `Every ${days}d`;
}
function formatDate(dt) {
    if (!dt)
        return "—";
    return new Date(dt).toLocaleDateString(undefined, {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}
function daysUntil(dt) {
    if (!dt)
        return "";
    const diff = Math.ceil((new Date(dt).getTime() - Date.now()) / 86400000);
    if (diff < 0)
        return "Overdue";
    if (diff === 0)
        return "Today";
    if (diff === 1)
        return "Tomorrow";
    return `In ${diff} days`;
}
function fmtMB(mb) {
    return mb >= 1024 ? (mb / 1024).toFixed(1).replace(/\.0$/, "") + " GB" : mb + " MB";
}
const loadData = async () => {
    try {
        const [pr, sr, cats] = await Promise.all([listPlans(), listSubscriptions(), listCategories()]);
        plans.value = pr.data;
        userCredits.value = pr.user_credits;
        subscriptions.value = sr.data;
        categories.value = cats;
    }
    catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load data");
    }
};
const filteredPlans = computed(() => {
    if (activeCategoryId.value === null)
        return plans.value;
    return plans.value.filter((p) => p.category_id === activeCategoryId.value);
});
const subscribeFilteredSpells = computed(() => {
    const plan = planToSubscribe.value;
    if (!plan?.user_can_choose_spell || !plan.allowed_spells_options?.length)
        return [];
    const opts = plan.allowed_spells_options;
    let realmId = null;
    if (plan.user_can_choose_realm) {
        const raw = chosenRealmId.value;
        if (raw == null)
            return [];
        realmId = Number(raw);
    }
    else if (plan.realms_id) {
        realmId = Number(plan.realms_id);
    }
    if (realmId === null || Number.isNaN(realmId))
        return opts;
    return opts.filter((s) => Number(s.realm_id) === realmId);
});
const canConfirmSubscribe = computed(() => {
    const p = planToSubscribe.value;
    if (!p)
        return false;
    if (p.user_can_choose_realm && chosenRealmId.value == null)
        return false;
    if (p.user_can_choose_spell) {
        if (subscribeFilteredSpells.value.length === 0)
            return false;
        if (chosenSpellId.value == null)
            return false;
    }
    return true;
});
watch(chosenRealmId, () => {
    const spells = subscribeFilteredSpells.value;
    if (chosenSpellId.value !== null &&
        !spells.some((s) => s.id === chosenSpellId.value)) {
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
const startSubscribe = (plan) => {
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
    if (!planToSubscribe.value)
        return;
    subscribing.value = true;
    try {
        const realmId = chosenRealmId.value != null ? Number(chosenRealmId.value) : undefined;
        const spellId = chosenSpellId.value != null ? Number(chosenSpellId.value) : undefined;
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
    }
    catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to subscribe");
    }
    finally {
        subscribing.value = false;
    }
};
const confirmCancelSub = (sub) => { subToCancel.value = sub; showCancelConfirm.value = true; };
const executeCancelSub = async () => {
    if (!subToCancel.value)
        return;
    try {
        await cancelSubscription(subToCancel.value.id);
        toast.success("Subscription cancelled.");
        showCancelConfirm.value = false;
        subToCancel.value = null;
        await loadData();
    }
    catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to cancel subscription");
    }
};
const toggleExpand = (planId) => {
    expandedPlanId.value = expandedPlanId.value === planId ? null : planId;
};
const activeSubscriptions = computed(() => subscriptions.value.filter((s) => s.status === "active" || s.status === "suspended"));
const pastSubscriptions = computed(() => subscriptions.value.filter((s) => s.status === "cancelled" || s.status === "expired"));
const balanceAfter = computed(() => planToSubscribe.value ? userCredits.value - planToSubscribe.value.price_credits : 0);
onMounted(loadData);
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "w-full h-full overflow-auto min-h-screen" },
});
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
if (__VLS_ctx.shellView === 'subscribe' && __VLS_ctx.planToSubscribe) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "container mx-auto max-w-4xl px-4 md:px-8 py-6" },
    });
    /** @type {__VLS_StyleScopedClasses['container']} */ ;
    /** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-4xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:px-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-6']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-3 mb-6" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeSubscribeFlow) },
        type: "button",
        ...{ class: "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors" },
    });
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:text-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    let __VLS_0;
    /** @ts-ignore @type {typeof __VLS_components.ArrowLeft} */
    ArrowLeft;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-muted-foreground/40" },
    });
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground/40']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({
        ...{ class: "text-base font-semibold text-foreground truncate" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-6" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "text-2xl font-bold tracking-tight text-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
    (__VLS_ctx.planToSubscribe.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-muted-foreground mt-0.5" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-5" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-5']} */ ;
    if (__VLS_ctx.planToSubscribe.has_server_template) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bg-card border border-border rounded-xl shadow-sm overflow-hidden" },
        });
        /** @type {__VLS_StyleScopedClasses['bg-card']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "px-5 py-4 border-b border-border bg-muted/30" },
        });
        /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-xs font-semibold text-muted-foreground uppercase tracking-wide" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "p-5" },
        });
        /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        let __VLS_5;
        /** @ts-ignore @type {typeof __VLS_components.MemoryStick} */
        MemoryStick;
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
            ...{ class: "h-4 w-4 text-blue-400 shrink-0" },
        }));
        const __VLS_7 = __VLS_6({
            ...{ class: "h-4 w-4 text-blue-400 shrink-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-blue-400']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-semibold text-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
        (__VLS_ctx.fmtMB(__VLS_ctx.planToSubscribe.memory));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        let __VLS_10;
        /** @ts-ignore @type {typeof __VLS_components.Cpu} */
        Cpu;
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
            ...{ class: "h-4 w-4 text-emerald-400 shrink-0" },
        }));
        const __VLS_12 = __VLS_11({
            ...{ class: "h-4 w-4 text-emerald-400 shrink-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_11));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-emerald-400']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-semibold text-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
        (__VLS_ctx.planToSubscribe.cpu);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        let __VLS_15;
        /** @ts-ignore @type {typeof __VLS_components.HardDrive} */
        HardDrive;
        // @ts-ignore
        const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
            ...{ class: "h-4 w-4 text-orange-400 shrink-0" },
        }));
        const __VLS_17 = __VLS_16({
            ...{ class: "h-4 w-4 text-orange-400 shrink-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_16));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-orange-400']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-semibold text-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
        (__VLS_ctx.fmtMB(__VLS_ctx.planToSubscribe.disk));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        if (__VLS_ctx.planToSubscribe.backup_limit > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm" },
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            let __VLS_20;
            /** @ts-ignore @type {typeof __VLS_components.Shield} */
            Shield;
            // @ts-ignore
            const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
                ...{ class: "h-4 w-4 text-cyan-400 shrink-0" },
            }));
            const __VLS_22 = __VLS_21({
                ...{ class: "h-4 w-4 text-cyan-400 shrink-0" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_21));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-cyan-400']} */ ;
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-semibold text-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
            (__VLS_ctx.planToSubscribe.backup_limit);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        }
        if (__VLS_ctx.planToSubscribe.database_limit > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm" },
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            let __VLS_25;
            /** @ts-ignore @type {typeof __VLS_components.Database} */
            Database;
            // @ts-ignore
            const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
                ...{ class: "h-4 w-4 text-purple-400 shrink-0" },
            }));
            const __VLS_27 = __VLS_26({
                ...{ class: "h-4 w-4 text-purple-400 shrink-0" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_26));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-purple-400']} */ ;
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-semibold text-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
            (__VLS_ctx.planToSubscribe.database_limit);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        }
    }
    if (__VLS_ctx.planToSubscribe.user_can_choose_realm && __VLS_ctx.planToSubscribe.allowed_realms_options?.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bg-card border border-border rounded-xl shadow-sm p-5 space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['bg-card']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "block text-xs font-medium text-muted-foreground mb-1.5" },
        });
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        /** @type {__VLS_StyleScopedClasses['mb-1.5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-red-400" },
        });
        /** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-xs text-muted-foreground mb-2" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.chosenRealmId),
            ...{ class: "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-9']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-input']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-background']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:ring-ring']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            disabled: true,
            value: (null),
        });
        for (const [r] of __VLS_vFor((__VLS_ctx.planToSubscribe.allowed_realms_options))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (r.id),
                value: (r.id),
            });
            (r.name);
            // @ts-ignore
            [shellView, planToSubscribe, planToSubscribe, planToSubscribe, planToSubscribe, planToSubscribe, planToSubscribe, planToSubscribe, planToSubscribe, planToSubscribe, planToSubscribe, planToSubscribe, planToSubscribe, planToSubscribe, closeSubscribeFlow, fmtMB, fmtMB, chosenRealmId,];
        }
    }
    if (__VLS_ctx.planToSubscribe.user_can_choose_spell && __VLS_ctx.planToSubscribe.allowed_spells_options?.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bg-card border border-border rounded-xl shadow-sm p-5 space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['bg-card']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "block text-xs font-medium text-muted-foreground mb-1.5" },
        });
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        /** @type {__VLS_StyleScopedClasses['mb-1.5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-red-400" },
        });
        /** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-xs text-muted-foreground mb-2" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        if (__VLS_ctx.planToSubscribe.user_can_choose_realm && __VLS_ctx.chosenRealmId == null) {
        }
        else if (__VLS_ctx.subscribeFilteredSpells.length === 0) {
        }
        else {
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.chosenSpellId),
            disabled: (__VLS_ctx.subscribeFilteredSpells.length === 0),
            ...{ class: "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-9']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-input']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-background']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:ring-ring']} */ ;
        /** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            disabled: true,
            value: (null),
        });
        (__VLS_ctx.subscribeFilteredSpells.length ? "Choose an egg…" : "No eggs for this nest");
        for (const [s] of __VLS_vFor((__VLS_ctx.subscribeFilteredSpells))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (s.id),
                value: (s.id),
            });
            (s.name);
            // @ts-ignore
            [planToSubscribe, planToSubscribe, planToSubscribe, chosenRealmId, subscribeFilteredSpells, subscribeFilteredSpells, subscribeFilteredSpells, subscribeFilteredSpells, chosenSpellId,];
        }
    }
    if (__VLS_ctx.planToSubscribe.has_server_template) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bg-card border border-border rounded-xl shadow-sm p-5 space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['bg-card']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "block text-xs font-medium text-muted-foreground mb-1.5" },
        });
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        /** @type {__VLS_StyleScopedClasses['mb-1.5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.serverName),
            type: "text",
            placeholder: "e.g. My Minecraft server",
            maxlength: "100",
            ...{ class: "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-9']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-input']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-background']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['placeholder:text-muted-foreground']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:ring-ring']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-xs text-muted-foreground mt-1.5" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-1.5']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bg-card border border-border rounded-xl shadow-sm overflow-hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "px-5 py-4 border-b border-border bg-muted/30" },
    });
    /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-semibold text-muted-foreground uppercase tracking-wide" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "divide-y divide-border" },
    });
    /** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
    /** @type {__VLS_StyleScopedClasses['divide-border']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex justify-between items-center px-5 py-3 gap-4 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium text-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
    (__VLS_ctx.getPeriodLabel(__VLS_ctx.planToSubscribe.billing_period_days));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex justify-between items-center px-5 py-3 gap-4 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-base font-bold text-foreground tabular-nums" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
    (__VLS_ctx.planToSubscribe.price_credits.toLocaleString());
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-sm font-normal text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex justify-between items-center px-5 py-3 gap-4 text-sm bg-muted/20" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-muted/20']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ([
                'font-semibold tabular-nums',
                __VLS_ctx.balanceAfter < 0 ? 'text-red-400' : 'text-emerald-400',
            ]) },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
    (__VLS_ctx.balanceAfter.toLocaleString());
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-muted-foreground leading-relaxed px-0.5" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-0.5']} */ ;
    (__VLS_ctx.getPeriodLabel(__VLS_ctx.planToSubscribe.billing_period_days).toLowerCase());
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-3 mt-8 pt-6 border-t border-border" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['pt-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeSubscribeFlow) },
        type: "button",
        ...{ class: "rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-accent']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.executeSubscribe) },
        type: "button",
        disabled: (__VLS_ctx.subscribing || !__VLS_ctx.canConfirmSubscribe),
        ...{ class: "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors shadow-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-primary-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-primary/90']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:pointer-events-none']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
    if (__VLS_ctx.subscribing) {
        let __VLS_30;
        /** @ts-ignore @type {typeof __VLS_components.Loader2} */
        Loader2;
        // @ts-ignore
        const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
            ...{ class: "h-4 w-4 animate-spin" },
        }));
        const __VLS_32 = __VLS_31({
            ...{ class: "h-4 w-4 animate-spin" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_31));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
    }
    else {
        let __VLS_35;
        /** @ts-ignore @type {typeof __VLS_components.ShoppingCart} */
        ShoppingCart;
        // @ts-ignore
        const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_37 = __VLS_36({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_36));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "container mx-auto max-w-7xl px-4 md:px-8 py-6" },
    });
    /** @type {__VLS_StyleScopedClasses['container']} */ ;
    /** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-7xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:px-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-6']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-6 flex items-start justify-between gap-4 flex-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({
        ...{ class: "text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
    let __VLS_40;
    /** @ts-ignore @type {typeof __VLS_components.CreditCard} */
    CreditCard;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({
        ...{ class: "h-6 w-6 text-primary" },
    }));
    const __VLS_42 = __VLS_41({
        ...{ class: "h-6 w-6 text-primary" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-muted-foreground mt-0.5" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.loadData) },
        type: "button",
        ...{ class: "inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent transition-colors" },
    });
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-accent']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    if (__VLS_ctx.plansLoading || __VLS_ctx.subsLoading) {
        let __VLS_45;
        /** @ts-ignore @type {typeof __VLS_components.Loader2} */
        Loader2;
        // @ts-ignore
        const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({
            ...{ class: "h-3.5 w-3.5 animate-spin text-muted-foreground" },
        }));
        const __VLS_47 = __VLS_46({
            ...{ class: "h-3.5 w-3.5 animate-spin text-muted-foreground" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_46));
        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    }
    else {
        let __VLS_50;
        /** @ts-ignore @type {typeof __VLS_components.RefreshCw} */
        RefreshCw;
        // @ts-ignore
        const __VLS_51 = __VLS_asFunctionalComponent1(__VLS_50, new __VLS_50({
            ...{ class: "h-3.5 w-3.5 text-muted-foreground" },
        }));
        const __VLS_52 = __VLS_51({
            ...{ class: "h-3.5 w-3.5 text-muted-foreground" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_51));
        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bg-card border border-border rounded-xl p-4 shadow-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between mb-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-medium text-muted-foreground uppercase tracking-wide" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bg-primary/10 rounded-lg p-1.5" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-primary/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-1.5']} */ ;
    let __VLS_55;
    /** @ts-ignore @type {typeof __VLS_components.CreditCard} */
    CreditCard;
    // @ts-ignore
    const __VLS_56 = __VLS_asFunctionalComponent1(__VLS_55, new __VLS_55({
        ...{ class: "h-3.5 w-3.5 text-primary" },
    }));
    const __VLS_57 = __VLS_56({
        ...{ class: "h-3.5 w-3.5 text-primary" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_56));
    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-2xl font-bold text-foreground tabular-nums" },
    });
    /** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
    (__VLS_ctx.userCredits.toLocaleString());
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-muted-foreground mt-0.5" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bg-card border border-border rounded-xl p-4 shadow-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between mb-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-medium text-muted-foreground uppercase tracking-wide" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bg-emerald-500/10 rounded-lg p-1.5" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-emerald-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-1.5']} */ ;
    let __VLS_60;
    /** @ts-ignore @type {typeof __VLS_components.CheckCircle2} */
    CheckCircle2;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({
        ...{ class: "h-3.5 w-3.5 text-emerald-500" },
    }));
    const __VLS_62 = __VLS_61({
        ...{ class: "h-3.5 w-3.5 text-emerald-500" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-emerald-500']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-2xl font-bold text-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
    (__VLS_ctx.activeSubscriptions.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-muted-foreground mt-0.5" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "hidden sm:block bg-card border border-border rounded-xl p-4 shadow-sm col-span-2 sm:col-span-1" },
    });
    /** @type {__VLS_StyleScopedClasses['hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:block']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['col-span-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:col-span-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between mb-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-medium text-muted-foreground uppercase tracking-wide" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bg-blue-500/10 rounded-lg p-1.5" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-blue-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-1.5']} */ ;
    let __VLS_65;
    /** @ts-ignore @type {typeof __VLS_components.BarChart3} */
    BarChart3;
    // @ts-ignore
    const __VLS_66 = __VLS_asFunctionalComponent1(__VLS_65, new __VLS_65({
        ...{ class: "h-3.5 w-3.5 text-blue-500" },
    }));
    const __VLS_67 = __VLS_66({
        ...{ class: "h-3.5 w-3.5 text-blue-500" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_66));
    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-blue-500']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-2xl font-bold text-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
    (__VLS_ctx.plans.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-muted-foreground mt-0.5" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex gap-1 mb-5 bg-muted/50 rounded-xl p-1 w-fit flex-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-muted/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-fit']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.shellView === 'subscribe' && __VLS_ctx.planToSubscribe))
                    return;
                __VLS_ctx.activeTab = 'browse';
                // @ts-ignore
                [planToSubscribe, planToSubscribe, planToSubscribe, planToSubscribe, closeSubscribeFlow, serverName, getPeriodLabel, getPeriodLabel, balanceAfter, balanceAfter, executeSubscribe, subscribing, subscribing, canConfirmSubscribe, loadData, plansLoading, subsLoading, userCredits, activeSubscriptions, plans, activeTab,];
            } },
        type: "button",
        ...{ class: (['inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all', __VLS_ctx.activeTab === 'browse' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground']) },
    });
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
    let __VLS_70;
    /** @ts-ignore @type {typeof __VLS_components.ShoppingCart} */
    ShoppingCart;
    // @ts-ignore
    const __VLS_71 = __VLS_asFunctionalComponent1(__VLS_70, new __VLS_70({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_72 = __VLS_71({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_71));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.shellView === 'subscribe' && __VLS_ctx.planToSubscribe))
                    return;
                __VLS_ctx.activeTab = 'my-subscriptions';
                // @ts-ignore
                [activeTab, activeTab,];
            } },
        type: "button",
        ...{ class: (['inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all', __VLS_ctx.activeTab === 'my-subscriptions' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground']) },
    });
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
    let __VLS_75;
    /** @ts-ignore @type {typeof __VLS_components.Clock} */
    Clock;
    // @ts-ignore
    const __VLS_76 = __VLS_asFunctionalComponent1(__VLS_75, new __VLS_75({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_77 = __VLS_76({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_76));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    if (__VLS_ctx.activeSubscriptions.length > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-[10px] font-semibold text-primary-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-w-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-primary-foreground']} */ ;
        (__VLS_ctx.activeSubscriptions.length);
    }
    if (__VLS_ctx.activeTab === 'browse') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        if (__VLS_ctx.categories.length > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex gap-2 mb-5 flex-wrap" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.shellView === 'subscribe' && __VLS_ctx.planToSubscribe))
                            return;
                        if (!(__VLS_ctx.activeTab === 'browse'))
                            return;
                        if (!(__VLS_ctx.categories.length > 0))
                            return;
                        __VLS_ctx.activeCategoryId = null;
                        // @ts-ignore
                        [activeSubscriptions, activeSubscriptions, activeTab, activeTab, categories, activeCategoryId,];
                    } },
                ...{ class: (['inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all',
                        __VLS_ctx.activeCategoryId === null ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30']) },
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60 text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            (__VLS_ctx.plans.length);
            for (const [cat] of __VLS_vFor((__VLS_ctx.categories))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.shellView === 'subscribe' && __VLS_ctx.planToSubscribe))
                                return;
                            if (!(__VLS_ctx.activeTab === 'browse'))
                                return;
                            if (!(__VLS_ctx.categories.length > 0))
                                return;
                            __VLS_ctx.activeCategoryId = cat.id;
                            // @ts-ignore
                            [plans, categories, activeCategoryId, activeCategoryId,];
                        } },
                    key: (cat.id),
                    ...{ class: (['inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all',
                            __VLS_ctx.colorClasses(cat.color, __VLS_ctx.activeCategoryId === cat.id)]) },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
                if (cat.icon) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "text-base leading-none" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
                    /** @type {__VLS_StyleScopedClasses['leading-none']} */ ;
                    (cat.icon);
                }
                (cat.name);
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "opacity-60 text-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                (cat.plan_count);
                // @ts-ignore
                [activeCategoryId, colorClasses,];
            }
        }
        if (__VLS_ctx.plansLoading) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex justify-center py-20" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-20']} */ ;
            let __VLS_80;
            /** @ts-ignore @type {typeof __VLS_components.Loader2} */
            Loader2;
            // @ts-ignore
            const __VLS_81 = __VLS_asFunctionalComponent1(__VLS_80, new __VLS_80({
                ...{ class: "h-8 w-8 animate-spin text-muted-foreground" },
            }));
            const __VLS_82 = __VLS_81({
                ...{ class: "h-8 w-8 animate-spin text-muted-foreground" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_81));
            /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
            /** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        }
        else if (__VLS_ctx.filteredPlans.length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-center py-20 bg-card border border-border rounded-xl" },
            });
            /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-20']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-card']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
            let __VLS_85;
            /** @ts-ignore @type {typeof __VLS_components.CreditCard} */
            CreditCard;
            // @ts-ignore
            const __VLS_86 = __VLS_asFunctionalComponent1(__VLS_85, new __VLS_85({
                ...{ class: "h-12 w-12 mx-auto mb-3 opacity-20" },
            }));
            const __VLS_87 = __VLS_86({
                ...{ class: "h-12 w-12 mx-auto mb-3 opacity-20" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_86));
            /** @type {__VLS_StyleScopedClasses['h-12']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-12']} */ ;
            /** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
            /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-20']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            (__VLS_ctx.activeCategoryId ? 'No plans in this category.' : 'No plans are currently available.');
            if (__VLS_ctx.activeCategoryId) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.shellView === 'subscribe' && __VLS_ctx.planToSubscribe))
                                return;
                            if (!(__VLS_ctx.activeTab === 'browse'))
                                return;
                            if (!!(__VLS_ctx.plansLoading))
                                return;
                            if (!(__VLS_ctx.filteredPlans.length === 0))
                                return;
                            if (!(__VLS_ctx.activeCategoryId))
                                return;
                            __VLS_ctx.activeCategoryId = null;
                            // @ts-ignore
                            [plansLoading, activeCategoryId, activeCategoryId, activeCategoryId, filteredPlans,];
                        } },
                    ...{ class: "mt-3 text-sm text-primary hover:underline" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
            }
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" },
            });
            /** @type {__VLS_StyleScopedClasses['grid']} */ ;
            /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-5']} */ ;
            for (const [plan] of __VLS_vFor((__VLS_ctx.filteredPlans))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    key: (plan.id),
                    ...{ class: "bg-card border border-border rounded-xl shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-md" },
                    ...{ class: ({
                            'border-primary/50 shadow-primary/10': !plan.is_sold_out && plan.can_afford,
                            'opacity-60': plan.is_sold_out,
                        }) },
                });
                /** @type {__VLS_StyleScopedClasses['bg-card']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
                /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
                /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:shadow-md']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-primary/50']} */ ;
                /** @type {__VLS_StyleScopedClasses['shadow-primary/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "p-5 flex-1" },
                });
                /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
                if (plan.category) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "mb-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: (['inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium', __VLS_ctx.colorClasses(plan.category.color)]) },
                    });
                    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                    if (plan.category.icon) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                        (plan.category.icon);
                    }
                    (plan.category.name);
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex items-start justify-between gap-2 mb-1" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
                    ...{ class: "font-semibold text-base text-foreground leading-tight" },
                });
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
                /** @type {__VLS_StyleScopedClasses['leading-tight']} */ ;
                (plan.name);
                if (plan.is_sold_out) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30" },
                    });
                    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-red-500/15']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-red-500/30']} */ ;
                }
                else if (plan.slots_available != null && plan.slots_available <= 5) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30" },
                    });
                    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-amber-500/15']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-amber-400']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-amber-500/30']} */ ;
                    (plan.slots_available);
                }
                if (plan.description) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-sm text-muted-foreground mb-3 leading-relaxed" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
                    (plan.description);
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "bg-muted/40 rounded-lg p-4 mb-4 text-center" },
                });
                /** @type {__VLS_StyleScopedClasses['bg-muted/40']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex items-baseline justify-center gap-1.5" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-baseline']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-3xl font-bold text-foreground" },
                });
                /** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
                (plan.price_credits.toLocaleString());
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-muted-foreground text-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex items-center justify-center gap-1.5 mt-1 text-muted-foreground text-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                let __VLS_90;
                /** @ts-ignore @type {typeof __VLS_components.CalendarClock} */
                CalendarClock;
                // @ts-ignore
                const __VLS_91 = __VLS_asFunctionalComponent1(__VLS_90, new __VLS_90({
                    ...{ class: "h-3.5 w-3.5" },
                }));
                const __VLS_92 = __VLS_91({
                    ...{ class: "h-3.5 w-3.5" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_91));
                /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_ctx.getPeriodLabel(plan.billing_period_days));
                if (plan.has_server_template) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "space-y-1.5 mb-3" },
                    });
                    /** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
                    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "grid grid-cols-2 gap-1.5" },
                    });
                    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                    /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                    let __VLS_95;
                    /** @ts-ignore @type {typeof __VLS_components.MemoryStick} */
                    MemoryStick;
                    // @ts-ignore
                    const __VLS_96 = __VLS_asFunctionalComponent1(__VLS_95, new __VLS_95({
                        ...{ class: "h-3.5 w-3.5 text-blue-400 shrink-0" },
                    }));
                    const __VLS_97 = __VLS_96({
                        ...{ class: "h-3.5 w-3.5 text-blue-400 shrink-0" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_96));
                    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-blue-400']} */ ;
                    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-xs font-medium text-foreground" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
                    (__VLS_ctx.fmtMB(plan.memory));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-[10px] text-muted-foreground" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                    let __VLS_100;
                    /** @ts-ignore @type {typeof __VLS_components.Cpu} */
                    Cpu;
                    // @ts-ignore
                    const __VLS_101 = __VLS_asFunctionalComponent1(__VLS_100, new __VLS_100({
                        ...{ class: "h-3.5 w-3.5 text-green-400 shrink-0" },
                    }));
                    const __VLS_102 = __VLS_101({
                        ...{ class: "h-3.5 w-3.5 text-green-400 shrink-0" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_101));
                    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-green-400']} */ ;
                    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-xs font-medium text-foreground" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
                    (plan.cpu);
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-[10px] text-muted-foreground" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                    let __VLS_105;
                    /** @ts-ignore @type {typeof __VLS_components.HardDrive} */
                    HardDrive;
                    // @ts-ignore
                    const __VLS_106 = __VLS_asFunctionalComponent1(__VLS_105, new __VLS_105({
                        ...{ class: "h-3.5 w-3.5 text-orange-400 shrink-0" },
                    }));
                    const __VLS_107 = __VLS_106({
                        ...{ class: "h-3.5 w-3.5 text-orange-400 shrink-0" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_106));
                    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-orange-400']} */ ;
                    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-xs font-medium text-foreground" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
                    (__VLS_ctx.fmtMB(plan.disk));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-[10px] text-muted-foreground" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                    let __VLS_110;
                    /** @ts-ignore @type {typeof __VLS_components.Database} */
                    Database;
                    // @ts-ignore
                    const __VLS_111 = __VLS_asFunctionalComponent1(__VLS_110, new __VLS_110({
                        ...{ class: "h-3.5 w-3.5 text-purple-400 shrink-0" },
                    }));
                    const __VLS_112 = __VLS_111({
                        ...{ class: "h-3.5 w-3.5 text-purple-400 shrink-0" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_111));
                    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-purple-400']} */ ;
                    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-xs font-medium text-foreground" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
                    (plan.database_limit);
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-[10px] text-muted-foreground" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!!(__VLS_ctx.shellView === 'subscribe' && __VLS_ctx.planToSubscribe))
                                    return;
                                if (!(__VLS_ctx.activeTab === 'browse'))
                                    return;
                                if (!!(__VLS_ctx.plansLoading))
                                    return;
                                if (!!(__VLS_ctx.filteredPlans.length === 0))
                                    return;
                                if (!(plan.has_server_template))
                                    return;
                                __VLS_ctx.toggleExpand(plan.id);
                                // @ts-ignore
                                [fmtMB, fmtMB, getPeriodLabel, colorClasses, filteredPlans, toggleExpand,];
                            } },
                        ...{ class: "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1" },
                    });
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    /** @type {__VLS_StyleScopedClasses['hover:text-foreground']} */ ;
                    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    if (__VLS_ctx.expandedPlanId !== plan.id) {
                        let __VLS_115;
                        /** @ts-ignore @type {typeof __VLS_components.ChevronDown} */
                        ChevronDown;
                        // @ts-ignore
                        const __VLS_116 = __VLS_asFunctionalComponent1(__VLS_115, new __VLS_115({
                            ...{ class: "h-3.5 w-3.5" },
                        }));
                        const __VLS_117 = __VLS_116({
                            ...{ class: "h-3.5 w-3.5" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_116));
                        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                    }
                    else {
                        let __VLS_120;
                        /** @ts-ignore @type {typeof __VLS_components.ChevronUp} */
                        ChevronUp;
                        // @ts-ignore
                        const __VLS_121 = __VLS_asFunctionalComponent1(__VLS_120, new __VLS_120({
                            ...{ class: "h-3.5 w-3.5" },
                        }));
                        const __VLS_122 = __VLS_121({
                            ...{ class: "h-3.5 w-3.5" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_121));
                        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                    }
                    (__VLS_ctx.expandedPlanId === plan.id ? 'Less details' : 'More details');
                    if (__VLS_ctx.expandedPlanId === plan.id) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "grid grid-cols-2 gap-1.5 mt-1" },
                        });
                        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                        /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-2" },
                        });
                        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
                        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                        /** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                        let __VLS_125;
                        /** @ts-ignore @type {typeof __VLS_components.Shield} */
                        Shield;
                        // @ts-ignore
                        const __VLS_126 = __VLS_asFunctionalComponent1(__VLS_125, new __VLS_125({
                            ...{ class: "h-3.5 w-3.5 text-cyan-400 shrink-0" },
                        }));
                        const __VLS_127 = __VLS_126({
                            ...{ class: "h-3.5 w-3.5 text-cyan-400 shrink-0" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_126));
                        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-cyan-400']} */ ;
                        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                            ...{ class: "text-xs font-medium text-foreground" },
                        });
                        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
                        (plan.backup_limit);
                        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                            ...{ class: "text-[10px] text-muted-foreground" },
                        });
                        /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-2" },
                        });
                        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
                        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                        /** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                        let __VLS_130;
                        /** @ts-ignore @type {typeof __VLS_components.Package} */
                        Package;
                        // @ts-ignore
                        const __VLS_131 = __VLS_asFunctionalComponent1(__VLS_130, new __VLS_130({
                            ...{ class: "h-3.5 w-3.5 text-pink-400 shrink-0" },
                        }));
                        const __VLS_132 = __VLS_131({
                            ...{ class: "h-3.5 w-3.5 text-pink-400 shrink-0" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_131));
                        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-pink-400']} */ ;
                        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                            ...{ class: "text-xs font-medium text-foreground" },
                        });
                        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
                        if (plan.allocation_limit) {
                            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                            (plan.allocation_limit);
                        }
                        else {
                            let __VLS_135;
                            /** @ts-ignore @type {typeof __VLS_components.Infinity} */
                            Infinity;
                            // @ts-ignore
                            const __VLS_136 = __VLS_asFunctionalComponent1(__VLS_135, new __VLS_135({
                                ...{ class: "h-3 w-3 inline" },
                            }));
                            const __VLS_137 = __VLS_136({
                                ...{ class: "h-3 w-3 inline" },
                            }, ...__VLS_functionalComponentArgsRest(__VLS_136));
                            /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
                            /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
                            /** @type {__VLS_StyleScopedClasses['inline']} */ ;
                        }
                        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                            ...{ class: "text-[10px] text-muted-foreground" },
                        });
                        /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    }
                    if (__VLS_ctx.expandedPlanId === plan.id && plan.long_description) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "mt-2 text-xs text-muted-foreground bg-muted/20 rounded-lg p-3 leading-relaxed whitespace-pre-line" },
                        });
                        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                        /** @type {__VLS_StyleScopedClasses['bg-muted/20']} */ ;
                        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
                        /** @type {__VLS_StyleScopedClasses['whitespace-pre-line']} */ ;
                        (plan.long_description);
                    }
                }
                else {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2 mb-3" },
                    });
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-muted/20']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
                    let __VLS_140;
                    /** @ts-ignore @type {typeof __VLS_components.Server} */
                    Server;
                    // @ts-ignore
                    const __VLS_141 = __VLS_asFunctionalComponent1(__VLS_140, new __VLS_140({
                        ...{ class: "h-3.5 w-3.5 text-muted-foreground shrink-0" },
                    }));
                    const __VLS_142 = __VLS_141({
                        ...{ class: "h-3.5 w-3.5 text-muted-foreground shrink-0" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_141));
                    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-xs text-muted-foreground" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                }
                if (!plan.can_afford && !plan.is_sold_out) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2 mb-3" },
                    });
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-amber-500/10']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
                    let __VLS_145;
                    /** @ts-ignore @type {typeof __VLS_components.AlertTriangle} */
                    AlertTriangle;
                    // @ts-ignore
                    const __VLS_146 = __VLS_asFunctionalComponent1(__VLS_145, new __VLS_145({
                        ...{ class: "h-3.5 w-3.5 shrink-0" },
                    }));
                    const __VLS_147 = __VLS_146({
                        ...{ class: "h-3.5 w-3.5 shrink-0" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_146));
                    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                    ((plan.price_credits - __VLS_ctx.userCredits).toLocaleString());
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "px-5 pb-5" },
                });
                /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
                /** @type {__VLS_StyleScopedClasses['pb-5']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.shellView === 'subscribe' && __VLS_ctx.planToSubscribe))
                                return;
                            if (!(__VLS_ctx.activeTab === 'browse'))
                                return;
                            if (!!(__VLS_ctx.plansLoading))
                                return;
                            if (!!(__VLS_ctx.filteredPlans.length === 0))
                                return;
                            __VLS_ctx.startSubscribe(plan);
                            // @ts-ignore
                            [userCredits, expandedPlanId, expandedPlanId, expandedPlanId, expandedPlanId, startSubscribe,];
                        } },
                    disabled: (!plan.can_afford || !!plan.is_sold_out),
                    ...{ class: ([
                            'w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                            plan.can_afford && !plan.is_sold_out
                                ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                                : 'bg-muted text-muted-foreground cursor-not-allowed',
                        ]) },
                });
                /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
                let __VLS_150;
                /** @ts-ignore @type {typeof __VLS_components.ShoppingCart} */
                ShoppingCart;
                // @ts-ignore
                const __VLS_151 = __VLS_asFunctionalComponent1(__VLS_150, new __VLS_150({
                    ...{ class: "h-4 w-4" },
                }));
                const __VLS_152 = __VLS_151({
                    ...{ class: "h-4 w-4" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_151));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
                (plan.is_sold_out ? 'Sold Out' : !plan.can_afford ? 'Insufficient Credits' : 'Subscribe Now');
                // @ts-ignore
                [];
            }
        }
    }
    if (__VLS_ctx.activeTab === 'my-subscriptions') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        if (__VLS_ctx.subsLoading) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex justify-center py-20" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-20']} */ ;
            let __VLS_155;
            /** @ts-ignore @type {typeof __VLS_components.Loader2} */
            Loader2;
            // @ts-ignore
            const __VLS_156 = __VLS_asFunctionalComponent1(__VLS_155, new __VLS_155({
                ...{ class: "h-8 w-8 animate-spin text-muted-foreground" },
            }));
            const __VLS_157 = __VLS_156({
                ...{ class: "h-8 w-8 animate-spin text-muted-foreground" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_156));
            /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
            /** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
        }
        else if (__VLS_ctx.subscriptions.length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-center py-20 bg-card border border-border rounded-xl" },
            });
            /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-20']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-card']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
            let __VLS_160;
            /** @ts-ignore @type {typeof __VLS_components.Clock} */
            Clock;
            // @ts-ignore
            const __VLS_161 = __VLS_asFunctionalComponent1(__VLS_160, new __VLS_160({
                ...{ class: "h-12 w-12 mx-auto mb-3 opacity-20" },
            }));
            const __VLS_162 = __VLS_161({
                ...{ class: "h-12 w-12 mx-auto mb-3 opacity-20" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_161));
            /** @type {__VLS_StyleScopedClasses['h-12']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-12']} */ ;
            /** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
            /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-20']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "font-medium text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.shellView === 'subscribe' && __VLS_ctx.planToSubscribe))
                            return;
                        if (!(__VLS_ctx.activeTab === 'my-subscriptions'))
                            return;
                        if (!!(__VLS_ctx.subsLoading))
                            return;
                        if (!(__VLS_ctx.subscriptions.length === 0))
                            return;
                        __VLS_ctx.activeTab = 'browse';
                        // @ts-ignore
                        [subsLoading, activeTab, activeTab, subscriptions,];
                    } },
                ...{ class: "mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-primary-foreground']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:bg-primary/90']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
            let __VLS_165;
            /** @ts-ignore @type {typeof __VLS_components.ShoppingCart} */
            ShoppingCart;
            // @ts-ignore
            const __VLS_166 = __VLS_asFunctionalComponent1(__VLS_165, new __VLS_165({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_167 = __VLS_166({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_166));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "space-y-6" },
            });
            /** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
            if (__VLS_ctx.activeSubscriptions.length > 0) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
                    ...{ class: "text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3" },
                });
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
                /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
                });
                /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
                for (const [sub] of __VLS_vFor((__VLS_ctx.activeSubscriptions))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        key: (sub.id),
                        ...{ class: "bg-card border rounded-xl shadow-sm overflow-hidden" },
                        ...{ class: (sub.status === 'suspended' ? 'border-amber-500/40' : 'border-emerald-500/20') },
                    });
                    /** @type {__VLS_StyleScopedClasses['bg-card']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
                    /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
                    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "p-5" },
                    });
                    /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "flex items-start justify-between gap-2 mb-3" },
                    });
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
                    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
                        ...{ class: "font-semibold text-foreground" },
                    });
                    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
                    (sub.plan_name);
                    if (sub.plan_description) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                            ...{ class: "text-xs text-muted-foreground mt-0.5" },
                        });
                        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                        /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
                        (sub.plan_description);
                    }
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: (['shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border', sub.status === 'active' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30']) },
                    });
                    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    (sub.status.charAt(0).toUpperCase() + sub.status.slice(1));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "grid grid-cols-2 gap-2 mb-3" },
                    });
                    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                    /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "bg-muted/30 rounded-lg px-3 py-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
                    /** @type {__VLS_StyleScopedClasses['mb-0.5']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-sm font-semibold text-foreground" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
                    (sub.price_credits.toLocaleString());
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "text-xs font-normal text-muted-foreground" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-[10px] text-muted-foreground" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    (__VLS_ctx.getPeriodLabel(sub.billing_period_days).toLowerCase());
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "bg-muted/30 rounded-lg px-3 py-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['bg-muted/30']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
                    /** @type {__VLS_StyleScopedClasses['mb-0.5']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-xs font-semibold text-foreground" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
                    (__VLS_ctx.daysUntil(sub.next_renewal_at));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "text-[10px] text-muted-foreground" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    (__VLS_ctx.formatDate(sub.next_renewal_at));
                    if (sub.server_uuid) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2 mb-3" },
                        });
                        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['bg-muted/20']} */ ;
                        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
                        let __VLS_170;
                        /** @ts-ignore @type {typeof __VLS_components.Server} */
                        Server;
                        // @ts-ignore
                        const __VLS_171 = __VLS_asFunctionalComponent1(__VLS_170, new __VLS_170({
                            ...{ class: "h-3.5 w-3.5 text-primary shrink-0" },
                        }));
                        const __VLS_172 = __VLS_171({
                            ...{ class: "h-3.5 w-3.5 text-primary shrink-0" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_171));
                        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
                        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "min-w-0" },
                        });
                        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                            ...{ class: "text-[10px] text-muted-foreground uppercase tracking-wide" },
                        });
                        /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                            ...{ class: "text-xs font-mono text-muted-foreground truncate" },
                        });
                        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                        (sub.server_uuid);
                        let __VLS_175;
                        /** @ts-ignore @type {typeof __VLS_components.CheckCircle2} */
                        CheckCircle2;
                        // @ts-ignore
                        const __VLS_176 = __VLS_asFunctionalComponent1(__VLS_175, new __VLS_175({
                            ...{ class: "h-3.5 w-3.5 text-emerald-400 shrink-0 ml-auto" },
                        }));
                        const __VLS_177 = __VLS_176({
                            ...{ class: "h-3.5 w-3.5 text-emerald-400 shrink-0 ml-auto" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_176));
                        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-emerald-400']} */ ;
                        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                        /** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
                    }
                    if (Number(sub.admin_credits_refunded_total ?? 0) > 0) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "flex items-start gap-2 text-xs text-violet-700 dark:text-violet-300 bg-violet-500/10 rounded-lg px-3 py-2 mb-3 border border-violet-500/20" },
                        });
                        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
                        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-violet-700']} */ ;
                        /** @type {__VLS_StyleScopedClasses['dark:text-violet-300']} */ ;
                        /** @type {__VLS_StyleScopedClasses['bg-violet-500/10']} */ ;
                        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['border']} */ ;
                        /** @type {__VLS_StyleScopedClasses['border-violet-500/20']} */ ;
                        let __VLS_180;
                        /** @ts-ignore @type {typeof __VLS_components.CircleDollarSign} */
                        CircleDollarSign;
                        // @ts-ignore
                        const __VLS_181 = __VLS_asFunctionalComponent1(__VLS_180, new __VLS_180({
                            ...{ class: "h-3.5 w-3.5 shrink-0 mt-0.5" },
                        }));
                        const __VLS_182 = __VLS_181({
                            ...{ class: "h-3.5 w-3.5 shrink-0 mt-0.5" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_181));
                        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                        /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
                        (Number(sub.admin_credits_refunded_total ?? 0).toLocaleString());
                        if (sub.admin_refunded_at) {
                            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                            (__VLS_ctx.formatDate(sub.admin_refunded_at));
                        }
                    }
                    if (sub.status === 'suspended') {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "flex items-start gap-2 text-xs text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2 mb-3" },
                        });
                        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
                        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
                        /** @type {__VLS_StyleScopedClasses['bg-amber-500/10']} */ ;
                        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
                        let __VLS_185;
                        /** @ts-ignore @type {typeof __VLS_components.PauseCircle} */
                        PauseCircle;
                        // @ts-ignore
                        const __VLS_186 = __VLS_asFunctionalComponent1(__VLS_185, new __VLS_185({
                            ...{ class: "h-3.5 w-3.5 shrink-0 mt-0.5" },
                        }));
                        const __VLS_187 = __VLS_186({
                            ...{ class: "h-3.5 w-3.5 shrink-0 mt-0.5" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_186));
                        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                        /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                    }
                    if (sub.status === 'active') {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                            ...{ onClick: (...[$event]) => {
                                    if (!!(__VLS_ctx.shellView === 'subscribe' && __VLS_ctx.planToSubscribe))
                                        return;
                                    if (!(__VLS_ctx.activeTab === 'my-subscriptions'))
                                        return;
                                    if (!!(__VLS_ctx.subsLoading))
                                        return;
                                    if (!!(__VLS_ctx.subscriptions.length === 0))
                                        return;
                                    if (!(__VLS_ctx.activeSubscriptions.length > 0))
                                        return;
                                    if (!(sub.status === 'active'))
                                        return;
                                    __VLS_ctx.confirmCancelSub(sub);
                                    // @ts-ignore
                                    [getPeriodLabel, activeSubscriptions, activeSubscriptions, daysUntil, formatDate, formatDate, confirmCancelSub,];
                                } },
                            ...{ class: "w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/15 transition-colors" },
                        });
                        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                        /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
                        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                        /** @type {__VLS_StyleScopedClasses['border']} */ ;
                        /** @type {__VLS_StyleScopedClasses['border-red-500/30']} */ ;
                        /** @type {__VLS_StyleScopedClasses['bg-red-500/5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
                        /** @type {__VLS_StyleScopedClasses['hover:bg-red-500/15']} */ ;
                        /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
                        let __VLS_190;
                        /** @ts-ignore @type {typeof __VLS_components.XCircle} */
                        XCircle;
                        // @ts-ignore
                        const __VLS_191 = __VLS_asFunctionalComponent1(__VLS_190, new __VLS_190({
                            ...{ class: "h-3.5 w-3.5" },
                        }));
                        const __VLS_192 = __VLS_191({
                            ...{ class: "h-3.5 w-3.5" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_191));
                        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                    }
                    // @ts-ignore
                    [];
                }
            }
            if (__VLS_ctx.pastSubscriptions.length > 0) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
                    ...{ class: "text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3" },
                });
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
                /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "bg-card border border-border rounded-xl shadow-sm overflow-hidden" },
                });
                /** @type {__VLS_StyleScopedClasses['bg-card']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
                /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
                    ...{ class: "w-full text-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                    ...{ class: "border-b border-border bg-muted/40" },
                });
                /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-muted/40']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                    ...{ class: "text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide" },
                });
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                    ...{ class: "text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell" },
                });
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
                /** @type {__VLS_StyleScopedClasses['hidden']} */ ;
                /** @type {__VLS_StyleScopedClasses['md:table-cell']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                    ...{ class: "text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide" },
                });
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                    ...{ class: "text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell" },
                });
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
                /** @type {__VLS_StyleScopedClasses['hidden']} */ ;
                /** @type {__VLS_StyleScopedClasses['sm:table-cell']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({
                    ...{ class: "divide-y divide-border opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
                /** @type {__VLS_StyleScopedClasses['divide-border']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                for (const [sub] of __VLS_vFor((__VLS_ctx.pastSubscriptions))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                        key: (sub.id),
                        ...{ class: "hover:opacity-90 transition-opacity" },
                    });
                    /** @type {__VLS_StyleScopedClasses['hover:opacity-90']} */ ;
                    /** @type {__VLS_StyleScopedClasses['transition-opacity']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                        ...{ class: "px-4 py-3 font-medium" },
                    });
                    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                    (sub.plan_name);
                    if (Number(sub.admin_credits_refunded_total ?? 0) > 0) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "mt-1 flex items-center gap-1 text-[10px] font-normal text-violet-600 dark:text-violet-400" },
                        });
                        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                        /** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-violet-600']} */ ;
                        /** @type {__VLS_StyleScopedClasses['dark:text-violet-400']} */ ;
                        let __VLS_195;
                        /** @ts-ignore @type {typeof __VLS_components.CircleDollarSign} */
                        CircleDollarSign;
                        // @ts-ignore
                        const __VLS_196 = __VLS_asFunctionalComponent1(__VLS_195, new __VLS_195({
                            ...{ class: "h-3 w-3 shrink-0" },
                        }));
                        const __VLS_197 = __VLS_196({
                            ...{ class: "h-3 w-3 shrink-0" },
                        }, ...__VLS_functionalComponentArgsRest(__VLS_196));
                        /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                        (Number(sub.admin_credits_refunded_total ?? 0).toLocaleString());
                    }
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                        ...{ class: "px-4 py-3 text-muted-foreground text-xs hidden md:table-cell" },
                    });
                    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['hidden']} */ ;
                    /** @type {__VLS_StyleScopedClasses['md:table-cell']} */ ;
                    (sub.price_credits.toLocaleString());
                    (__VLS_ctx.getPeriodLabel(sub.billing_period_days));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                        ...{ class: "px-4 py-3" },
                    });
                    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "inline-flex px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400 border border-red-500/30" },
                    });
                    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-red-500/15']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-red-500/30']} */ ;
                    (sub.status.charAt(0).toUpperCase() + sub.status.slice(1));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                        ...{ class: "px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell" },
                    });
                    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                    /** @type {__VLS_StyleScopedClasses['hidden']} */ ;
                    /** @type {__VLS_StyleScopedClasses['sm:table-cell']} */ ;
                    (__VLS_ctx.formatDate(sub.cancelled_at ?? sub.created_at));
                    // @ts-ignore
                    [getPeriodLabel, formatDate, pastSubscriptions, pastSubscriptions,];
                }
            }
        }
    }
}
let __VLS_200;
/** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_201 = __VLS_asFunctionalComponent1(__VLS_200, new __VLS_200({
    to: "body",
}));
const __VLS_202 = __VLS_201({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_201));
const { default: __VLS_205 } = __VLS_203.slots;
if (__VLS_ctx.showCancelConfirm && __VLS_ctx.subToCancel) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCancelConfirm && __VLS_ctx.subToCancel))
                    return;
                __VLS_ctx.showCancelConfirm = false;
                // @ts-ignore
                [showCancelConfirm, showCancelConfirm, subToCancel,];
            } },
        ...{ class: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" },
    });
    /** @type {__VLS_StyleScopedClasses['fixed']} */ ;
    /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-50']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-black/70']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "px-6 py-4 border-b border-border" },
    });
    /** @type {__VLS_StyleScopedClasses['px-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "text-base font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "p-6" },
    });
    /** @type {__VLS_StyleScopedClasses['p-6']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-muted-foreground mb-5" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    /** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
        ...{ class: "text-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
    (__VLS_ctx.subToCancel.plan_name);
    if (__VLS_ctx.subToCancel.server_uuid) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "block mt-2 text-amber-500" },
        });
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCancelConfirm && __VLS_ctx.subToCancel))
                    return;
                __VLS_ctx.showCancelConfirm = false;
                // @ts-ignore
                [showCancelConfirm, subToCancel, subToCancel,];
            } },
        ...{ class: "flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors" },
    });
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-border']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-accent']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.executeCancelSub) },
        disabled: (__VLS_ctx.subsLoading),
        ...{ class: "flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60 transition-colors" },
    });
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-red-500']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-white']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-red-600']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:opacity-60']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
    if (__VLS_ctx.subsLoading) {
        let __VLS_206;
        /** @ts-ignore @type {typeof __VLS_components.Loader2} */
        Loader2;
        // @ts-ignore
        const __VLS_207 = __VLS_asFunctionalComponent1(__VLS_206, new __VLS_206({
            ...{ class: "h-4 w-4 animate-spin" },
        }));
        const __VLS_208 = __VLS_207({
            ...{ class: "h-4 w-4 animate-spin" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_207));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
    }
}
// @ts-ignore
[subsLoading, subsLoading, executeCancelSub,];
var __VLS_203;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
