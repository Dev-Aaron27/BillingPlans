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
use App\Chat\Node;
use App\Chat\Realm;
use App\Chat\Spell;
use App\Chat\Server;
use App\Chat\Activity;
use App\Chat\Allocation;
use App\Helpers\UUIDUtils;
use App\Chat\SpellVariable;
use App\Chat\ServerVariable;
use App\Helpers\ApiResponse;
use App\Services\Wings\Wings;
use OpenApi\Attributes as OA;
use App\CloudFlare\CloudFlareRealIP;
use App\Addons\billingplans\Chat\Plan;
use App\Addons\billingplans\Chat\Category;
use Symfony\Component\HttpFoundation\Request;
use App\Addons\billingplans\Chat\Subscription;
use Symfony\Component\HttpFoundation\Response;
use App\Addons\billingcore\Helpers\CreditsHelper;
use App\Addons\billingplans\Helpers\InvoiceHelper;

#[OA\Tag(name: 'User - Billing Plans', description: 'Browse and purchase billing plans')]
class PlansController
{
    #[OA\Get(
        path: '/api/user/billingplans/plans',
        summary: 'List available plans',
        tags: ['User - Billing Plans'],
        responses: [new OA\Response(response: 200, description: 'Plans retrieved successfully')]
    )]
    public function list(Request $request): Response
    {
        $user = $request->get('user');
        $categoryFilter = $request->query->get('category_id') !== null && $request->query->get('category_id') !== ''
            ? (int) $request->query->get('category_id')
            : null;

        $plans = Plan::getAll(true);

        $userCredits = CreditsHelper::getUserCredits((int) $user['id']);

        $allRealms = Realm::getAll(null, 500, 0) ?: [];
        $realmMap = [];
        foreach ($allRealms as $r) {
            $realmMap[(int) $r['id']] = ['id' => (int) $r['id'], 'name' => $r['name']];
        }
        $allSpells = Spell::getAllSpells() ?: [];
        $spellMap = [];
        foreach ($allSpells as $s) {
            $spellMap[(int) $s['id']] = ['id' => (int) $s['id'], 'name' => $s['name'], 'realm_id' => (int) ($s['realm_id'] ?? 0)];
        }

        foreach ($plans as &$plan) {
            $plan['billing_period_label'] = Plan::getBillingPeriodLabel((int) $plan['billing_period_days']);
            $plan['can_afford'] = $userCredits >= (int) $plan['price_credits'];
            $plan['has_server_template'] = !empty($plan['spell_id']) || !empty($plan['user_can_choose_spell']);
            $activeCount = Plan::getActiveSubscriptionCount((int) $plan['id']);
            $plan['active_subscription_count'] = $activeCount;
            $plan['slots_available'] = !empty($plan['max_subscriptions'])
                ? max(0, (int) $plan['max_subscriptions'] - $activeCount)
                : null;
            $plan['is_sold_out'] = !empty($plan['max_subscriptions']) && $activeCount >= (int) $plan['max_subscriptions'];

            $plan['user_can_choose_realm'] = (bool) ($plan['user_can_choose_realm'] ?? false);
            $plan['user_can_choose_spell'] = (bool) ($plan['user_can_choose_spell'] ?? false);

            $allowedRealmIds = Plan::decodeIds($plan['allowed_realms'] ?? null);
            $allowedSpellIds = Plan::decodeIds($plan['allowed_spells'] ?? null);

            $plan['allowed_realms_options'] = empty($allowedRealmIds)
                ? array_values($realmMap)
                : array_values(array_filter($realmMap, fn ($r) => in_array($r['id'], $allowedRealmIds, true)));

            $plan['allowed_spells_options'] = empty($allowedSpellIds)
                ? array_values($spellMap)
                : array_values(array_filter($spellMap, fn ($s) => in_array($s['id'], $allowedSpellIds, true)));

            // Resolve category
            $catId = (int) ($plan['category_id'] ?? 0);
            if ($catId) {
                $cat = Category::getById($catId);
                $plan['category'] = $cat ? ['id' => (int) $cat['id'], 'name' => $cat['name'], 'icon' => $cat['icon'], 'color' => $cat['color']] : null;
            } else {
                $plan['category'] = null;
            }

            unset($plan['server_config'], $plan['startup_override'], $plan['image_override'], $plan['node_id'], $plan['allowed_realms'], $plan['allowed_spells']);
        }

        // Apply category filter after enrichment
        if ($categoryFilter !== null) {
            $plans = array_values(array_filter($plans, fn ($p) => (int) ($p['category_id'] ?? 0) === $categoryFilter));
        }

        return ApiResponse::success([
            'data' => $plans,
            'user_credits' => $userCredits,
        ], 'Plans retrieved successfully', 200);
    }

    #[OA\Get(
        path: '/api/user/billingplans/plans/{planId}',
        summary: 'Get a plan',
        tags: ['User - Billing Plans'],
        parameters: [new OA\Parameter(name: 'planId', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Plan retrieved successfully'),
            new OA\Response(response: 404, description: 'Plan not found or inactive'),
        ]
    )]
    public function get(Request $request, int $planId): Response
    {
        $user = $request->get('user');
        $plan = Plan::getById($planId);
        if ($plan === null || !(int) $plan['is_active']) {
            return ApiResponse::error('Plan not found', 'PLAN_NOT_FOUND', 404);
        }

        $plan['billing_period_label'] = Plan::getBillingPeriodLabel((int) $plan['billing_period_days']);
        $userCredits = CreditsHelper::getUserCredits((int) $user['id']);
        $plan['can_afford'] = $userCredits >= (int) $plan['price_credits'];
        $plan['user_credits'] = $userCredits;
        $plan['has_server_template'] = !empty($plan['spell_id']);
        unset($plan['server_config'], $plan['startup_override'], $plan['image_override'], $plan['node_id']);

        return ApiResponse::success($plan, 'Plan retrieved successfully', 200);
    }

    #[OA\Post(
        path: '/api/user/billingplans/plans/{planId}/subscribe',
        summary: 'Subscribe to a plan',
        description: 'Deducts the plan price from user credits, creates a subscription, and auto-provisions a server if the plan has a server template.',
        tags: ['User - Billing Plans'],
        parameters: [new OA\Parameter(name: 'planId', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        requestBody: new OA\RequestBody(
            required: false,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'server_name', type: 'string', description: 'Custom server name (optional, defaults to plan name)'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Subscription created successfully'),
            new OA\Response(response: 400, description: 'Insufficient credits or invalid plan'),
            new OA\Response(response: 404, description: 'Plan not found or inactive'),
        ]
    )]
    public function subscribe(Request $request, int $planId): Response
    {
        $user = $request->get('user');
        $userId = (int) $user['id'];
        $input = json_decode($request->getContent(), true) ?? [];

        $plan = Plan::getById($planId);
        if ($plan === null || !(int) $plan['is_active']) {
            return ApiResponse::error('Plan not found or inactive', 'PLAN_NOT_FOUND', 404);
        }

        $priceCredits = (int) $plan['price_credits'];
        $periodDays = (int) $plan['billing_period_days'];
        $userCredits = CreditsHelper::getUserCredits($userId);

        // Stock control
        if (!empty($plan['max_subscriptions'])) {
            $activeCount = Plan::getActiveSubscriptionCount($planId);
            if ($activeCount >= (int) $plan['max_subscriptions']) {
                return ApiResponse::error(
                    "This plan is sold out. All {$plan['max_subscriptions']} slots are taken.",
                    'PLAN_SOLD_OUT',
                    400
                );
            }
        }

        if ($userCredits < $priceCredits) {
            return ApiResponse::error(
                "Insufficient credits. You need {$priceCredits} credits but only have {$userCredits}.",
                'INSUFFICIENT_CREDITS',
                400
            );
        }

        if (!CreditsHelper::removeUserCredits($userId, $priceCredits)) {
            return ApiResponse::error('Failed to process payment. Please try again.', 'PAYMENT_FAILED', 500);
        }

        // Resolve effective realm and spell (forced or user-chosen)
        $effectiveRealmId = $plan['realms_id'] ? (int) $plan['realms_id'] : null;
        $effectiveSpellId = $plan['spell_id'] ? (int) $plan['spell_id'] : null;

        if (!empty($plan['user_can_choose_realm'])) {
            $chosenRealmId = isset($input['chosen_realm_id']) && $input['chosen_realm_id'] ? (int) $input['chosen_realm_id'] : null;
            if (!$chosenRealmId) {
                CreditsHelper::addUserCredits($userId, $priceCredits);

                return ApiResponse::error('Please select a realm for your server.', 'REALM_REQUIRED', 400);
            }
            $allowedRealmIds = Plan::decodeIds($plan['allowed_realms'] ?? null);
            if (!empty($allowedRealmIds) && !in_array($chosenRealmId, $allowedRealmIds, true)) {
                CreditsHelper::addUserCredits($userId, $priceCredits);

                return ApiResponse::error('The selected realm is not allowed for this plan.', 'REALM_NOT_ALLOWED', 400);
            }
            $effectiveRealmId = $chosenRealmId;
        }

        if (!empty($plan['user_can_choose_spell'])) {
            $chosenSpellId = isset($input['chosen_spell_id']) && $input['chosen_spell_id'] ? (int) $input['chosen_spell_id'] : null;
            if (!$chosenSpellId) {
                CreditsHelper::addUserCredits($userId, $priceCredits);

                return ApiResponse::error('Please select a spell (game type) for your server.', 'SPELL_REQUIRED', 400);
            }
            $allowedSpellIds = Plan::decodeIds($plan['allowed_spells'] ?? null);
            if (!empty($allowedSpellIds) && !in_array($chosenSpellId, $allowedSpellIds, true)) {
                CreditsHelper::addUserCredits($userId, $priceCredits);

                return ApiResponse::error('The selected spell is not allowed for this plan.', 'SPELL_NOT_ALLOWED', 400);
            }
            $effectiveSpellId = $chosenSpellId;
        }

        // Egg must belong to the nest (realm) we provision on
        if ($effectiveSpellId && $effectiveRealmId) {
            $spellRow = Spell::getSpellById($effectiveSpellId);
            if (!$spellRow) {
                CreditsHelper::addUserCredits($userId, $priceCredits);

                return ApiResponse::error('The selected game type is invalid.', 'SPELL_NOT_FOUND', 400);
            }
            if ((int) ($spellRow['realm_id'] ?? 0) !== $effectiveRealmId) {
                CreditsHelper::addUserCredits($userId, $priceCredits);

                return ApiResponse::error(
                    'That egg does not belong to the selected nest. Choose an egg from the same category as your nest.',
                    'SPELL_REALM_MISMATCH',
                    400
                );
            }
        }

        // Auto-create server if plan has a server template
        $serverUuid = null;
        if ($effectiveSpellId && $effectiveRealmId) {
            $planForProvision = $plan;
            $planForProvision['spell_id'] = $effectiveSpellId;
            $planForProvision['realms_id'] = $effectiveRealmId;
            $serverResult = $this->provisionServer($planForProvision, $user, $input['server_name'] ?? null);
            if ($serverResult['success']) {
                $serverUuid = $serverResult['uuid'];
            } else {
                // Refund and abort
                CreditsHelper::addUserCredits($userId, $priceCredits);

                return ApiResponse::error(
                    'Failed to provision server: ' . ($serverResult['error'] ?? 'Unknown error'),
                    $serverResult['code'] ?? 'PROVISION_FAILED',
                    500
                );
            }
        }

        $nextRenewal = date('Y-m-d H:i:s', strtotime("+{$periodDays} days"));
        $subscriptionId = Subscription::create([
            'user_id' => $userId,
            'plan_id' => $planId,
            'server_uuid' => $serverUuid,
            'status' => 'active',
            'next_renewal_at' => $nextRenewal,
        ]);

        if ($subscriptionId === null) {
            CreditsHelper::addUserCredits($userId, $priceCredits);

            return ApiResponse::error('Failed to create subscription. Payment has been refunded.', 'CREATE_SUBSCRIPTION_FAILED', 500);
        }

        $subscription = Subscription::getById($subscriptionId);

        // Generate a billingcore invoice for this purchase
        InvoiceHelper::createPurchaseInvoice(
            $userId,
            $planId,
            $plan['name'],
            $subscriptionId,
            $priceCredits,
            $periodDays
        );

        Activity::createActivity([
            'user_uuid' => $user['uuid'] ?? null,
            'name' => 'billingplans_subscribe',
            'context' => "User subscribed to plan: {$plan['name']} (ID: {$planId}). Subscription #$subscriptionId. Paid: {$priceCredits} credits." .
                ($serverUuid ? " Server UUID: {$serverUuid}." : '') .
                " Next renewal: {$nextRenewal}",
            'ip_address' => CloudFlareRealIP::getRealIP(),
        ]);

        return ApiResponse::success([
            'subscription' => $subscription,
            'credits_deducted' => $priceCredits,
            'new_credits_balance' => CreditsHelper::getUserCredits($userId),
            'next_renewal_at' => $nextRenewal,
            'server_uuid' => $serverUuid,
        ], 'Successfully subscribed to plan!', 200);
    }

    /**
     * Provision a server based on the plan template.
     *
     * @param array<string,mixed> $plan
     * @param array<string,mixed> $user
     *
     * @return array{success: bool, uuid?: string, error?: string, code?: string}
     */
    private function provisionServer(array $plan, array $user, ?string $customName): array
    {
        $app = App::getInstance(false, true);
        $userId = (int) $user['id'];

        try {
            $spellId = (int) $plan['spell_id'];
            $realmId = (int) $plan['realms_id'];

            $spell = Spell::getSpellById($spellId);
            if (!$spell) {
                return ['success' => false, 'error' => 'Spell (egg) not found', 'code' => 'SPELL_NOT_FOUND'];
            }

            // Resolve node
            $nodeId = null;
            if (!empty($plan['node_id'])) {
                $nodeId = (int) $plan['node_id'];
            } else {
                // Auto-pick any node that has free allocations
                $allNodes = Node::getAllNodes() ?: [];
                foreach ($allNodes as $n) {
                    $free = Allocation::getAll(null, (int) $n['id'], null, 1, 0, true);
                    if (!empty($free)) {
                        $nodeId = (int) $n['id'];
                        break;
                    }
                }
            }

            if (!$nodeId) {
                return ['success' => false, 'error' => 'No available node with free allocations', 'code' => 'NO_AVAILABLE_NODE'];
            }

            $node = Node::getNodeById($nodeId);
            if (!$node) {
                return ['success' => false, 'error' => 'Node not found', 'code' => 'NODE_NOT_FOUND'];
            }

            // Get free allocation
            $allocations = Allocation::getAll(null, $nodeId, null, 100, 0, true);
            if (empty($allocations)) {
                return ['success' => false, 'error' => 'No free allocations on node', 'code' => 'NO_FREE_ALLOCATIONS'];
            }

            shuffle($allocations);
            $allocation = $allocations[0];
            $allocationId = (int) $allocation['id'];

            // Determine startup and docker image
            $startup = !empty($plan['startup_override']) ? $plan['startup_override'] : ($spell['startup'] ?? '');
            $image = !empty($plan['image_override']) ? $plan['image_override'] : ($spell['docker_image'] ?? '');
            if (empty($image) && !empty($spell['docker_images'])) {
                $images = is_string($spell['docker_images']) ? json_decode($spell['docker_images'], true) : $spell['docker_images'];
                if (is_array($images)) {
                    $image = array_values($images)[0] ?? '';
                }
            }

            $serverName = trim($customName ?? '') ?: ($plan['name'] . ' - ' . $user['username']);

            $uuid = UUIDUtils::generateV4();
            $uuidShort = substr(str_replace('-', '', UUIDUtils::generateV4()), 0, 8);

            $serverData = [
                'uuid' => $uuid,
                'uuidShort' => $uuidShort,
                'node_id' => $nodeId,
                'name' => $serverName,
                'owner_id' => $userId,
                'memory' => (int) ($plan['memory'] ?? 512),
                'swap' => (int) ($plan['swap'] ?? 0),
                'disk' => (int) ($plan['disk'] ?? 1024),
                'io' => (int) ($plan['io'] ?? 500),
                'cpu' => (int) ($plan['cpu'] ?? 100),
                'allocation_id' => $allocationId,
                'realms_id' => $realmId,
                'spell_id' => $spellId,
                'startup' => $startup,
                'image' => $image,
                'description' => $plan['description'] ?? null,
                'status' => 'installing',
                'skip_scripts' => 0,
                'oom_disabled' => 0,
                'allocation_limit' => !empty($plan['allocation_limit']) ? (int) $plan['allocation_limit'] : null,
                'database_limit' => (int) ($plan['database_limit'] ?? 0),
                'backup_limit' => (int) ($plan['backup_limit'] ?? 0),
            ];

            $serverId = Server::createServer($serverData);
            if (!$serverId) {
                return ['success' => false, 'error' => 'Failed to create server record', 'code' => 'CREATE_SERVER_FAILED'];
            }

            Allocation::assignToServer($allocationId, $serverId);

            // Set spell variables using defaults
            $spellVariables = SpellVariable::getVariablesBySpellId($spellId);
            $variablesToCreate = [];
            foreach ($spellVariables as $sv) {
                $default = $sv['default_value'] ?? '';
                if ($default !== null && $default !== '') {
                    $variablesToCreate[] = ['variable_id' => (int) $sv['id'], 'variable_value' => (string) $default];
                } elseif (strpos($sv['rules'] ?? '', 'required') !== false) {
                    Server::hardDeleteServer($serverId);

                    return ['success' => false, 'error' => 'Required variable "' . $sv['name'] . '" has no default', 'code' => 'MISSING_REQUIRED_VARIABLE'];
                }
            }
            if (!empty($variablesToCreate)) {
                ServerVariable::createOrUpdateServerVariables($serverId, $variablesToCreate);
            }

            // Register with Wings
            $wings = new Wings($node['fqdn'], $node['daemonListen'], $node['scheme'], $node['daemon_token'], 30);
            $response = $wings->getServer()->createServer(['uuid' => $uuid, 'start_on_completion' => true]);
            if (!$response->isSuccessful()) {
                Server::hardDeleteServer($serverId);

                return ['success' => false, 'error' => 'Wings error: ' . $response->getError(), 'code' => 'WINGS_ERROR'];
            }

            $app->getLogger()->info("BillingPlans: Server {$uuid} provisioned for user #{$userId} (plan: {$plan['name']}).");

            return ['success' => true, 'uuid' => $uuid];
        } catch (\Exception $e) {
            $app->getLogger()->error('BillingPlans: Server provisioning failed: ' . $e->getMessage());

            return ['success' => false, 'error' => $e->getMessage(), 'code' => 'PROVISION_EXCEPTION'];
        }
    }
}
