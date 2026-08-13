-- Mobile telemetry records only closed-set product observations. The server still derives identity,
-- timestamps, and retention after validating the authenticated session.

alter table public.events
  drop constraint if exists events_registered_action_check,
  add constraint events_registered_action_check
    check (
      action in (
        'session_started', 'turn_completed', 'anon_limit_hit', 'rate_limited',
        'register_prompt_shown', 'fallback_triggered', 'model_failure',
        'cost_pricing_missing', 'daily_budget_exceeded', 'prompt_submitted',
        'skeleton_received', 'details_completed', 'patch_applied', 'copilot_failed',
        'human_help_suggested', 'guide_viewed', 'poi_viewed', 'scene_filter_used',
        'outbound_clicked', 'partner_redirected', 'human_help_viewed', 'task_started',
        'task_submitted', 'quote_created', 'payment_link_clicked', 'task_paid', 'task_done',
        'rescue_started', 'rescue_route_selected', 'human_help_offered',
        'human_help_confirmed', 'resolution_outcome', 'arrival_pack_generated',
        'arrival_pack_downloaded', 'arrival_pack_regenerated', 'app_opened', 'trip_opened',
        'offline_content_used', 'tool_opened', 'show_to_local_used', 'human_help_submitted'
      )
    );
