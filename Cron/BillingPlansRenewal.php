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

namespace App\Addons\billingplans\Cron;

use App\App;
use App\Chat\Node;
use App\Chat\User;
use App\Cron\Cron;
use App\Chat\Server;
use App\Cron\TimeTask;
use App\Chat\TimedTask;
use App\Chat\Allocation;
use App\Services\Wings\Wings;
use App\Config\ConfigInterface;
use App\Cli\Utils\MinecraftColorCodeSupport;
use App\Addons\billingplans\Chat\Subscription;
use App\Addons\billingcore\Helpers\CreditsHelper;
use App\Addons\billingplans\Helpers\InvoiceHelper;
use App\Addons\billingplans\Helpers\SettingsHelper;
use App\Addons\billingplans\Mail\SubscriptionSuspended;
use App\Addons\billingplans\Mail\SubscriptionTerminated;

class BillingPlansRenewal implements TimeTask
{
    public function run(): void
    {
        $cron = new Cron('billingplans-renewal', '1M');
        $force = true;
        try {
            $cron->runIfDue(function () {
                $startTime = microtime(true);

                $this->banner();
                $renewStats = $this->processRenewals();
                $termStats = $this->processTerminations();
                $cancelStats = $this->processCancellations();

                $elapsed = round(microtime(true) - $startTime, 2);
                $this->summary($renewStats, $termStats, $cancelStats, $elapsed);

                TimedTask::markRun('billingplans-renewal', true, 'BillingPlans renewal heartbeat');
            }, $force);
        } catch (\Exception $e) {
            $app = App::getInstance(false, true);
            $app->getLogger()->error('BillingPlansRenewal cron failed: ' . $e->getMessage());
            TimedTask::markRun('billingplans-renewal', false, $e->getMessage());
            MinecraftColorCodeSupport::sendOutputWithNewLine('&4[BillingPlans] &cFATAL ERROR: ' . $e->getMessage());
        }
    }

    private function banner(): void
    {
        $now = date('Y-m-d H:i:s');
        MinecraftColorCodeSupport::sendOutputWithNewLine('');
        MinecraftColorCodeSupport::sendOutputWithNewLine('&8&m                                                  ');
        MinecraftColorCodeSupport::sendOutputWithNewLine('&b  BillingPlans &7» &fRenewal / Termination Cycle');
        MinecraftColorCodeSupport::sendOutputWithNewLine("&8  Started at &7$now");
        MinecraftColorCodeSupport::sendOutputWithNewLine('&8&m                                                  ');
        MinecraftColorCodeSupport::sendOutputWithNewLine('');
    }

    private function summary(array $renew, array $term, array $cancel, float $elapsed): void
    {
        MinecraftColorCodeSupport::sendOutputWithNewLine('');
        MinecraftColorCodeSupport::sendOutputWithNewLine('&8&m                                                  ');
        MinecraftColorCodeSupport::sendOutputWithNewLine('&b  Cycle Summary');
        MinecraftColorCodeSupport::sendOutputWithNewLine('');
        MinecraftColorCodeSupport::sendOutputWithNewLine("&7  Renewals checked    :  &f{$renew['total']}");
        MinecraftColorCodeSupport::sendOutputWithNewLine("&a    ✔ Renewed          :  &f{$renew['renewed']}");
        MinecraftColorCodeSupport::sendOutputWithNewLine("&e    ⏳ In grace period  :  &f{$renew['grace']}");
        MinecraftColorCodeSupport::sendOutputWithNewLine("&6    ⏸ Suspended        :  &f{$renew['suspended']}");
        MinecraftColorCodeSupport::sendOutputWithNewLine("&c    ✘ Errors           :  &f{$renew['errors']}");
        MinecraftColorCodeSupport::sendOutputWithNewLine('');
        MinecraftColorCodeSupport::sendOutputWithNewLine("&7  Terminations checked:  &f{$term['checked']}");
        MinecraftColorCodeSupport::sendOutputWithNewLine("&c    ✘ Auto-cancelled   :  &f{$term['terminated']}");
        MinecraftColorCodeSupport::sendOutputWithNewLine("&e    🗄 Servers actioned :  &f{$term['servers_actioned']}");
        MinecraftColorCodeSupport::sendOutputWithNewLine('');
        MinecraftColorCodeSupport::sendOutputWithNewLine("&7  Cancellation expiry :  &f{$cancel['checked']}");
        MinecraftColorCodeSupport::sendOutputWithNewLine("&c    ✘ Servers removed  :  &f{$cancel['servers_actioned']}");
        MinecraftColorCodeSupport::sendOutputWithNewLine('');
        MinecraftColorCodeSupport::sendOutputWithNewLine("&8  Completed in &f{$elapsed}s");
        MinecraftColorCodeSupport::sendOutputWithNewLine('&8&m                                                  ');
        MinecraftColorCodeSupport::sendOutputWithNewLine('');
    }

