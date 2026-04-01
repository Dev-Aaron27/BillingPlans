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

namespace App\Addons\billingplans;

use App\App;
use App\Chat\Activity;
use App\Plugins\AppPlugin;
use App\CloudFlare\CloudFlareRealIP;
use App\Plugins\Events\Events\ServerEvent;
use App\Addons\billingplans\Chat\Subscription;

class BillingPlans implements AppPlugin
{
    public static function processEvents(\App\Plugins\PluginEvents $event): void
    {
        // Sync billing-plan subscription status when the panel suspends/unsuspends the linked server
        // (see featherpanel:server:suspended / featherpanel:server:unsuspended).
        // server_suspend_sync=1 means we suspended the sub because of a panel server suspend — only then do we
        // auto-reactivate on server unsuspend (billing-driven suspensions stay until renewal).

        $event->on(ServerEvent::onServerSuspended(), function (array $server, $suspendedBy): void {
            $uuid = isset($server['uuid']) ? trim((string) $server['uuid']) : '';
            if ($uuid === '') {
                return;
            }

            $logger = App::getInstance(false, true)->getLogger();
            foreach (Subscription::getAllByServerUuid($uuid) as $sub) {
                if (($sub['status'] ?? '') !== 'active') {
                    continue;
                }
                $subId = (int) $sub['id'];
                if (Subscription::update($subId, [
                    'status' => 'suspended',
                    'suspended_at' => date('Y-m-d H:i:s'),
                    'server_suspend_sync' => 1,
                ])) {
                    $logger->info("BillingPlans: Subscription #{$subId} suspended (panel server suspended, uuid {$uuid}).");
                }
            }
        });

        $event->on(ServerEvent::onServerUnsuspended(), function (array $server, $unsuspendedBy): void {
            $uuid = isset($server['uuid']) ? trim((string) $server['uuid']) : '';
            if ($uuid === '') {
                return;
            }

            $logger = App::getInstance(false, true)->getLogger();
            foreach (Subscription::getAllByServerUuid($uuid) as $sub) {
                if (($sub['status'] ?? '') !== 'suspended' || empty($sub['server_suspend_sync'])) {
                    continue;
                }
                $subId = (int) $sub['id'];
                if (Subscription::update($subId, [
                    'status' => 'active',
                    'suspended_at' => null,
                    'server_suspend_sync' => 0,
                ])) {
                    $logger->info("BillingPlans: Subscription #{$subId} reactivated (panel server unsuspended, uuid {$uuid}).");
                }
            }
        });

        // When a server is removed from the panel, cancel any billing-plan subscription that owned it.
        // Payload from emit() is array_values([ server, deleted_by, ... ]) — see PluginEvents::emit().
        $event->on(ServerEvent::onServerDeleted(), function (array $server, $deletedBy = null): void {
            $uuid = isset($server['uuid']) ? trim((string) $server['uuid']) : '';
            if ($uuid === '') {
                return;
            }

            $subs = Subscription::getAllByServerUuid($uuid);
            if ($subs === []) {
                return;
            }

            $closedIds = [];
            $clearedIds = [];
            $logger = App::getInstance(false, true)->getLogger();

            foreach ($subs as $sub) {
                $subId = (int) $sub['id'];
                $status = (string) ($sub['status'] ?? '');

                if (in_array($status, ['cancelled', 'expired'], true)) {
                    if (!empty($sub['server_uuid'])) {
                        if (Subscription::update($subId, [
                            'server_uuid' => null,
                            'server_suspend_sync' => 0,
                        ])) {
                            $clearedIds[] = $subId;
                        }
                    }

                    continue;
                }

                if (Subscription::update($subId, [
                    'status' => 'cancelled',
                    'cancelled_at' => date('Y-m-d H:i:s'),
                    'server_uuid' => null,
                    'server_suspend_sync' => 0,
                    'suspended_at' => null,
                    'grace_started_at' => null,
                ])) {
                    $closedIds[] = $subId;
                    $logger->info("BillingPlans: Subscription #{$subId} cancelled (linked server deleted, uuid {$uuid}).");
                }
            }

            if ($closedIds !== [] || $clearedIds !== []) {
                $label = (string) ($server['name'] ?? 'Unknown server');
                $parts = [];
                if ($closedIds !== []) {
                    $parts[] = 'cancelled subscription #' . implode(', #', array_map('strval', $closedIds));
                }
                if ($clearedIds !== []) {
                    $parts[] = 'cleared stale server link on subscription #' . implode(', #', array_map('strval', $clearedIds));
                }
                Activity::createActivity([
                    'user_uuid' => is_array($deletedBy) ? ($deletedBy['uuid'] ?? null) : null,
                    'name' => 'billingplans_subscriptions_closed_server_deleted',
                    'context' => "BillingPlans: server deleted ({$label}, uuid {$uuid}) — " . implode('; ', $parts) . '.',
                    'ip_address' => CloudFlareRealIP::getRealIP(),
                ]);
            }
        });
    }

    public static function pluginInstall(): void
    {
        // Tables are created via Migrations/
    }

    public static function pluginUpdate(?string $oldVersion, ?string $newVersion): void
    {
        // Migration logic handled by the migration system
    }

    public static function pluginUninstall(): void
    {
        // Cleanup handled externally if needed
    }
}
