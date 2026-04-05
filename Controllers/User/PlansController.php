
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
     * @param array $requirements ['memory'=>int, 'disk'=>int, 'cpu'=>int]
     * @return int|null
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
     * @param int $nodeId
     * @param array $requirements
     * @return bool
     */
    private function nodeHasCapacity(int $nodeId, array $requirements): bool
    {
        $node = \App\Chat\Node::getNodeById($nodeId);
        if (!$node || empty($node['is_enabled'])) return false;
        // Check free resources (memory, disk, cpu)
        $freeMem = (int)($node['memory'] ?? 0) - (int)($node['memory_used'] ?? 0);
        $freeDisk = (int)($node['disk'] ?? 0) - (int)($node['disk_used'] ?? 0);
        $freeCpu = (int)($node['cpu'] ?? 0) - (int)($node['cpu_used'] ?? 0);
        if ($freeMem < $requirements['memory'] || $freeDisk < $requirements['disk'] || $freeCpu < $requirements['cpu']) {
            return false;
        }
        // At least one free allocation
        $allocs = \App\Chat\Allocation::getAll(null, $nodeId, null, 1, 0, true);
        if (empty($allocs)) return false;
        return true;
    }
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
                    'That spell does not belong to the selected realm. Choose a spell from the same realm.',
                    'SPELL_REALM_MISMATCH',
                    400
                );
            }
        }

        // Plan is meant to provision a server: require both realm and spell to be configured and still present in the panel
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
            // Multi-node support: resolve node from node_ids (ordered)
            $requirements = [
                'memory' => (int) ($plan['memory'] ?? 512),
                'disk' => (int) ($plan['disk'] ?? 1024),
                'cpu' => (int) ($plan['cpu'] ?? 100),
            ];
            $nodeIds = \App\Addons\billingplans\Chat\Plan::getNodeIds($plan);
            if (empty($nodeIds)) {
                $allNodes = \App\Chat\Node::getAllNodes();
                $nodeIds = array_map(fn($n) => (int)$n['id'], $allNodes);
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
            // Get free allocation
            $allocations = Allocation::getAll(null, $nodeId, null, 100, 0, true);
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
            // Determine startup and docker image
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
     * @param array $requirements ['memory'=>int, 'disk'=>int, 'cpu'=>int]
     * @return int|null
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
     * @param int $nodeId
     * @param array $requirements
     * @return bool
     */
    private function nodeHasCapacity(int $nodeId, array $requirements): bool
    {
        $node = \App\Chat\Node::getNodeById($nodeId);
        if (!$node || empty($node['is_enabled'])) return false;
        // Check free resources (memory, disk, cpu)
        $freeMem = (int)($node['memory'] ?? 0) - (int)($node['memory_used'] ?? 0);
        $freeDisk = (int)($node['disk'] ?? 0) - (int)($node['disk_used'] ?? 0);
        $freeCpu = (int)($node['cpu'] ?? 0) - (int)($node['cpu_used'] ?? 0);
        if ($freeMem < $requirements['memory'] || $freeDisk < $requirements['disk'] || $freeCpu < $requirements['cpu']) {
            return false;
        }
        // At least one free allocation
        $allocs = \App\Chat\Allocation::getAll(null, $nodeId, null, 1, 0, true);
        if (empty($allocs)) return false;
        return true;
    }

            // Get free allocation
            $allocations = Allocation::getAll(null, $nodeId, null, 100, 0, true);
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

            // Determine startup and docker image
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
}