    private function processRenewals(): array
    {
        $stats = ['total' => 0, 'renewed' => 0, 'suspended' => 0, 'grace' => 0, 'errors' => 0];
        $app = App::getInstance(false, true);

        MinecraftColorCodeSupport::sendOutputWithNewLine('&8[Renewals] &7Fetching subscriptions due for renewal...');

        $dueSubscriptions = Subscription::getDueForRenewal();
        $stats['total'] = count($dueSubscriptions);

        if ($stats['total'] === 0) {
            MinecraftColorCodeSupport::sendOutputWithNewLine('&8[Renewals] &7No subscriptions due — nothing to do.');

            return $stats;
        }

        MinecraftColorCodeSupport::sendOutputWithNewLine("&8[Renewals] &f{$stats['total']} &7subscription(s) due for renewal.");
        MinecraftColorCodeSupport::sendOutputWithNewLine('');

        foreach ($dueSubscriptions as $subscription) {
            try {
                $result = $this->renewSubscription($subscription, $app);
                ++$stats[$result];
            } catch (\Exception $e) {
                ++$stats['errors'];
                $subId = $subscription['id'] ?? '?';
                $app->getLogger()->error("BillingPlans: Renewal failed for subscription #$subId: " . $e->getMessage());
                MinecraftColorCodeSupport::sendOutputWithNewLine("&c  [#$subId] Exception: " . $e->getMessage());
            }
        }

        return $stats;
    }

    /**
     * Returns 'renewed' | 'suspended' | 'grace' | 'errors'.
     */
    private function renewSubscription(array $subscription, App $app): string
    {
        $subId = (int) $subscription['id'];
        $userId = (int) $subscription['user_id'];
        $planName = $subscription['plan_name'] ?? 'Unknown Plan';
        $priceCredits = (int) ($subscription['price_credits'] ?? 0);
        $periodDays = (int) ($subscription['billing_period_days'] ?? 30);
        $serverUuid = $subscription['server_uuid'] ?? null;
        $wasSuspended = $subscription['status'] === 'suspended';

        MinecraftColorCodeSupport::sendOutputWithNewLine(
            "&8  [#$subId] &7Plan: &f$planName &8| &7User: &f#$userId &8| &7Cost: &f$priceCredits cr"
        );

        $currentBalance = CreditsHelper::getUserCredits($userId);

        if ($currentBalance < $priceCredits) {
            $shortage = $priceCredits - $currentBalance;
            $gracePeriodDays = SettingsHelper::getGracePeriodDays();

            if ($gracePeriodDays > 0 && !empty($subscription['grace_started_at'])) {
                $graceEnd = strtotime($subscription['grace_started_at']) + ($gracePeriodDays * 86400);
                if (time() < $graceEnd) {
                    $remaining = (int) ceil(($graceEnd - time()) / 86400);
                    MinecraftColorCodeSupport::sendOutputWithNewLine(
                        "&e  [#$subId] ⏳ Grace period active — {$remaining}d remaining (short {$shortage} cr)"
                    );

                    return 'grace';
                }
            } elseif ($gracePeriodDays > 0 && empty($subscription['grace_started_at'])) {
                Subscription::update($subId, ['grace_started_at' => date('Y-m-d H:i:s')]);
                MinecraftColorCodeSupport::sendOutputWithNewLine(
                    "&e  [#$subId] ⏳ Insufficient credits (short {$shortage} cr) — grace period started ({$gracePeriodDays}d)"
                );

                return 'grace';
            }

            MinecraftColorCodeSupport::sendOutputWithNewLine(
                "&6  [#$subId] ⏸ Suspending — balance {$currentBalance} cr, need {$priceCredits} cr (short {$shortage} cr)"
            );

            Subscription::update($subId, [
                'status' => 'suspended',
                'suspended_at' => date('Y-m-d H:i:s'),
                'server_suspend_sync' => 0,
            ]);

            if ($serverUuid && SettingsHelper::getSuspendServers()) {
                $this->suspendServer($serverUuid, $subId, $app);
            }

            if (SettingsHelper::getSendSuspensionEmail()) {
                $this->sendSuspensionEmail($userId, $planName, $priceCredits, $app);
            }

            $app->getLogger()->warning("BillingPlans: Subscription #$subId suspended (user #$userId, short {$shortage} cr).");

            return 'suspended';
        }

        if (!CreditsHelper::removeUserCredits($userId, $priceCredits)) {
            MinecraftColorCodeSupport::sendOutputWithNewLine(
                "&c  [#$subId] ✘ Failed to deduct {$priceCredits} cr from user #$userId"
            );
            $app->getLogger()->error("BillingPlans: Credit deduction failed for subscription #$subId user #$userId.");

            return 'errors';
        }

        $nextRenewal = date('Y-m-d H:i:s', strtotime("+{$periodDays} days"));
        Subscription::update($subId, [
            'status' => 'active',
            'next_renewal_at' => $nextRenewal,
            'suspended_at' => null,
            'grace_started_at' => null,
            'server_suspend_sync' => 0,
        ]);

        if ($serverUuid && $wasSuspended && SettingsHelper::getUnsuspendOnRenewal()) {
            $this->unsuspendServer($serverUuid, $subId, $app);
        }

        InvoiceHelper::createRenewalInvoice($userId, $subId, $planName, $priceCredits, $periodDays, $nextRenewal);

        $newBalance = $currentBalance - $priceCredits;
        MinecraftColorCodeSupport::sendOutputWithNewLine(
            "&a  [#$subId] ✔ Renewed — deducted {$priceCredits} cr (new balance: {$newBalance} cr) | next: $nextRenewal"
        );
        $app->getLogger()->info("BillingPlans: Subscription #$subId renewed (user #$userId, -{$priceCredits} cr, next: $nextRenewal).");

        return 'renewed';
    }

