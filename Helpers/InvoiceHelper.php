<?php

/*
 * This file is part of FeatherPanel.
 *
 * Copyright (C) 2025 MythicalSystems Studios
 * Copyright (C) 2025 FeatherPanel Contributors
 * Copyright (C) 2025 Cassian Gherman (aka NaysKutzu)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * See the LICENSE file or <https://www.gnu.org/licenses/>.
 */

namespace App\Addons\billingplans\Helpers;

use App\App;
use App\Addons\billingcore\Helpers\BillingHelper;
use App\Addons\billingcore\Helpers\CurrencyHelper;

/**
 * Thin wrapper around billingcore's BillingHelper to generate
 * invoices for billingplans purchase and renewal events.
 */
class InvoiceHelper
{
    /**
     * Create a "paid" invoice for an initial plan purchase.
     *
     * @param int $userId The purchasing user's ID
     * @param int $planId The plan ID
     * @param string $planName Human-readable plan name
     * @param int $subscriptionId The new subscription ID
     * @param int $priceCredits Credits charged
     * @param int $periodDays Billing period length
     */
    public static function createPurchaseInvoice(
        int $userId,
        int $planId,
        string $planName,
        int $subscriptionId,
        int $priceCredits,
        int $periodDays,
    ): ?array {
        if (!SettingsHelper::getGenerateInvoices()) {
            return null;
        }

        try {
            $currency = CurrencyHelper::getDefaultCurrency();
            $currencyCode = $currency['code'] ?? 'EUR';

            $periodLabel = self::periodLabel($periodDays);

            $invoiceData = [
                'status' => 'paid',
                'paid_at' => date('Y-m-d H:i:s'),
                'due_date' => date('Y-m-d'),
                'currency_code' => $currencyCode,
                'notes' => "Plan purchase for subscription #$subscriptionId. Amount is denominated in credits, not real currency.",
            ];

            $itemsData = [
                [
                    'description' => "Plan: $planName — Initial Purchase ($periodLabel)",
                    'quantity' => 1.00,
                    'unit_price' => (float) $priceCredits,
                    'total' => (float) $priceCredits,
                ],
            ];

            return BillingHelper::createInvoiceWithItems($userId, $invoiceData, $itemsData);
        } catch (\Throwable $e) {
            App::getInstance(false, true)->getLogger()->error(
                "BillingPlans InvoiceHelper: Failed to create purchase invoice for user #$userId plan #$planId: " . $e->getMessage()
            );

            return null;
        }
    }

    /**
     * Create a "paid" invoice for an automatic subscription renewal.
     *
     * @param int $userId The user's ID
     * @param int $subscriptionId The subscription ID
     * @param string $planName Human-readable plan name
     * @param int $priceCredits Credits charged
     * @param int $periodDays Billing period length
     * @param string $nextRenewal Next renewal date string
     */
    public static function createRenewalInvoice(
        int $userId,
        int $subscriptionId,
        string $planName,
        int $priceCredits,
        int $periodDays,
        string $nextRenewal,
    ): ?array {
        if (!SettingsHelper::getGenerateInvoices()) {
            return null;
        }

        try {
            $currency = CurrencyHelper::getDefaultCurrency();
            $currencyCode = $currency['code'] ?? 'EUR';

            $periodLabel = self::periodLabel($periodDays);

            $invoiceData = [
                'status' => 'paid',
                'paid_at' => date('Y-m-d H:i:s'),
                'due_date' => date('Y-m-d'),
                'currency_code' => $currencyCode,
                'notes' => "Automatic renewal for subscription #$subscriptionId. Next renewal: $nextRenewal. Amount is denominated in credits, not real currency.",
            ];

            $itemsData = [
                [
                    'description' => "Plan: $planName — Renewal ($periodLabel)",
                    'quantity' => 1.00,
                    'unit_price' => (float) $priceCredits,
                    'total' => (float) $priceCredits,
                ],
            ];

            return BillingHelper::createInvoiceWithItems($userId, $invoiceData, $itemsData);
        } catch (\Throwable $e) {
            App::getInstance(false, true)->getLogger()->error(
                "BillingPlans InvoiceHelper: Failed to create renewal invoice for user #$userId subscription #$subscriptionId: " . $e->getMessage()
            );

            return null;
        }
    }

    private static function periodLabel(int $days): string
    {
        $map = [
            1 => 'Daily', 7 => 'Weekly', 14 => 'Bi-Weekly',
            30 => 'Monthly', 90 => 'Quarterly', 180 => 'Semi-Annual', 365 => 'Annual',
        ];

        return $map[$days] ?? "Every {$days} days";
    }
}
