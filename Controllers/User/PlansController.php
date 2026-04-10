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
use App\Chat\Database;
use App\Chat\Activity;
use App\Chat\Allocation;
use App\Chat\SpellVariable;
use App\Chat\ServerVariable;
use App\Helpers\ApiResponse;
use App\CloudFlare\CloudFlareRealIP;
use App\Utils\UUIDUtils;
use App\Services\Wings\Wings;
use App\Addons\billingplans\Chat\Plan;
use App\Addons\billingplans\Chat\Category;
use App\Addons\billingplans\Chat\Subscription;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Addons\billingcore\Helpers\CreditsHelper;
use App\Addons\billingplans\Helpers\InvoiceHelper;

class PlansController
{
    public function list(Request $request): Response
    {
        $user = $request->get('user');
        $userId = (int) ($user['id'] ?? 0);
        $userCredits = CreditsHelper::getUserCredits($userId);

        $plans = Plan::getAll(true);
        $planIds = array_map(static fn (array $p): int => (int) ($p['id'] ?? 0), $plans);
        $preloaded = [
            'activeCounts' => $this->getActiveSubscriptionCounts($planIds),
            'allRealms' => Realm::getAll(null, 500, 0) ?: [],
            'allSpells' => Spell::getAllSpells() ?: [],
            'realmById' => [],
            'spellById' => [],
        ];
        $categoryCache = [];

        foreach ($plans as &$plan) {
            $plan = $this->hydratePlan($plan, $userCredits, $categoryCache, $preloaded);
        }

        return ApiResponse::success([
            'data' => array_values($plans),
            'user_credits' => $userCredits,
        ], 'Plans retrieved successfully', 200);
    }

    public function get(Request $request, int $planId): Response
    {
        $user = $request->get('user');
        $userId = (int) ($user['id'] ?? 0);
        $userCredits = CreditsHelper::getUserCredits($userId);

        $plan = Plan::getById($planId);
        if ($plan === null || (int) ($plan['is_active'] ?? 0) !== 1) {
            return ApiResponse::error('Plan not found', 'PLAN_NOT_FOUND', 404);
        }

        $cache = [];
        $preloaded = [
            'activeCounts' => [(int) $plan['id'] => Plan::getActiveSubscriptionCount((int) $plan['id'])],
            'allRealms' => Realm::getAll(null, 500, 0) ?: [],
            'allSpells' => Spell::getAllSpells() ?: [],
            'realmById' => [],
            'spellById' => [],
        ];
        $plan = $this->hydratePlan($plan, $userCredits, $cache, $preloaded);

        return ApiResponse::success($plan, 'Plan retrieved successfully', 200);
    }