    private function processTerminations(): array
    {
        $stats = ['checked' => 0, 'terminated' => 0, 'servers_actioned' => 0];

        $terminationDays = SettingsHelper::getTerminationDays();
        if ($terminationDays <= 0) {
            MinecraftColorCodeSupport::sendOutputWithNewLine('&8[Terminations] &7Disabled (termination_days = 0 — servers stay suspended indefinitely).');

            return $stats;
        }

        $app = App::getInstance(false, true);
        $suspendedSubs = Subscription::getByStatus('suspended');
        $stats['checked'] = count($suspendedSubs);

        if ($stats['checked'] === 0) {
            MinecraftColorCodeSupport::sendOutputWithNewLine('&8[Terminations] &7No suspended subscriptions to check.');

            return $stats;
        }

        MinecraftColorCodeSupport::sendOutputWithNewLine(
            "&8[Terminations] &7Checking &f{$stats['checked']} &7suspended subscription(s) (terminate after: {$terminationDays}d)..."
        );
        MinecraftColorCodeSupport::sendOutputWithNewLine('');

        foreach ($suspendedSubs as $subscription) {
            $suspendedAt = $subscription['suspended_at'] ?? null;
            if (!$suspendedAt) {
                continue;
            }

            $subId = (int) $subscription['id'];
            $planName = $subscription['plan_name'] ?? 'Unknown Plan';
            $userId = (int) $subscription['user_id'];
            $serverUuid = $subscription['server_uuid'] ?? null;

            $suspendedTimestamp = strtotime($suspendedAt);
            $terminateAfter = $suspendedTimestamp + ($terminationDays * 86400);
            $daysElapsed = (int) floor((time() - $suspendedTimestamp) / 86400);

            if (time() < $terminateAfter) {
                $daysLeft = (int) ceil(($terminateAfter - time()) / 86400);
                MinecraftColorCodeSupport::sendOutputWithNewLine(
                    "&8  [#$subId] &7Suspended {$daysElapsed}d ago — {$daysLeft}d until auto-termination"
                );
                continue;
            }

            Subscription::update($subId, [
                'status' => 'cancelled',
                'cancelled_at' => date('Y-m-d H:i:s'),
                'server_uuid' => null,
            ]);

            MinecraftColorCodeSupport::sendOutputWithNewLine(
                "&c  [#$subId] ✘ Terminated — suspended {$daysElapsed}d (plan: $planName, user: #$userId)"
            );

            if ($serverUuid) {
                if ($this->deleteServer($serverUuid, $subId, $app)) {
                    ++$stats['servers_actioned'];
                }
            }

            if (SettingsHelper::getSendTerminationEmail()) {
                $this->sendTerminationEmail($userId, $planName, $app);
            }

            $app->getLogger()->info("BillingPlans: Subscription #$subId terminated (user #$userId, {$daysElapsed}d suspended). Server $serverUuid deleted.");
            ++$stats['terminated'];
        }

        return $stats;
    }

