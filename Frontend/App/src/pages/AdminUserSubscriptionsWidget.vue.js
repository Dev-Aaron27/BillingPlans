import { ref, onMounted } from "vue";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Receipt, Server, CalendarClock, ExternalLink } from "lucide-vue-next";
import axios from "axios";
function parseUserIdFromSearch() {
    const raw = new URLSearchParams(window.location.search).get("userId");
    if (!raw)
        return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}
const userId = ref(parseUserIdFromSearch());
const loading = ref(true);
const loadError = ref(null);
const subscriptions = ref([]);
const username = ref("");
const formatDate = (v) => {
    if (!v)
        return "—";
    return new Date(v).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};
const periodLabel = (days) => {
    if (!days)
        return "—";
    if (days === 30 || days === 31)
        return "Monthly";
    if (days === 90)
        return "Quarterly";
    if (days === 180)
        return "Semi-annual";
    if (days === 365 || days === 366)
        return "Yearly";
    return `${days}d`;
};
const statusVariant = (s) => {
    switch (s) {
        case "active": return "default";
        case "suspended": return "secondary";
        case "cancelled": return "destructive";
        case "expired": return "outline";
        default: return "outline";
    }
};
const statusLabel = (s) => {
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
    }
    catch (e) {
        const msg = e?.response?.data?.message;
        loadError.value = msg ?? "Failed to load subscriptions";
    }
    finally {
        loading.value = false;
    }
}
onMounted(() => load());
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "p-4 md:p-5 text-foreground" },
});
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:p-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-foreground']} */ ;
if (__VLS_ctx.userId == null) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-border/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    (__VLS_ctx.loadError || "No user id in widget context.");
}
else if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-center gap-2 py-16 text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-16']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    let __VLS_0;
    /** @ts-ignore @type {typeof __VLS_components.Loader2} */
    Loader2;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ class: "h-6 w-6 animate-spin" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "h-6 w-6 animate-spin" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
}
else if (__VLS_ctx.loadError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-destructive/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-destructive/5']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-destructive']} */ ;
    (__VLS_ctx.loadError);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-4" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center justify-between gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2 text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    let __VLS_5;
    /** @ts-ignore @type {typeof __VLS_components.Receipt} */
    Receipt;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        ...{ class: "h-4 w-4 shrink-0" },
    }));
    const __VLS_7 = __VLS_6({
        ...{ class: "h-4 w-4 shrink-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs font-semibold uppercase tracking-wide" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs text-muted-foreground" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    (__VLS_ctx.subscriptions.length);
    (__VLS_ctx.subscriptions.length !== 1 ? 's' : '');
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        href: "/admin/billingplans",
        target: "_blank",
        rel: "noopener noreferrer",
        ...{ class: "inline-flex h-8 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-xs hover:bg-accent" },
    });
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-input']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-background']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-accent']} */ ;
    let __VLS_10;
    /** @ts-ignore @type {typeof __VLS_components.ExternalLink} */
    ExternalLink;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
        ...{ class: "h-3.5 w-3.5 opacity-70" },
    }));
    const __VLS_12 = __VLS_11({
        ...{ class: "h-3.5 w-3.5 opacity-70" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    if (__VLS_ctx.subscriptions.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-dashed border-border/50 py-10 text-center text-sm text-muted-foreground" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-border/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-10']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "space-y-3" },
        });
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        for (const [sub] of __VLS_vFor((__VLS_ctx.subscriptions))) {
            let __VLS_15;
            /** @ts-ignore @type {typeof __VLS_components.Card | typeof __VLS_components.Card} */
            Card;
            // @ts-ignore
            const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
                key: (sub.id),
                ...{ class: "border-border/60 bg-card/40 p-4" },
            }));
            const __VLS_17 = __VLS_16({
                key: (sub.id),
                ...{ class: "border-border/60 bg-card/40 p-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_16));
            /** @type {__VLS_StyleScopedClasses['border-border/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-card/40']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
            const { default: __VLS_20 } = __VLS_18.slots;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-start justify-between gap-2 mb-3" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "font-medium text-sm" },
            });
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            (sub.plan_name ?? `Plan #${sub.plan_id}`);
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "text-xs text-muted-foreground" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
            (sub.id);
            if (sub.price_credits != null) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (sub.price_credits);
                (__VLS_ctx.periodLabel(sub.billing_period_days));
            }
            let __VLS_21;
            /** @ts-ignore @type {typeof __VLS_components.Badge | typeof __VLS_components.Badge} */
            Badge;
            // @ts-ignore
            const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
                variant: (__VLS_ctx.statusVariant(sub.status)),
                ...{ class: "capitalize text-[11px]" },
            }));
            const __VLS_23 = __VLS_22({
                variant: (__VLS_ctx.statusVariant(sub.status)),
                ...{ class: "capitalize text-[11px]" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_22));
            /** @type {__VLS_StyleScopedClasses['capitalize']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            const { default: __VLS_26 } = __VLS_24.slots;
            (__VLS_ctx.statusLabel(sub.status));
            // @ts-ignore
            [userId, loadError, loadError, loadError, loading, subscriptions, subscriptions, subscriptions, subscriptions, periodLabel, statusVariant, statusLabel,];
            var __VLS_24;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2" },
            });
            /** @type {__VLS_StyleScopedClasses['grid']} */ ;
            /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
            if (sub.server_uuid) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex items-center gap-1.5 text-muted-foreground" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                let __VLS_27;
                /** @ts-ignore @type {typeof __VLS_components.Server} */
                Server;
                // @ts-ignore
                const __VLS_28 = __VLS_asFunctionalComponent1(__VLS_27, new __VLS_27({
                    ...{ class: "h-3.5 w-3.5 shrink-0" },
                }));
                const __VLS_29 = __VLS_28({
                    ...{ class: "h-3.5 w-3.5 shrink-0" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_28));
                /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "font-mono break-all text-foreground/80" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-foreground/80']} */ ;
                (sub.server_uuid);
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex items-center gap-1.5 text-muted-foreground" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                let __VLS_32;
                /** @ts-ignore @type {typeof __VLS_components.Server} */
                Server;
                // @ts-ignore
                const __VLS_33 = __VLS_asFunctionalComponent1(__VLS_32, new __VLS_32({
                    ...{ class: "h-3.5 w-3.5 shrink-0" },
                }));
                const __VLS_34 = __VLS_33({
                    ...{ class: "h-3.5 w-3.5 shrink-0" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_33));
                /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "italic" },
                });
                /** @type {__VLS_StyleScopedClasses['italic']} */ ;
            }
            if (sub.status === 'active' && sub.next_renewal_at) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex items-center gap-1.5 text-muted-foreground" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                let __VLS_37;
                /** @ts-ignore @type {typeof __VLS_components.CalendarClock} */
                CalendarClock;
                // @ts-ignore
                const __VLS_38 = __VLS_asFunctionalComponent1(__VLS_37, new __VLS_37({
                    ...{ class: "h-3.5 w-3.5 shrink-0" },
                }));
                const __VLS_39 = __VLS_38({
                    ...{ class: "h-3.5 w-3.5 shrink-0" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_38));
                /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_ctx.formatDate(sub.next_renewal_at));
            }
            else if (sub.status === 'suspended' && sub.suspended_at) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex items-center gap-1.5 text-muted-foreground" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                let __VLS_42;
                /** @ts-ignore @type {typeof __VLS_components.CalendarClock} */
                CalendarClock;
                // @ts-ignore
                const __VLS_43 = __VLS_asFunctionalComponent1(__VLS_42, new __VLS_42({
                    ...{ class: "h-3.5 w-3.5 shrink-0" },
                }));
                const __VLS_44 = __VLS_43({
                    ...{ class: "h-3.5 w-3.5 shrink-0" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_43));
                /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_ctx.formatDate(sub.suspended_at));
            }
            else if (sub.status === 'cancelled' && sub.cancelled_at) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex items-center gap-1.5 text-muted-foreground" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                let __VLS_47;
                /** @ts-ignore @type {typeof __VLS_components.CalendarClock} */
                CalendarClock;
                // @ts-ignore
                const __VLS_48 = __VLS_asFunctionalComponent1(__VLS_47, new __VLS_47({
                    ...{ class: "h-3.5 w-3.5 shrink-0" },
                }));
                const __VLS_49 = __VLS_48({
                    ...{ class: "h-3.5 w-3.5 shrink-0" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_48));
                /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_ctx.formatDate(sub.cancelled_at));
            }
            else if (sub.next_renewal_at) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex items-center gap-1.5 text-muted-foreground" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-muted-foreground']} */ ;
                let __VLS_52;
                /** @ts-ignore @type {typeof __VLS_components.CalendarClock} */
                CalendarClock;
                // @ts-ignore
                const __VLS_53 = __VLS_asFunctionalComponent1(__VLS_52, new __VLS_52({
                    ...{ class: "h-3.5 w-3.5 shrink-0" },
                }));
                const __VLS_54 = __VLS_53({
                    ...{ class: "h-3.5 w-3.5 shrink-0" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_53));
                /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_ctx.formatDate(sub.next_renewal_at));
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "text-[10px] text-muted-foreground/60 mt-2" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-muted-foreground/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            (__VLS_ctx.formatDate(sub.created_at));
            // @ts-ignore
            [formatDate, formatDate, formatDate, formatDate, formatDate,];
            var __VLS_18;
            // @ts-ignore
            [];
        }
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