    public function subscribe(Request $request, int $planId): Response
    {
        $user = $request->get('user');
        $userId = (int) ($user['id'] ?? 0);
        $input = json_decode($request->getContent(), true) ?: [];

        $plan = Plan::getById($planId);
        if ($plan === null || (int) ($plan['is_active'] ?? 0) !== 1) {
            return ApiResponse::error('Plan not found', 'PLAN_NOT_FOUND', 404);
        }

        $priceCredits = (int) ($plan['price_credits'] ?? 0);
        $periodDays = max(1, (int) ($plan['billing_period_days'] ?? 30));

        $maxSubscriptions = isset($plan['max_subscriptions']) && $plan['max_subscriptions'] !== null
            ? (int) $plan['max_subscriptions']
            : null;
        if ($maxSubscriptions !== null && $maxSubscriptions > 0) {
            $activeCount = Plan::getActiveSubscriptionCount((int) $plan['id']);
            if ($activeCount >= $maxSubscriptions) {
                return ApiResponse::error('This plan is sold out right now.', 'PLAN_SOLD_OUT', 400);
            }
        }

        $currentCredits = CreditsHelper::getUserCredits($userId);
        if ($currentCredits < $priceCredits) {
            return ApiResponse::error('Insufficient credits for this plan.', 'INSUFFICIENT_CREDITS', 400);
        }

        if (!CreditsHelper::removeUserCredits($userId, $priceCredits)) {
            return ApiResponse::error('Failed to deduct credits.', 'CREDITS_DEDUCTION_FAILED', 500);
        }

        $effectiveRealmId = !empty($plan['realms_id']) ? (int) $plan['realms_id'] : null;
        if (!empty($plan['user_can_choose_realm'])) {
            $chosenRealmId = isset($input['chosen_realm_id']) ? (int) $input['chosen_realm_id'] : null;
            if (!$chosenRealmId) {
                CreditsHelper::addUserCredits($userId, $priceCredits);

                return ApiResponse::error('Please select a realm (nest) for your server.', 'REALM_REQUIRED', 400);
            }
            $allowedRealmIds = Plan::decodeIds($plan['allowed_realms'] ?? null);
            if (!empty($allowedRealmIds) && !in_array($chosenRealmId, $allowedRealmIds, true)) {
                CreditsHelper::addUserCredits($userId, $priceCredits);

                return ApiResponse::error('The selected realm is not allowed for this plan.', 'REALM_NOT_ALLOWED', 400);
            }
            $effectiveRealmId = $chosenRealmId;
        }

        $effectiveSpellId = !empty($plan['spell_id']) ? (int) $plan['spell_id'] : null;
        if (!empty($plan['user_can_choose_spell'])) {
            $chosenSpellId = isset($input['chosen_spell_id']) ? (int) $input['chosen_spell_id'] : null;
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

        if ($effectiveSpellId && $effectiveRealmId) {
            $spellRow = Spell::getSpellById($effectiveSpellId);
            if (!$spellRow) {
                CreditsHelper::addUserCredits($userId, $priceCredits);

                return ApiResponse::error('The selected game type is invalid.', 'SPELL_NOT_FOUND', 400);
            }
            if ((int) ($spellRow['realm_id'] ?? 0) !== $effectiveRealmId) {
                CreditsHelper::addUserCredits($userId, $priceCredits);

                return ApiResponse::error(
                    'That spell does not belong to the selected realm. Choose a spell from the same realm.',
                    'SPELL_REALM_MISMATCH',
                    400
                );
            }
        }

        $planExpectsServer = (!empty($plan['spell_id']) || !empty($plan['user_can_choose_spell']))
            && (!empty($plan['realms_id']) || !empty($plan['user_can_choose_realm']));
        if ($planExpectsServer) {
            if (!$effectiveRealmId) {
                CreditsHelper::addUserCredits($userId, $priceCredits);

                return ApiResponse::error(
                    'This product cannot create a server: no realm is set. An administrator must assign a realm on the plan or enable realm selection.',
                    'REALM_NOT_CONFIGURED',
                    400
                );
            }
            if (!$effectiveSpellId) {
                CreditsHelper::addUserCredits($userId, $priceCredits);

                return ApiResponse::error(
                    'This product cannot create a server: no spell (server type) is set. An administrator must assign a spell on the plan or enable spell selection.',
                    'SPELL_NOT_CONFIGURED',
                    400
                );
            }
            $realmRow = Realm::getById($effectiveRealmId);
            if ($realmRow === null) {
                CreditsHelper::addUserCredits($userId, $priceCredits);

                return ApiResponse::error(
                    'The realm linked to this product was removed from the panel. An administrator must update the plan.',
                    'REALM_NOT_FOUND',
                    400
                );
            }
            $spellExists = Spell::getSpellById($effectiveSpellId);
            if ($spellExists === null) {
                CreditsHelper::addUserCredits($userId, $priceCredits);

                return ApiResponse::error(
                    'The spell linked to this product was removed from the panel. An administrator must update the plan.',
                    'SPELL_NOT_FOUND',
                    400
                );
            }
        }

        $serverUuid = null;
        if ($effectiveSpellId && $effectiveRealmId) {
            $planForProvision = $plan;
            $planForProvision['spell_id'] = $effectiveSpellId;
            $planForProvision['realms_id'] = $effectiveRealmId;
            $serverResult = $this->provisionServer($planForProvision, $user, $input['server_name'] ?? null);
            if ($serverResult['success']) {
                $serverUuid = $serverResult['uuid'];
            } else {
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
            if ($serverUuid) {
                $this->cleanupProvisionedServer($serverUuid);
            }
            CreditsHelper::addUserCredits($userId, $priceCredits);

            return ApiResponse::error('Failed to create subscription. Payment has been refunded.', 'CREATE_SUBSCRIPTION_FAILED', 500);
        }

        $subscription = Subscription::getById($subscriptionId);

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
                return ['success' => false, 'error' => 'Spell not found or was deleted from the panel', 'code' => 'SPELL_NOT_FOUND'];
            }
            $realm = Realm::getById($realmId);
            if ($realm === null) {
                return ['success' => false, 'error' => 'Realm not found or was deleted from the panel', 'code' => 'REALM_NOT_FOUND'];
            }
            if ((int) ($spell['realm_id'] ?? 0) !== $realmId) {
                return [
                    'success' => false,
                    'error' => 'Spell does not belong to the selected realm; fix the plan template in admin.',
                    'code' => 'SPELL_REALM_MISMATCH',
                ];
            }

            $requirements = [
                'memory' => (int) ($plan['memory'] ?? 512),
                'disk' => (int) ($plan['disk'] ?? 1024),
                'cpu' => (int) ($plan['cpu'] ?? 100),
            ];

            $nodeIds = Plan::getNodeIds($plan);
            if (empty($nodeIds)) {
                $allNodes = Node::getAllNodes();
                $nodeIds = array_map(static fn ($n) => (int) $n['id'], $allNodes);
            }

            $nodeId = $this->resolveProvisionNode($nodeIds, $requirements);
            if (!$nodeId) {
                return [
                    'success' => false,
                    'error' => 'No selected node has enough free resources and a free allocation.',
                    'code' => 'NO_AVAILABLE_NODE',
                ];
            }

            $node = Node::getNodeById($nodeId);
            if (!$node) {
                return ['success' => false, 'error' => 'The selected node no longer exists', 'code' => 'NODE_NOT_FOUND'];
            }

            $allocations = $this->getFreeNodeAllocations($nodeId, 100);
            if (empty($allocations)) {
                $hint = !empty($plan['node_id'])
                    ? 'This plan uses a fixed node and it has no free IPs. Pick another node or create allocations.'
                    : 'No free IPs on the chosen node.';

                return [
                    'success' => false,
                    'error' => $hint,
                    'code' => 'NO_FREE_ALLOCATIONS',
                ];
            }

            shuffle($allocations);
            $allocation = $allocations[0];
            $allocationId = (int) $allocation['id'];

            $startup = !empty($plan['startup_override']) ? $plan['startup_override'] : ($spell['startup'] ?? '');
            $image = !empty($plan['image_override']) ? $plan['image_override'] : ($spell['docker_image'] ?? '');
            if (empty($image) && !empty($spell['docker_images'])) {
                $images = is_string($spell['docker_images']) ? json_decode($spell['docker_images'], true) : $spell['docker_images'];
                if (is_array($images)) {
                    $image = array_values($images)[0] ?? '';
                }
            }
            $image = is_string($image) ? trim($image) : '';
            if ($image === '') {
                return [
                    'success' => false,
                    'error' => 'Spell has no Docker image configured. Set docker image on the spell or an image override on the plan.',
                    'code' => 'SPELL_DOCKER_IMAGE_MISSING',
                ];
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
                return [
                    'success' => false,
                    'error' => 'Could not save the server in the database. Check panel logs.',
                    'code' => 'CREATE_SERVER_FAILED',
                ];
            }

            if (!Allocation::assignToServer($allocationId, $serverId)) {
                Server::hardDeleteServer((int) $serverId);

                return [
                    'success' => false,
                    'error' => 'Could not assign a network allocation to the server.',
                    'code' => 'ALLOCATION_ASSIGN_FAILED',
                ];
            }

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

            $wings = new Wings($node['fqdn'], $node['daemonListen'], $node['scheme'], $node['daemon_token'], 30);
            $response = $wings->getServer()->createServer(['uuid' => $uuid, 'start_on_completion' => true]);
            if (!$response->isSuccessful()) {
                Server::hardDeleteServer($serverId);
                $err = $response->getError();
                $err = is_string($err) && $err !== '' ? $err : 'Unknown Wings response';

                return [
                    'success' => false,
                    'error' => 'Daemon rejected server creation: ' . $err,
                    'code' => 'WINGS_ERROR',
                ];
            }

            $app->getLogger()->info("BillingPlans: Server {$uuid} provisioned for user #{$userId} (plan: {$plan['name']}).");

            return ['success' => true, 'uuid' => $uuid];
        } catch (\Throwable $e) {
            $app->getLogger()->error('BillingPlans: Server provisioning failed: ' . $e->getMessage());

            return [
                'success' => false,
                'error' => 'Provisioning failed: ' . ($e->getMessage() !== '' ? $e->getMessage() : 'unexpected error'),
                'code' => 'PROVISION_EXCEPTION',
            ];
        }
    }