    private function processCancellations(): array
    {
        $stats = ['checked' => 0, 'servers_actioned' => 0];
        $app = App::getInstance(false, true);

        MinecraftColorCodeSupport::sendOutputWithNewLine('&8[Cancellations] &7Checking expired user-cancelled subscriptions...');

        $expired = Subscription::getDueCancellation();
        $stats['checked'] = count($expired);

        if ($stats['checked'] === 0) {
            MinecraftColorCodeSupport::sendOutputWithNewLine('&8[Cancellations] &7Nothing to clean up.');

            return $stats;
        }

        MinecraftColorCodeSupport::sendOutputWithNewLine(
            "&8[Cancellations] &f{$stats['checked']} &7cancelled subscription(s) past expiry — suspending servers..."
        );
        MinecraftColorCodeSupport::sendOutputWithNewLine('');

        foreach ($expired as $subscription) {
            $subId = (int) $subscription['id'];
            $userId = (int) $subscription['user_id'];
            $planName = $subscription['plan_name'] ?? 'Unknown Plan';
            $serverUuid = $subscription['server_uuid'];

            MinecraftColorCodeSupport::sendOutputWithNewLine(
                "&8  [#$subId] &7Cancelled sub — billing period ended, suspending server $serverUuid"
            );
            Subscription::update($subId, ['server_uuid' => null]);
            if ($this->suspendServer($serverUuid, $subId, $app)) {
                ++$stats['servers_actioned'];
            }

            $app->getLogger()->info("BillingPlans: Server $serverUuid suspended for expired cancelled subscription #$subId (user #$userId).");
        }

        return $stats;
    }

    /**
     * Permanently delete the server from the database and Wings daemon.
     * Returns true if actioned.
     */
    private function deleteServer(string $uuid, int $subId, App $app): bool
    {
        try {
            $server = Server::getServerByUuid($uuid);
            if (!$server) {
                $app->getLogger()->warning("BillingPlans: Server $uuid not found for deletion (subscription #$subId).");
                MinecraftColorCodeSupport::sendOutputWithNewLine("&e  [#$subId] ⚠ Server $uuid not found — skipping deletion.");

                return false;
            }

            $serverId = (int) $server['id'];

            $allAllocations = Allocation::getByServerId($serverId);
            if (!empty($allAllocations)) {
                $ids = array_column($allAllocations, 'id');
                Allocation::unassignMultiple($ids);
                MinecraftColorCodeSupport::sendOutputWithNewLine("&8  [#$subId] Unclaimed " . count($ids) . ' allocation(s).');
            }

            Server::hardDeleteServer($serverId);

            $node = Node::getNodeById((int) $server['node_id']);
            if ($node) {
                try {
                    $wings = new Wings($node['fqdn'], $node['daemonListen'], $node['scheme'], $node['daemon_token'], 30);
                    $wings->getServer()->deleteServer($uuid);
                } catch (\Exception $e) {
                    $app->getLogger()->error("BillingPlans: Wings deletion failed for $uuid: " . $e->getMessage());
                    MinecraftColorCodeSupport::sendOutputWithNewLine("&e  [#$subId] ⚠ Wings deletion failed (DB record removed): " . $e->getMessage());
                }
            }

            MinecraftColorCodeSupport::sendOutputWithNewLine("&c  [#$subId] 🗑 Server $uuid permanently deleted.");
            $app->getLogger()->info("BillingPlans: Server $uuid deleted for subscription #$subId.");

            return true;
        } catch (\Exception $e) {
            $app->getLogger()->error("BillingPlans: Failed to delete server $uuid (subscription #$subId): " . $e->getMessage());
            MinecraftColorCodeSupport::sendOutputWithNewLine("&c  [#$subId] ✘ Failed to delete server $uuid: " . $e->getMessage());

            return false;
        }
    }

