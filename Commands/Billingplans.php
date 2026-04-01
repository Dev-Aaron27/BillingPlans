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

namespace App\Addons\billingplans\Commands;

use App\Cli\App;
use App\App as MainApp;
use App\Cli\CommandBuilder;
use App\Addons\billingplans\Chat\Plan;
use App\Addons\billingplans\Chat\Subscription;
use App\Addons\billingplans\Cron\BillingPlansRenewal;

class Billingplans extends App implements CommandBuilder
{
    public static function execute(array $args): void
    {
        $cli = App::getInstance();

        if (!file_exists(__DIR__ . '/../../../../storage/config/.env')) {
            MainApp::getInstance(true)->getLogger()->warning('Executed billingplans CLI without a .env file');
            $cli->send('&cThe .env file does not exist. Please create one before running this command');
            exit;
        }

        MainApp::getInstance(true)->loadEnv();

        // $args[0] is the command name; $args[1] is the first subcommand
        if (!isset($args[1])) {
            self::printUsage($cli);

            exit;
        }

        $sub = strtolower((string) $args[1]);
        switch ($sub) {
            case 'stats':
                self::cmdStats($cli);
                break;
            case 'plans':
                self::cmdPlans($cli);
                break;
            case 'subscriptions':
                self::cmdSubscriptions($cli, $args);
                break;
            case 'subscription':
                self::cmdSubscription($cli, $args[2] ?? null);
                break;
            case 'due':
                self::cmdDue($cli);
                break;
            case 'renew':
                self::cmdRenew($cli);
                break;
            default:
                $cli->send('&cUnknown subcommand: ' . $sub);
                self::printUsage($cli);
                break;
        }

        exit;
    }

    public static function getDescription(): string
    {
        return 'BillingPlans: stats, plans, subscriptions, due renewals, run renewal cron';
    }

    public static function getSubCommands(): array
    {
        return [
            'stats' => 'Subscription counts, plans, refunds summary, renewals due',
            'plans' => 'List all billing plans',
            'subscriptions' => 'List subscriptions (usage: php backend/cli billingplans subscriptions [page] [limit] [status] from project root)',
            'subscription' => 'Show one subscription by id (usage: php backend/cli billingplans subscription <id> from project root)',
            'due' => 'List active subscriptions past next_renewal_at (due for renewal)',
            'renew' => 'Run the BillingPlans renewal / termination cycle (same job as addon cron)',
        ];
    }

    private static function printUsage(App $cli): void
    {
        $cli->send('&cUsage: php backend/cli billingplans <subcommand>');
        $cli->send('&7Run from the project root (parent of &fbackend/&7). Subcommands: &fstats&7, &fplans&7, &fsubscriptions&7, &fsubscription&7, &fdue&7, &frenew');
    }

    private static function cmdStats(App $cli): void
    {
        try {
            $byStatus = Subscription::countByStatus();
            $plans = Plan::getAll(false);
            $refund = Subscription::getAdminRefundAggregateStats();
            $due = Subscription::getDueForRenewal();
        } catch (\Throwable $e) {
            $cli->send('&cFailed to load stats: ' . $e->getMessage());

            return;
        }

        $cli->send('&bBillingPlans &7— &foverview');
        $cli->send('&7' . str_repeat('-', 56));
        $cli->send('&ePlans in database: &f' . count($plans));
        $cli->send('&eSubscriptions by status:');
        if ($byStatus === []) {
            $cli->send('  &7(none)');
        } else {
            foreach ($byStatus as $status => $count) {
                $cli->send(sprintf('  &7%-14s &f%d', $status, $count));
            }
        }
        $cli->send('&eAdmin credits refunded (total): &f' . ($refund['total_credits_refunded'] ?? 0));
        $cli->send('&eSubscriptions with admin refunds: &f' . ($refund['subscriptions_with_refunds'] ?? 0));
        $cli->send('&eDue for renewal now: &f' . count($due));
        $cli->send('&7' . str_repeat('-', 56));
    }

    private static function cmdPlans(App $cli): void
    {
        try {
            $plans = Plan::getAll(false);
        } catch (\Throwable $e) {
            $cli->send('&cFailed to list plans: ' . $e->getMessage());

            return;
        }

        if ($plans === []) {
            $cli->send('&7No plans found.');

            return;
        }

        $cli->send('&bPlans &7(' . count($plans) . ')');
        $cli->send('&7' . str_repeat('-', 90));
        $cli->send(sprintf('%-6s %-5s %-8s %-6s %-40s', 'ID', 'Act', 'Credits', 'Days', 'Name'));
        $cli->send('&7' . str_repeat('-', 90));
        foreach ($plans as $p) {
            $active = !empty($p['is_active']) ? '&aY' : '&cN';
            $cli->send(sprintf(
                '&f%-6s %s&r %-8s %-6s %-40s',
                $p['id'] ?? '',
                $active,
                $p['price_credits'] ?? '0',
                $p['billing_period_days'] ?? '',
                substr((string) ($p['name'] ?? ''), 0, 40)
            ));
        }
        $cli->send('&7' . str_repeat('-', 90));
    }