    /**
     * Try each node in order, return first with enough resources and a free allocation.
     * @param int[] $nodeIds
     * @param array{memory:int,disk:int,cpu:int} $requirements
     */
    private function resolveProvisionNode(array $nodeIds, array $requirements): ?int
    {
        foreach ($nodeIds as $nodeId) {
            if ($this->nodeHasCapacity($nodeId, $requirements)) {
                return $nodeId;
            }
        }

        return null;
    }

    /**
     * Check if node exists, is enabled, has enough free memory/disk/cpu, and at least one free allocation.
     * @param array{memory:int,disk:int,cpu:int} $requirements
     */
    private function nodeHasCapacity(int $nodeId, array $requirements): bool
    {
        $node = Node::getNodeById($nodeId);
        if (!$node) {
            return false;
        }

        // Different panel versions expose node enabled and usage fields under different keys.
        $isEnabled = $node['is_enabled'] ?? $node['enabled'] ?? $node['isEnabled'] ?? 1;
        if ((int) $isEnabled === 0) {
            return false;
        }

        $memCap = (int) ($node['memory'] ?? $node['memory_limit'] ?? 0);
        $diskCap = (int) ($node['disk'] ?? $node['disk_limit'] ?? 0);
        $cpuCap = (int) ($node['cpu'] ?? $node['cpu_limit'] ?? 0);

        $memUsed = (int) ($node['memory_used'] ?? $node['allocated_memory'] ?? $node['memoryAllocated'] ?? 0);
        $diskUsed = (int) ($node['disk_used'] ?? $node['allocated_disk'] ?? $node['diskAllocated'] ?? 0);
        $cpuUsed = (int) ($node['cpu_used'] ?? $node['allocated_cpu'] ?? $node['cpuAllocated'] ?? 0);

        $freeMem = (int) ($node['memory_available'] ?? ($memCap > 0 ? ($memCap - $memUsed) : PHP_INT_MAX));
        $freeDisk = (int) ($node['disk_available'] ?? ($diskCap > 0 ? ($diskCap - $diskUsed) : PHP_INT_MAX));
        $freeCpu = (int) ($node['cpu_available'] ?? ($cpuCap > 0 ? ($cpuCap - $cpuUsed) : PHP_INT_MAX));

        if ($freeMem < $requirements['memory'] || $freeDisk < $requirements['disk'] || $freeCpu < $requirements['cpu']) {
            return false;
        }

        $allocs = $this->getFreeNodeAllocations($nodeId, 1);

        return !empty($allocs);
    }