    /**
     * Suspend the server (mark suspended=1 in DB).
     * Returns true if actioned.
     */
    private function suspendServer(string $uuid, int $subId, App $app): bool
    {
        try {
            $server = Server::getServerByUuid($uuid);
            if (!$server) {
                $app->getLogger()->warning("BillingPlans: Server $uuid not found (subscription #$subId).");
                MinecraftColorCodeSupport::sendOutputWithNewLine("&e  [#$subId] ⚠ Server $uuid not found — skipping suspension.");

                return false;
            }

            Server::updateServerById((int) $server['id'], ['suspended' => 1]);
            MinecraftColorCodeSupport::sendOutputWithNewLine("&6  [#$subId] 🔒 Server $uuid suspended.");
            $app->getLogger()->info("BillingPlans: Server $uuid suspended (subscription #$subId).");

            return true;
        } catch (\Exception $e) {
            $app->getLogger()->error("BillingPlans: Failed to suspend server $uuid (subscription #$subId): " . $e->getMessage());
            MinecraftColorCodeSupport::sendOutputWithNewLine("&c  [#$subId] ✘ Failed to suspend server $uuid: " . $e->getMessage());

            return false;
        }
    }

    private function unsuspendServer(string $uuid, int $subId, App $app): void
    {
        try {
            $server = Server::getServerByUuid($uuid);
            if (!$server) {
                $app->getLogger()->warning("BillingPlans: Server $uuid not found (subscription #$subId).");
                MinecraftColorCodeSupport::sendOutputWithNewLine("&e  [#$subId] ⚠ Server $uuid not found — skipping unsuspension.");

                return;
            }

            Server::updateServerById((int) $server['id'], ['suspended' => 0]);
            MinecraftColorCodeSupport::sendOutputWithNewLine("&a  [#$subId] 🔓 Server $uuid unsuspended.");
            $app->getLogger()->info("BillingPlans: Server $uuid unsuspended (subscription #$subId).");
        } catch (\Exception $e) {
            $app->getLogger()->error("BillingPlans: Failed to unsuspend server $uuid (subscription #$subId): " . $e->getMessage());
            MinecraftColorCodeSupport::sendOutputWithNewLine("&c  [#$subId] ✘ Failed to unsuspend server $uuid: " . $e->getMessage());
        }
    }

    private function sendSuspensionEmail(int $userId, string $planName, int $priceCredits, App $app): void
    {
        try {
            $user = User::getUserById($userId);
            if (!$user || empty($user['uuid'])) {
                return;
            }

            $config = $app->getConfig();
            $appName = $config->getSetting(ConfigInterface::APP_NAME, 'FeatherPanel');

            SubscriptionSuspended::send([
                'uuid'             => $user['uuid'],
                'email'            => $user['email'] ?? '',
                'subject'          => "[$appName] Your $planName subscription has been suspended",
                'app_name'         => $appName,
                'app_url'          => $config->getSetting(ConfigInterface::APP_URL, ''),
                'first_name'       => $user['first_name'] ?? $user['username'] ?? 'User',
                'last_name'        => $user['last_name'] ?? '',
                'username'         => $user['username'] ?? '',
                'app_support_url'  => $config->getSetting(ConfigInterface::APP_SUPPORT_URL, ''),
                'plan_name'        => $planName,
                'credits_required' => $priceCredits,
                'enabled'          => $config->getSetting(ConfigInterface::SMTP_ENABLED, 'false'),
            ]);
        } catch (\Exception $e) {
            $app->getLogger()->error("BillingPlans: Failed to send suspension email to user #$userId: " . $e->getMessage());
        }
    }

    private function sendTerminationEmail(int $userId, string $planName, App $app): void
    {
        try {
            $user = User::getUserById($userId);
            if (!$user || empty($user['uuid'])) {
                return;
            }

            $config = $app->getConfig();
            $appName = $config->getSetting(ConfigInterface::APP_NAME, 'FeatherPanel');

            SubscriptionTerminated::send([
                'uuid'             => $user['uuid'],
                'email'            => $user['email'] ?? '',
                'subject'          => "[$appName] Your $planName subscription has been terminated",
                'app_name'         => $appName,
                'app_url'          => $config->getSetting(ConfigInterface::APP_URL, ''),
                'first_name'       => $user['first_name'] ?? $user['username'] ?? 'User',
                'last_name'        => $user['last_name'] ?? '',
                'username'         => $user['username'] ?? '',
                'app_support_url'  => $config->getSetting(ConfigInterface::APP_SUPPORT_URL, ''),
                'plan_name'        => $planName,
                'termination_date' => date('Y-m-d H:i:s'),
                'enabled'          => $config->getSetting(ConfigInterface::SMTP_ENABLED, 'false'),
            ]);
        } catch (\Exception $e) {
            $app->getLogger()->error("BillingPlans: Failed to send termination email to user #$userId: " . $e->getMessage());
        }
    }
}