    private static function cmdSubscriptions(App $cli, array $args): void
    {
        $page = max(1, (int) ($args[2] ?? 1));
        $limit = min(100, max(1, (int) ($args[3] ?? 20)));
        $status = isset($args[4]) ? trim((string) $args[4]) : '';

        try {
            $result = Subscription::getPaginated($page, $limit, $status, '');
        } catch (\Throwable $e) {
            $cli->send('&cFailed to list subscriptions: ' . $e->getMessage());

            return;
        }

        $rows = $result['data'] ?? [];
        $total = (int) ($result['total'] ?? 0);
        $pages = $total > 0 ? (int) ceil($total / $limit) : 1;

        $cli->send("&bSubscriptions &7page &f{$page}&7/&f{$pages} &7total &f{$total}");
        $cli->send('&7' . str_repeat('-', 120));
        $cli->send(sprintf(
            '%-6s %-12s %-28s %-20s %-12s %-16s',
            'ID',
            'Status',
            'User',
            'Plan',
            'Server',
            'Next renewal'
        ));
        $cli->send('&7' . str_repeat('-', 120));
        foreach ($rows as $s) {
            $user = trim((string) ($s['username'] ?? ''));
            if ($user === '') {
                $user = substr((string) ($s['email'] ?? ''), 0, 26);
            }
            $srv = $s['server_uuid'] ?? '';
            if ($srv !== '') {
                $srv = substr($srv, 0, 8) . '…';
            } else {
                $srv = '-';
            }
            $nr = $s['next_renewal_at'] ?? '';
            if ($nr === null || $nr === '') {
                $nr = '-';
            }
            $cli->send(sprintf(
                '%-6s %-12s %-28s %-20s %-12s %-16s',
                $s['id'] ?? '',
                substr((string) ($s['status'] ?? ''), 0, 12),
                substr($user, 0, 28),
                substr((string) ($s['plan_name'] ?? ''), 0, 20),
                $srv,
                substr((string) $nr, 0, 16)
            ));
        }
        $cli->send('&7' . str_repeat('-', 120));
    }

    private static function cmdSubscription(App $cli, ?string $idRaw): void
    {
        if ($idRaw === null || $idRaw === '' || !ctype_digit($idRaw)) {
            $cli->send('&cUsage: php backend/cli billingplans subscription <id>');

            return;
        }
        $id = (int) $idRaw;

        try {
            $s = Subscription::getById($id);
        } catch (\Throwable $e) {
            $cli->send('&cFailed to load subscription: ' . $e->getMessage());

            return;
        }

        if ($s === null) {
            $cli->send("&cSubscription not found: {$id}");

            return;
        }

        $cli->send("&bSubscription &f#{$id}");
        $cli->send('&7' . str_repeat('-', 60));
        $fields = [
            'status',
            'user_id',
            'plan_id',
            'plan_name',
            'price_credits',
            'billing_period_days',
            'server_uuid',
            'next_renewal_at',
            'grace_started_at',
            'suspended_at',
            'cancelled_at',
            'server_suspend_sync',
            'created_at',
        ];
        foreach ($fields as $key) {
            if (!array_key_exists($key, $s)) {
                continue;
            }
            $v = $s[$key];
            if ($v === null || $v === '') {
                $v = '&7—';
            } else {
                $v = '&f' . $v;
            }
            $cli->send("&e{$key}: {$v}");
        }
        $cli->send('&7' . str_repeat('-', 60));
    }

    private static function cmdDue(App $cli): void
    {
        try {
            $due = Subscription::getDueForRenewal();
        } catch (\Throwable $e) {
            $cli->send('&cFailed to list due subscriptions: ' . $e->getMessage());

            return;
        }

        $cli->send('&eActive subscriptions due for renewal: &f' . count($due));
        if ($due === []) {
            return;
        }
        $cli->send('&7' . str_repeat('-', 100));
        $cli->send(sprintf('%-6s %-10s %-12s %-20s %-24s', 'ID', 'User ID', 'Plan', 'Next renewal', 'Server'));
        $cli->send('&7' . str_repeat('-', 100));
        foreach ($due as $s) {
            $su = $s['server_uuid'] ?? '';
            if ($su !== '') {
                $su = substr((string) $su, 0, 8) . '…';
            } else {
                $su = '-';
            }
            $cli->send(sprintf(
                '%-6s %-10s %-12s %-20s %-24s',
                $s['id'] ?? '',
                $s['user_id'] ?? '',
                substr((string) ($s['plan_name'] ?? ''), 0, 12),
                substr((string) ($s['next_renewal_at'] ?? ''), 0, 20),
                $su
            ));
        }
        $cli->send('&7' . str_repeat('-', 100));
    }

    private static function cmdRenew(App $cli): void
    {
        $cli->send('&7Bootstrapping app (cron mode) and running BillingPlans renewal…');

        try {
            new MainApp(false, true, false);
            (new BillingPlansRenewal())->run();
            $cli->send('&aRenewal cycle finished.');
        } catch (\Throwable $e) {
            MainApp::getInstance(true)->getLogger()->error('billingplans renew CLI: ' . $e->getMessage());
            $cli->send('&cRenewal failed: ' . $e->getMessage());
        }
    }
}
