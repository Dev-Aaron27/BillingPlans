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

namespace App\Addons\billingplans\Mail;

use App\Chat\MailList;
use App\Chat\MailQueue;
use App\Chat\MailTemplate;

class SubscriptionTerminated
{
    public static function getTemplate(array $data): string
    {
        if (
            !isset($data['app_name'], $data['app_url'], $data['first_name'],
                $data['last_name'], $data['email'], $data['username'],
                $data['app_support_url'], $data['plan_name'], $data['termination_date'])
        ) {
            return '';
        }

        $raw = MailTemplate::getByName('billingplans_subscription_terminated')['body'] ?? '';

        return self::parseTemplate($raw, [
            'app_name'         => $data['app_name'],
            'app_url'          => $data['app_url'],
            'first_name'       => $data['first_name'],
            'last_name'        => $data['last_name'],
            'email'            => $data['email'],
            'username'         => $data['username'],
            'dashboard_url'    => $data['app_url'] . '/dashboard',
            'billing_url'      => $data['app_url'] . '/billing',
            'support_url'      => $data['app_support_url'],
            'plan_name'        => $data['plan_name'],
            'termination_date' => $data['termination_date'],
        ]);
    }

    public static function parseTemplate(string $template, array $data): string
    {
        $template = str_replace('{app_name}', $data['app_name'], $template);
        $template = str_replace('{app_url}', $data['app_url'], $template);
        $template = str_replace('{first_name}', $data['first_name'], $template);
        $template = str_replace('{last_name}', $data['last_name'], $template);
        $template = str_replace('{email}', $data['email'], $template);
        $template = str_replace('{username}', $data['username'], $template);
        $template = str_replace('{dashboard_url}', $data['dashboard_url'], $template);
        $template = str_replace('{billing_url}', $data['billing_url'], $template);
        $template = str_replace('{support_url}', $data['support_url'], $template);
        $template = str_replace('{plan_name}', $data['plan_name'], $template);
        $template = str_replace('{termination_date}', $data['termination_date'], $template);

        return $template;
    }

    public static function send(array $data): void
    {
        if (
            !isset($data['uuid'], $data['email'], $data['subject'],
                $data['app_name'], $data['app_url'], $data['first_name'],
                $data['last_name'], $data['username'], $data['app_support_url'],
                $data['plan_name'], $data['termination_date'], $data['enabled'])
        ) {
            return;
        }

        if ($data['enabled'] === 'false') {
            return;
        }

        $template = self::getTemplate($data);
        if ($template === '') {
            return;
        }

        $queueId = MailQueue::create([
            'user_uuid' => $data['uuid'],
            'subject'   => $data['subject'],
            'body'      => $template,
        ]);

        if (!$queueId) {
            return;
        }

        MailList::create([
            'queue_id'  => $queueId,
            'user_uuid' => $data['uuid'],
        ]);
    }
}