    /**
     * Get free allocations on a node across allocation API variants.
     *
     * @return array<int,array<string,mixed>>
     */
    private function getFreeNodeAllocations(int $nodeId, int $limit = 100): array
    {
        $allocs = Allocation::getAll(null, $nodeId, null, $limit, 0, true) ?: [];

        if (!empty($allocs)) {
            return array_values($allocs);
        }

        // Fallback: some implementations may ignore/interpret the final boolean differently.
        $fallback = Allocation::getAll(null, $nodeId, null, $limit, 0, false) ?: [];
        if (empty($fallback)) {
            return [];
        }

        return array_values(array_filter($fallback, static function (array $alloc): bool {
            return empty($alloc['server_id'])
                && empty($alloc['serverId'])
                && empty($alloc['assigned'])
                && empty($alloc['is_assigned']);
        }));
    }

    /**
     * @param array<string,mixed> $plan
     * @param array<int,array<string,mixed>|null> $categoryCache
     * @param array{
     *   activeCounts: array<int,int>,
     *   allRealms: array<int,array<string,mixed>>,
     *   allSpells: array<int,array<string,mixed>>,
     *   realmById: array<int,array<string,mixed>|null>,
     *   spellById: array<int,array<string,mixed>|null>
     * } $preloaded
     * @return array<string,mixed>
     */
    private function hydratePlan(array $plan, int $userCredits, array &$categoryCache, array &$preloaded): array
    {
        $plan['billing_period_label'] = Plan::getBillingPeriodLabel((int) ($plan['billing_period_days'] ?? 30));
        $plan['can_afford'] = $userCredits >= (int) ($plan['price_credits'] ?? 0);
        $plan['has_server_template'] =
            (!empty($plan['realms_id']) || !empty($plan['user_can_choose_realm']))
            && (!empty($plan['spell_id']) || !empty($plan['user_can_choose_spell']));

        $planId = (int) ($plan['id'] ?? 0);
        $activeSubscriptionCount = (int) ($preloaded['activeCounts'][$planId] ?? 0);
        $plan['active_subscription_count'] = $activeSubscriptionCount;

        $maxSubscriptions = isset($plan['max_subscriptions']) && $plan['max_subscriptions'] !== null
            ? (int) $plan['max_subscriptions']
            : null;
        $plan['slots_available'] = $maxSubscriptions === null ? null : max(0, $maxSubscriptions - $activeSubscriptionCount);
        $plan['is_sold_out'] = $maxSubscriptions !== null && $maxSubscriptions > 0 && $activeSubscriptionCount >= $maxSubscriptions;

        $plan['user_can_choose_realm'] = (bool) ($plan['user_can_choose_realm'] ?? false);
        $plan['user_can_choose_spell'] = (bool) ($plan['user_can_choose_spell'] ?? false);

        $allowedRealmIds = Plan::decodeIds($plan['allowed_realms'] ?? null);
        $allowedSpellIds = Plan::decodeIds($plan['allowed_spells'] ?? null);

        $plan['allowed_realms_options'] = $this->resolveRealmOptions($plan, $allowedRealmIds, $preloaded);
        $plan['allowed_spells_options'] = $this->resolveSpellOptions($plan, $allowedSpellIds, $plan['allowed_realms_options'], $preloaded);

        $categoryId = (int) ($plan['category_id'] ?? 0);
        if ($categoryId > 0) {
            if (!array_key_exists($categoryId, $categoryCache)) {
                $cat = Category::getById($categoryId);
                $categoryCache[$categoryId] = $cat ? [
                    'id' => (int) $cat['id'],
                    'name' => $cat['name'],
                    'icon' => $cat['icon'],
                    'color' => $cat['color'],
                ] : null;
            }
            $plan['category'] = $categoryCache[$categoryId];
        } else {
            $plan['category'] = null;
        }

        return $plan;
    }

