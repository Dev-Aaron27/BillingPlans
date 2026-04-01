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

use App\Plugins\PluginSettings;

class SettingsHelper
{
    private const PLUGIN = 'billingplans';

    /** Whether to actually suspend the linked server on Wings when a renewal fails. */
    public static function getSuspendServers(): bool
    {
        return self::get('suspend_servers', 'true') === 'true';
    }

    public static function setSuspendServers(bool $value): void
    {
        self::set('suspend_servers', $value ? 'true' : 'false');
    }

    /** Whether to unsuspend the linked server on Wings when a subscription is successfully renewed. */
    public static function getUnsuspendOnRenewal(): bool
    {
        return self::get('unsuspend_on_renewal', 'true') === 'true';
    }

    public static function setUnsuspendOnRenewal(bool $value): void
    {
        self::set('unsuspend_on_renewal', $value ? 'true' : 'false');
    }

    /**
     * Number of days of grace period after a failed renewal before suspension.
     * 0 means suspend immediately on first failure.
     */
    public static function getGracePeriodDays(): int
    {
        return max(0, (int) self::get('grace_period_days', '0'));
    }

    public static function setGracePeriodDays(int $days): void
    {
        self::set('grace_period_days', (string) max(0, $days));
    }

    /**
     * Number of days after suspension before auto-cancellation.
     * 0 means never auto-cancel.
     */
    public static function getTerminationDays(): int
    {
        return max(0, (int) self::get('termination_days', '0'));
    }

    public static function setTerminationDays(int $days): void
    {
        self::set('termination_days', (string) max(0, $days));
    }

    /** Send email to user when their subscription is suspended. */
    public static function getSendSuspensionEmail(): bool
    {
        return self::get('send_suspension_email', 'true') === 'true';
    }

    public static function setSendSuspensionEmail(bool $value): void
    {
        self::set('send_suspension_email', $value ? 'true' : 'false');
    }

    /** Allow users to cancel their own subscriptions. */
    public static function getAllowUserCancellation(): bool
    {
        return self::get('allow_user_cancellation', 'true') === 'true';
    }

    public static function setAllowUserCancellation(bool $value): void
    {
        self::set('allow_user_cancellation', $value ? 'true' : 'false');
    }

    /** Send email to user when their subscription is auto-terminated. */
    public static function getSendTerminationEmail(): bool
    {
        return self::get('send_termination_email', 'true') === 'true';
    }

    public static function setSendTerminationEmail(bool $value): void
    {
        self::set('send_termination_email', $value ? 'true' : 'false');
    }

    /**
     * Whether to generate a billingcore invoice on plan purchase and renewal.
     * Requires billingcore to be installed.
     */
    public static function getGenerateInvoices(): bool
    {
        return self::get('generate_invoices', 'true') === 'true';
    }

    public static function setGenerateInvoices(bool $value): void
    {
        self::set('generate_invoices', $value ? 'true' : 'false');
    }

    /** Return all settings as an array for the API. */
    public static function getAllSettings(): array
    {
        return [
            'suspend_servers' => self::getSuspendServers(),
            'unsuspend_on_renewal' => self::getUnsuspendOnRenewal(),
            'grace_period_days' => self::getGracePeriodDays(),
            'termination_days' => self::getTerminationDays(),
            'send_suspension_email' => self::getSendSuspensionEmail(),
            'send_termination_email' => self::getSendTerminationEmail(),
            'allow_user_cancellation' => self::getAllowUserCancellation(),
            'generate_invoices' => self::getGenerateInvoices(),
        ];
    }

    private static function get(string $key, string $default): string
    {
        $value = PluginSettings::getSetting(self::PLUGIN, $key);

        return ($value !== null && $value !== '') ? $value : $default;
    }

    private static function set(string $key, string $value): void
    {
        PluginSettings::setSetting(self::PLUGIN, $key, $value);
    }
}
