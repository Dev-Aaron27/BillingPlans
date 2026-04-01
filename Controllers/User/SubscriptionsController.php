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

namespace App\Addons\billingplans\Controllers\User;

use App\App;
use App\Chat\Server;
use App\Chat\Activity;
use App\Helpers\ApiResponse;
use OpenApi\Attributes as OA;
use App\CloudFlare\CloudFlareRealIP;
use App\Addons\billingplans\Chat\Plan;
use Symfony\Component\HttpFoundation\Request;
use App\Addons\billingplans\Chat\Subscription;
use Symfony\Component\HttpFoundation\Response;
use App\Addons\billingcore\Helpers\CreditsHelper;
use App\Addons\billingplans\Helpers\SettingsHelper;

#[OA\Tag(name: 'User - Billing Plans Subscriptions', description: 'Manage your subscriptions')]
class SubscriptionsController
{
    #[OA\Get(
        path: '/api/user/billingplans/subscriptions',
        summary: 'Get my subscriptions',
        tags: ['User - Billing Plans Subscriptions'],
        responses: [new OA\Response(response: 200, description: 'Subscriptions retrieved successfully')]
    )]
    public function list(Request $request): Response
    {
        $user = $request->get('user');
        $userId = (int) $user['id'];
        $subscriptions = Subscription::getByUserId($userId);

        foreach ($subscriptions as &$sub) {
            $sub['billing_period_label'] = Plan::getBillingPeriodLabel((int) ($sub['billing_period_days'] ?? 30));
        }

        return ApiResponse::success([
            'data' => $subscriptions,
            'user_credits' => CreditsHelper::getUserCredits($userId),
        ], 'Subscriptions retrieved successfully', 200);
    }

    #[OA\Get(
        path: '/api/user/billingplans/subscriptions/{subscriptionId}',
        summary: 'Get a subscription',
        tags: ['User - Billing Plans Subscriptions'],
        parameters: [new OA\Parameter(name: 'subscriptionId', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Subscription retrieved successfully'),
            new OA\Response(response: 404, description: 'Subscription not found'),
        ]
    )]
    public function get(Request $request, int $subscriptionId): Response
    {
        $user = $request->get('user');
        $subscription = Subscription::getById($subscriptionId);

        if ($subscription === null || (int) $subscription['user_id'] !== (int) $user['id']) {
            return ApiResponse::error('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
        }

        $subscription['billing_period_label'] = Plan::getBillingPeriodLabel((int) ($subscription['billing_period_days'] ?? 30));

        return ApiResponse::success($subscription, 'Subscription retrieved successfully', 200);
    }

    #[OA\Delete(
        path: '/api/user/billingplans/subscriptions/{subscriptionId}',
        summary: 'Cancel a subscription',
        description: 'Marks the subscription as cancelled. No refund is issued. The subscription remains active until the current period ends.',
        tags: ['User - Billing Plans Subscriptions'],
        parameters: [new OA\Parameter(name: 'subscriptionId', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Subscription cancelled successfully'),
            new OA\Response(response: 400, description: 'Subscription cannot be cancelled'),
            new OA\Response(response: 404, description: 'Subscription not found'),
        ]
    )]
    public function cancel(Request $request, int $subscriptionId): Response
    {
        if (!SettingsHelper::getAllowUserCancellation()) {
            return ApiResponse::error('User cancellation is disabled by the administrator', 'CANCELLATION_DISABLED', 403);
        }

        $user = $request->get('user');
        $userId = (int) $user['id'];
        $subscription = Subscription::getById($subscriptionId);

        if ($subscription === null || (int) $subscription['user_id'] !== $userId) {
            return ApiResponse::error('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
        }

        if (in_array($subscription['status'], ['cancelled', 'expired'], true)) {
            return ApiResponse::error('Subscription is already cancelled or expired', 'ALREADY_CANCELLED', 400);
        }

        if (!Subscription::cancel($subscriptionId, $userId)) {
            return ApiResponse::error('Failed to cancel subscription', 'CANCEL_SUBSCRIPTION_FAILED', 500);
        }

        $serverUuid = $subscription['server_uuid'] ?? null;
        if ($serverUuid && SettingsHelper::getSuspendServers()) {
            try {
                $server = Server::getServerByUuid($serverUuid);
                if ($server) {
                    Server::updateServerById((int) $server['id'], ['suspended' => 1]);
                }
            } catch (\Exception $e) {
                $app = App::getInstance(false, true);
                $app->getLogger()->error("BillingPlans: Failed to suspend server $serverUuid on user cancel of subscription #$subscriptionId: " . $e->getMessage());
            }
        }

        Activity::createActivity([
            'user_uuid' => $user['uuid'] ?? null,
            'name' => 'billingplans_cancel_subscription',
            'context' => "User cancelled subscription #$subscriptionId (plan: {$subscription['plan_name']})" . ($serverUuid ? " — server $serverUuid suspended" : ''),
            'ip_address' => CloudFlareRealIP::getRealIP(),
        ]);

        return ApiResponse::success([], 'Subscription cancelled successfully', 200);
    }
}