    /**
     * @param array<string,mixed> $plan
     * @param int[] $allowedRealmIds
     * @param array{
     *   activeCounts: array<int,int>,
     *   allRealms: array<int,array<string,mixed>>,
     *   allSpells: array<int,array<string,mixed>>,
     *   realmById: array<int,array<string,mixed>|null>,
     *   spellById: array<int,array<string,mixed>|null>
     * } $preloaded
     * @return array<int,array{id:int,name:string}>
     */
    private function resolveRealmOptions(array $plan, array $allowedRealmIds, array &$preloaded): array
    {
        $options = [];

        if (!empty($plan['user_can_choose_realm'])) {
            if (!empty($allowedRealmIds)) {
                foreach ($allowedRealmIds as $realmId) {
                    $realm = $this->getRealmByIdCached((int) $realmId, $preloaded);
                    if ($realm !== null) {
                        $options[] = ['id' => (int) $realm['id'], 'name' => (string) $realm['name']];
                    }
                }
            } else {
                foreach ($preloaded['allRealms'] as $realm) {
                    $options[] = ['id' => (int) $realm['id'], 'name' => (string) $realm['name']];
                }
            }
        } elseif (!empty($plan['realms_id'])) {
            $realm = $this->getRealmByIdCached((int) $plan['realms_id'], $preloaded);
            if ($realm !== null) {
                $options[] = ['id' => (int) $realm['id'], 'name' => (string) $realm['name']];
            }
        }

        return array_values($options);
    }

