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

namespace App\Addons\billingplans\Controllers\Admin;

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

#[OA\Tag(name: 'Admin - Billing Plans Subscriptions', description: 'Manage user subscriptions')]
class SubscriptionsController
{
    #[OA\Get(
        path: '/api/admin/billingplans/subscriptions',
        summary: 'List all subscriptions',
        tags: ['Admin - Billing Plans Subscriptions'],
        parameters: [
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', default: 1)),
            new OA\Parameter(name: 'limit', in: 'query', schema: new OA\Schema(type: 'integer', default: 20)),
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['pending', 'active', 'suspended', 'cancelled', 'expired'])),
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
        ],
        responses: [new OA\Response(response: 200, description: 'Subscriptions retrieved successfully')]
    )]
    public function list(Request $request): Response
    {
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(100, max(1, (int) $request->query->get('limit', 20)));
        $status = (string) $request->query->get('status', '');
        $search = (string) $request->query->get('search', '');

        $result = Subscription::getPaginated($page, $limit, $status, $search);
        $data = array_map(fn (array $row) => $this->enrichSubscriptionRow($row), $result['data']);

        return ApiResponse::success([
            'data' => $data,
            'meta' => [
                'pagination' => [
                    'total' => $result['total'],
                    'count' => count($result['data']),
                    'per_page' => $limit,
                    'current_page' => $page,
                    'total_pages' => (int) ceil($result['total'] / max(1, $limit)),
                ],
                'status_counts' => Subscription::countByStatus(),
            ],
        ], 'Subscriptions retrieved successfully', 200);
    }

    #[OA\Get(
        path: '/api/admin/billingplans/subscriptions/{subscriptionId}',
        summary: 'Get a subscription',
        tags: ['Admin - Billing Plans Subscriptions'],
        parameters: [new OA\Parameter(name: 'subscriptionId', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Subscription retrieved successfully'),
            new OA\Response(response: 404, description: 'Subscription not found'),
        ]
    )]
    public function get(Request $request, int $subscriptionId): Response
    {
        $subscription = Subscription::getById($subscriptionId);
        if ($subscription === null) {
            return ApiResponse::error('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
        }

        return ApiResponse::success($this->enrichSubscriptionRow($subscription), 'Subscription retrieved successfully', 200);
    }

    #[OA\Post(
        path: '/api/admin/billingplans/subscriptions/{subscriptionId}/refund',
        summary: 'Refund credits to the subscriber (admin)',
        tags: ['Admin - Billing Plans Subscriptions'],
        parameters: [new OA\Parameter(name: 'subscriptionId', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'amount', type: 'integer', description: 'Credits to add; defaults to the plan price_credits'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Credits refunded successfully'),
            new OA\Response(response: 404, description: 'Subscription not found'),
        ]
    )]
    public function refund(Request $request, int $subscriptionId): Response
    {
        $admin = $request->get('user');
        $subscription = Subscription::getById($subscriptionId);
        if ($subscription === null) {
            return ApiResponse::error('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
        }

        $raw = (string) $request->getContent();
        $data = [];
        if ($raw !== '') {
            $decoded = json_decode($raw, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                return ApiResponse::error('Invalid JSON', 'INVALID_JSON', 400);
            }
            if (!is_array($decoded)) {
                return ApiResponse::error('Invalid JSON body', 'INVALID_JSON', 400);
            }
            $data = $decoded;
        }

        $defaultAmount = (int) ($subscription['price_credits'] ?? 0);
        $amount = array_key_exists('amount', $data) ? (int) $data['amount'] : $defaultAmount;
        if ($amount < 1) {
            return ApiResponse::error('Refund amount must be at least 1 credit', 'INVALID_AMOUNT', 400);
        }

        $userId = (int) $subscription['user_id'];
        if (!CreditsHelper::addUserCredits($userId, $amount)) {
            return ApiResponse::error('Failed to add credits (billing may be unavailable)', 'REFUND_FAILED', 500);
        }

        if (!Subscription::recordAdminRefund($subscriptionId, $amount)) {
            $app = App::getInstance(false, true);
            $app->getLogger()->error("BillingPlans: addUserCredits succeeded but recordAdminRefund failed for subscription #{$subscriptionId}");
        }

        $newBalance = CreditsHelper::getUserCredits($userId);
        $planName = (string) ($subscription['plan_name'] ?? '');
        $updatedRow = Subscription::getById($subscriptionId);
        $refundRunningTotal = $updatedRow !== null ? (int) ($updatedRow['admin_credits_refunded_total'] ?? 0) : 0;

        Activity::createActivity([
            'user_uuid' => $admin['uuid'] ?? null,
            'name' => 'billingplans_admin_refund_subscription',
            'context' => "Admin refunded {$amount} credits for subscription #{$subscriptionId} (user: {$userId}, plan: {$planName}). Total admin refunds on this subscription: {$refundRunningTotal} cr.",
            'ip_address' => CloudFlareRealIP::getRealIP(),
        ]);

        $payload = [
            'credits_refunded' => $amount,
            'user_credits_balance' => $newBalance,
            'admin_credits_refunded_total' => $refundRunningTotal,
            'admin_refunded_at' => $updatedRow !== null ? ($updatedRow['admin_refunded_at'] ?? null) : null,
        ];
        if ($updatedRow !== null) {
            $payload['subscription'] = $this->enrichSubscriptionRow($updatedRow);
        }

        return ApiResponse::success($payload, 'Credits refunded successfully', 200);
    }

    #[OA\Patch(
        path: '/api/admin/billingplans/subscriptions/{subscriptionId}',
        summary: 'Update a subscription (admin)',
        tags: ['Admin - Billing Plans Subscriptions'],
        parameters: [new OA\Parameter(name: 'subscriptionId', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'status', type: 'string', enum: ['pending', 'active', 'suspended', 'cancelled', 'expired']),
                    new OA\Property(property: 'server_uuid', type: 'string', nullable: true),
                    new OA\Property(property: 'next_renewal_at', type: 'string', format: 'date-time', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Subscription updated successfully'),
            new OA\Response(response: 404, description: 'Subscription not found'),
        ]
    )]
    public function update(Request $request, int $subscriptionId): Response
    {
        $admin = $request->get('user');
        $subscription = Subscription::getById($subscriptionId);
        if ($subscription === null) {
            return ApiResponse::error('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
        }

        $data = json_decode($request->getContent(), true);
        if ($data === null) {
            return ApiResponse::error('Invalid JSON', 'INVALID_JSON', 400);
        }

        $updateData = [];
        $validStatuses = ['pending', 'active', 'suspended', 'cancelled', 'expired'];
        if (isset($data['status'])) {
            if (!in_array($data['status'], $validStatuses, true)) {
                return ApiResponse::error('Invalid status', 'INVALID_STATUS', 400);
            }
            $updateData['status'] = $data['status'];
            if ($data['status'] === 'suspended') {
                $updateData['suspended_at'] = date('Y-m-d H:i:s');
                $updateData['server_suspend_sync'] = 0;
            } elseif ($data['status'] === 'cancelled') {
                $updateData['cancelled_at'] = date('Y-m-d H:i:s');
                $updateData['server_suspend_sync'] = 0;
            } elseif ($data['status'] === 'active') {
                $updateData['server_suspend_sync'] = 0;
            }
        }

        if (array_key_exists('server_uuid', $data)) {
            $updateData['server_uuid'] = $data['server_uuid'];
        }

        if (array_key_exists('next_renewal_at', $data)) {
            $updateData['next_renewal_at'] = $data['next_renewal_at'];
        }

        if (!Subscription::update($subscriptionId, $updateData)) {
            return ApiResponse::error('Failed to update subscription', 'UPDATE_SUBSCRIPTION_FAILED', 500);
        }

        // Mirror server state when admin changes status
        $serverUuid = $subscription['server_uuid'] ?? null;
        if ($serverUuid && SettingsHelper::getSuspendServers() && isset($data['status'])) {
            try {
                $server = Server::getServerByUuid($serverUuid);
                if ($server) {
                    if (in_array($data['status'], ['suspended', 'cancelled'], true)) {
                        Server::updateServerById((int) $server['id'], ['suspended' => 1]);
                    } elseif ($data['status'] === 'active') {
                        Server::updateServerById((int) $server['id'], ['suspended' => 0]);
                    }
                }
            } catch (\Exception $e) {
                $app = App::getInstance(false, true);
                $app->getLogger()->error("BillingPlans: Failed to update server state for $serverUuid on admin update of subscription #$subscriptionId: " . $e->getMessage());
            }
        }

        $updated = Subscription::getById($subscriptionId);

        Activity::createActivity([
            'user_uuid' => $admin['uuid'] ?? null,
            'name' => 'billingplans_admin_update_subscription',
            'context' => "Admin updated subscription #$subscriptionId (user: {$subscription['user_id']}, plan: {$subscription['plan_name']})" . ($serverUuid ? " — server $serverUuid state synced" : ''),
            'ip_address' => CloudFlareRealIP::getRealIP(),
        ]);

        return ApiResponse::success($updated, 'Subscription updated successfully', 200);
    }

    #[OA\Delete(
        path: '/api/admin/billingplans/subscriptions/{subscriptionId}',
        summary: 'Cancel a subscription (admin)',
        tags: ['Admin - Billing Plans Subscriptions'],
        parameters: [new OA\Parameter(name: 'subscriptionId', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Subscription cancelled successfully'),
            new OA\Response(response: 404, description: 'Subscription not found'),
        ]
    )]
    public function cancel(Request $request, int $subscriptionId): Response
    {
        $admin = $request->get('user');
        $subscription = Subscription::getById($subscriptionId);
        if ($subscription === null) {
            return ApiResponse::error('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
        }

        if (!Subscription::update($subscriptionId, [
            'status' => 'cancelled',
            'cancelled_at' => date('Y-m-d H:i:s'),
        ])) {
            return ApiResponse::error('Failed to cancel subscription', 'CANCEL_SUBSCRIPTION_FAILED', 500);
        }

        // Suspend the linked server when admin cancels
        $serverUuid = $subscription['server_uuid'] ?? null;
        if ($serverUuid && SettingsHelper::getSuspendServers()) {
            try {
                $server = Server::getServerByUuid($serverUuid);
                if ($server) {
                    Server::updateServerById((int) $server['id'], ['suspended' => 1]);
                }
            } catch (\Exception $e) {
                $app = App::getInstance(false, true);
                $app->getLogger()->error("BillingPlans: Failed to suspend server $serverUuid on admin cancel of subscription #$subscriptionId: " . $e->getMessage());
            }
        }

        Activity::createActivity([
            'user_uuid' => $admin['uuid'] ?? null,
            'name' => 'billingplans_admin_cancel_subscription',
            'context' => "Admin cancelled subscription #$subscriptionId (user: {$subscription['user_id']}, plan: {$subscription['plan_name']})" . ($serverUuid ? " — server $serverUuid suspended" : ''),
            'ip_address' => CloudFlareRealIP::getRealIP(),
        ]);

        return ApiResponse::success([], 'Subscription cancelled successfully', 200);
    }

    #[OA\Get(
        path: '/api/admin/billingplans/users/{userId}/subscriptions',
        summary: 'Get subscriptions for a specific user',
        tags: ['Admin - Billing Plans Subscriptions'],
        parameters: [new OA\Parameter(name: 'userId', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'User subscriptions retrieved successfully'),
            new OA\Response(response: 404, description: 'User not found'),
        ]
    )]
    public function getUserSubscriptions(Request $request, int $userId): Response
    {
        $user = \App\Chat\User::getUserById($userId);
        if (!$user) {
            return ApiResponse::error('User not found', 'USER_NOT_FOUND', 404);
        }

        $subscriptions = array_map(
            fn (array $row) => $this->enrichSubscriptionRow($row),
            Subscription::getByUserId($userId)
        );

        return ApiResponse::success([
            'user' => [
                'id' => $userId,
                'username' => $user['username'],
                'email' => $user['email'],
            ],
            'subscriptions' => $subscriptions,
            'total' => count($subscriptions),
        ], 'User subscriptions retrieved successfully', 200);
    }

    #[OA\Get(
        path: '/api/admin/billingplans/stats',
        summary: 'Get subscription statistics',
        tags: ['Admin - Billing Plans Subscriptions'],
        responses: [new OA\Response(response: 200, description: 'Statistics retrieved successfully')]
    )]
    public function stats(Request $request): Response
    {
        $statusCounts = Subscription::countByStatus();
        $plans = Plan::getAll();
        $refundStats = Subscription::getAdminRefundAggregateStats();

        return ApiResponse::success([
            'subscriptions' => $statusCounts,
            'total_plans' => count($plans),
            'active_plans' => count(array_filter($plans, fn ($p) => (int) $p['is_active'] === 1)),
            'admin_refunds' => [
                'total_credits_refunded' => $refundStats['total_credits_refunded'],
                'subscriptions_with_refunds' => $refundStats['subscriptions_with_refunds'],
            ],
        ], 'Statistics retrieved successfully', 200);
    }

    /**
     * Attach resolved server display fields for admin UIs (name + numeric id for panel URLs).
     *
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    private function enrichSubscriptionRow(array $row): array
    {
        $row['server_id'] = null;
        $row['server_name'] = null;
        $uuid = $row['server_uuid'] ?? null;
        if (!empty($uuid) && is_string($uuid)) {
            $server = Server::getServerByUuid($uuid);
            if ($server) {
                $row['server_id'] = (int) $server['id'];
                $row['server_name'] = (string) ($server['name'] ?? '');
            }
        }

        return $row;
    }
}