    /**
     * @param array<string,mixed> $plan
     * @param int[] $allowedSpellIds
     * @param array<int,array{id:int,name:string}> $allowedRealmOptions
      * @param array{
      *   activeCounts: array<int,int>,
      *   allRealms: array<int,array<string,mixed>>,
      *   allSpells: array<int,array<string,mixed>>,
      *   realmById: array<int,array<string,mixed>|null>,
      *   spellById: array<int,array<string,mixed>|null>
      * } $preloaded
     * @return array<int,array{id:int,name:string,realm_id:int}>
     */
        private function resolveSpellOptions(array $plan, array $allowedSpellIds, array $allowedRealmOptions, array &$preloaded): array
    {
        $options = [];
        $allowedRealmSet = [];
        foreach ($allowedRealmOptions as $opt) {
            $allowedRealmSet[(int) $opt['id']] = true;
        }

        if (!empty($plan['user_can_choose_spell'])) {
            if (!empty($allowedSpellIds)) {
                foreach ($allowedSpellIds as $spellId) {
                    $spell = $this->getSpellByIdCached((int) $spellId, $preloaded);
                    if ($spell !== null) {
                        $realmId = (int) ($spell['realm_id'] ?? 0);
                        if (!empty($allowedRealmSet) && !isset($allowedRealmSet[$realmId])) {
                            continue;
                        }
                        $options[] = [
                            'id' => (int) $spell['id'],
                            'name' => (string) $spell['name'],
                            'realm_id' => $realmId,
                        ];
                    }
                }
            } else {
                foreach ($preloaded['allSpells'] as $spell) {
                    $realmId = (int) ($spell['realm_id'] ?? 0);
                    if (!empty($allowedRealmSet) && !isset($allowedRealmSet[$realmId])) {
                        continue;
                    }
                    $options[] = [
                        'id' => (int) $spell['id'],
                        'name' => (string) $spell['name'],
                        'realm_id' => $realmId,
                    ];
                }
            }
        } elseif (!empty($plan['spell_id'])) {
            $spell = $this->getSpellByIdCached((int) $plan['spell_id'], $preloaded);
            if ($spell !== null) {
                $options[] = [
                    'id' => (int) $spell['id'],
                    'name' => (string) $spell['name'],
                    'realm_id' => (int) ($spell['realm_id'] ?? 0),
                ];
            }
        }

        return array_values($options);
    }

    /**
     * @param int[] $planIds
     * @return array<int,int>
     */
    private function getActiveSubscriptionCounts(array $planIds): array
    {
        $planIds = array_values(array_filter(array_map('intval', $planIds), static fn (int $id): bool => $id > 0));
        if (empty($planIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($planIds), '?'));
        $pdo = Database::getPdoConnection();
        $stmt = $pdo->prepare(
            "SELECT plan_id, COUNT(*) AS count
             FROM featherpanel_billingplans_subscriptions
             WHERE plan_id IN ({$placeholders}) AND status IN ('active','suspended','pending')
             GROUP BY plan_id"
        );
        $stmt->execute($planIds);
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        $counts = [];
        foreach ($rows as $row) {
            $counts[(int) $row['plan_id']] = (int) $row['count'];
        }

        return $counts;
    }

    /**
     * @param array{
     *   activeCounts: array<int,int>,
     *   allRealms: array<int,array<string,mixed>>,
     *   allSpells: array<int,array<string,mixed>>,
     *   realmById: array<int,array<string,mixed>|null>,
     *   spellById: array<int,array<string,mixed>|null>
     * } $preloaded
     * @return array<string,mixed>|null
     */
    private function getRealmByIdCached(int $realmId, array &$preloaded): ?array
    {
        if ($realmId <= 0) {
            return null;
        }
        if (!array_key_exists($realmId, $preloaded['realmById'])) {
            $match = null;
            foreach ($preloaded['allRealms'] as $realm) {
                if ((int) ($realm['id'] ?? 0) === $realmId) {
                    $match = $realm;
                    break;
                }
            }
            $preloaded['realmById'][$realmId] = $match ?: Realm::getById($realmId);
        }

        return $preloaded['realmById'][$realmId];
    }

    /**
     * @param array{
     *   activeCounts: array<int,int>,
     *   allRealms: array<int,array<string,mixed>>,
     *   allSpells: array<int,array<string,mixed>>,
     *   realmById: array<int,array<string,mixed>|null>,
     *   spellById: array<int,array<string,mixed>|null>
     * } $preloaded
     * @return array<string,mixed>|null
     */
    private function getSpellByIdCached(int $spellId, array &$preloaded): ?array
    {
        if ($spellId <= 0) {
            return null;
        }
        if (!array_key_exists($spellId, $preloaded['spellById'])) {
            $match = null;
            foreach ($preloaded['allSpells'] as $spell) {
                if ((int) ($spell['id'] ?? 0) === $spellId) {
                    $match = $spell;
                    break;
                }
            }
            $preloaded['spellById'][$spellId] = $match ?: Spell::getSpellById($spellId);
        }

        return $preloaded['spellById'][$spellId];
    }

    private function cleanupProvisionedServer(string $serverUuid): void
    {
        $server = Server::getServerByUuid($serverUuid);
        if ($server && !empty($server['id'])) {
            Server::hardDeleteServer((int) $server['id']);
        }
    }
}
