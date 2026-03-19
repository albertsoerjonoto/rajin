'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { useLocale } from '@/lib/i18n';
import { useToast } from '@/components/Toast';
import { cn } from '@/lib/utils';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { Friendship, FriendProfile, SharedHabit, FeedEvent } from '@/lib/types';

type Tab = 'feed' | 'friends' | 'add';
type FeedFilter = 'all' | 'mine' | 'friends';

interface FeedEventWithProfile extends FeedEvent {
  profile: FriendProfile;
}

interface FriendWithProfile extends Friendship {
  profile: FriendProfile;
}

export default function FriendsPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { showToast, ToastContainer } = useToast();

  const [tab, setTab] = useState<Tab>('feed');
  const [loading, setLoading] = useState(true);

  // Feed state
  const [feedEvents, setFeedEvents] = useState<FeedEventWithProfile[]>([]);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [feedPage, setFeedPage] = useState(0);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Friends list state
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendWithProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendWithProfile[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [friendshipMap, setFriendshipMap] = useState<Record<string, { status: string; isRequester: boolean; id: string }>>({});
  const [confirmUnfriend, setConfirmUnfriend] = useState<{ id: string; name: string } | null>(null);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<string | null>(null);

  // Shared habit invitations
  const [sharedInvites, setSharedInvites] = useState<(SharedHabit & { habit_name: string; habit_emoji: string; owner_name: string })[]>([]);

  const loadFriendships = useCallback(async () => {
    if (!user) return;
    try {
      const sb = createClient();
      const { data, error } = await sb
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (error) throw error;

      const friendships = (data ?? []) as Friendship[];
      const otherIds = friendships.map(f =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      );

      // Fetch profiles for all related users
      let profiles: FriendProfile[] = [];
      if (otherIds.length > 0) {
        const { data: profileData } = await sb
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', otherIds);
        profiles = (profileData ?? []) as FriendProfile[];
      }

      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const withProfiles: FriendWithProfile[] = friendships.map(f => {
        const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        return {
          ...f,
          profile: profileMap.get(otherId) ?? { id: otherId, username: null, display_name: null, avatar_url: null },
        };
      });

      setFriends(withProfiles.filter(f => f.status === 'accepted'));
      setIncomingRequests(withProfiles.filter(f => f.status === 'pending' && f.addressee_id === user.id));
      setSentRequests(withProfiles.filter(f => f.status === 'pending' && f.requester_id === user.id));

      // Build friendship map for search results
      const map: Record<string, { status: string; isRequester: boolean; id: string }> = {};
      friendships.forEach(f => {
        const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        map[otherId] = { status: f.status, isRequester: f.requester_id === user.id, id: f.id };
      });
      setFriendshipMap(map);
    } catch {
      showToast('error', t('friends.failedLoad'));
    }
  }, [user, showToast, t]);

  const loadFeedEvents = useCallback(async (page = 0, append = false) => {
    if (!user) return;
    const PAGE_SIZE = 20;
    try {
      const sb = createClient();
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await sb
        .from('feed_events')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      const events = (data ?? []) as FeedEvent[];

      const userIds = [...new Set(events.map(e => e.user_id))];
      let profiles: FriendProfile[] = [];
      if (userIds.length > 0) {
        const { data: profileData } = await sb
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds);
        profiles = (profileData ?? []) as FriendProfile[];
      }
      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const withProfiles: FeedEventWithProfile[] = events.map(e => ({
        ...e,
        profile: profileMap.get(e.user_id) ?? { id: e.user_id, username: null, display_name: null, avatar_url: null },
      }));

      if (append) {
        setFeedEvents(prev => [...prev, ...withProfiles]);
      } else {
        setFeedEvents(withProfiles);
      }
      setHasMoreFeed(events.length === PAGE_SIZE);
      setFeedPage(page);
    } catch {
      // Non-critical
    }
  }, [user]);

  const loadSharedInvites = useCallback(async () => {
    if (!user) return;
    try {
      const sb = createClient();
      const { data } = await sb
        .from('shared_habits')
        .select('*')
        .eq('friend_id', user.id)
        .eq('status', 'pending');
      if (!data || data.length === 0) { setSharedInvites([]); return; }

      const habitIds = data.map(sh => sh.habit_id);
      const ownerIds = data.map(sh => sh.owner_id);
      const [habitsRes, profilesRes] = await Promise.all([
        sb.from('habits').select('id, name, emoji').in('id', habitIds),
        sb.from('profiles').select('id, display_name').in('id', ownerIds),
      ]);
      const habitMap = new Map((habitsRes.data ?? []).map(h => [h.id, h]));
      const profileMap = new Map((profilesRes.data ?? []).map(p => [p.id, p]));

      setSharedInvites(data.map(sh => ({
        ...sh,
        habit_name: habitMap.get(sh.habit_id)?.name ?? '',
        habit_emoji: habitMap.get(sh.habit_id)?.emoji ?? '',
        owner_name: profileMap.get(sh.owner_id)?.display_name ?? 'User',
      })));
    } catch {
      // Non-critical
    }
  }, [user]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadFriendships(), loadSharedInvites(), loadFeedEvents(0)]);
    setLoading(false);
  }, [loadFriendships, loadSharedInvites, loadFeedEvents]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => loadAll();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadAll]);

  // Search
  useEffect(() => {
    if (tab !== 'add' || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/friends/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setSearchResults((json.results ?? []) as FriendProfile[]);
      } catch {
        showToast('error', t('friends.failedSearch'));
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, tab, showToast, t]);

  const sendRequest = async (addresseeId: string) => {
    if (!user) return;
    try {
      const sb = createClient();
      const { error } = await sb.from('friendships').insert({
        requester_id: user.id,
        addressee_id: addresseeId,
      });
      if (error) throw error;
      showToast('success', t('friends.requestSent'));
      await loadFriendships();
    } catch {
      showToast('error', t('friends.failedSendRequest'));
    }
  };

  const acceptRequest = async (friendshipId: string) => {
    try {
      const sb = createClient();
      const { error } = await sb
        .from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', friendshipId);
      if (error) throw error;
      showToast('success', t('friends.requestAccepted'));
      await loadAll();
    } catch {
      showToast('error', t('friends.failedAccept'));
    }
  };

  const declineRequest = async (friendshipId: string) => {
    try {
      const sb = createClient();
      const { error } = await sb.from('friendships').delete().eq('id', friendshipId);
      if (error) throw error;
      await loadFriendships();
    } catch {
      showToast('error', t('friends.failedDecline'));
    }
  };

  const unfriend = async (friendshipId: string) => {
    try {
      const sb = createClient();
      const { error } = await sb.from('friendships').delete().eq('id', friendshipId);
      if (error) throw error;
      showToast('success', t('friends.unfriended'));
      setConfirmUnfriend(null);
      await loadAll();
    } catch {
      showToast('error', t('friends.failedUnfriend'));
    }
  };

  const acceptSharedHabit = async (invite: typeof sharedInvites[0]) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/shared-habits/${invite.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? 'Failed');
      }
      showToast('success', t('friends.sharedAccepted'));
      await loadSharedInvites();
    } catch {
      showToast('error', t('friends.failedAcceptShared'));
    }
  };

  const rejectSharedHabit = async (id: string) => {
    try {
      const res = await fetch(`/api/shared-habits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });
      if (!res.ok) throw new Error('Failed');
      await loadSharedInvites();
    } catch {
      showToast('error', t('friends.failedRejectShared'));
    }
  };

  const loadMoreFeed = async () => {
    setLoadingMore(true);
    await loadFeedEvents(feedPage + 1, true);
    setLoadingMore(false);
  };

  const deleteFeedEvent = async (eventId: string) => {
    try {
      const sb = createClient();
      // For grouped events, find all IDs in the same group
      const idsToDelete = [eventId];
      const groupItem = groupedFeed.find(
        item => (item.type === 'group' || item.type === 'goal_group') && item.events.some(e => e.id === eventId)
      );
      if (groupItem && (groupItem.type === 'group' || groupItem.type === 'goal_group')) {
        idsToDelete.length = 0;
        groupItem.events.forEach(e => idsToDelete.push(e.id));
      }
      const { error } = await sb.from('feed_events').delete().in('id', idsToDelete);
      if (error) throw error;
      const idSet = new Set(idsToDelete);
      setFeedEvents(prev => prev.filter(e => !idSet.has(e.id)));
      setConfirmDeleteEvent(null);
      showToast('success', t('friends.feedDeleted'));
    } catch {
      showToast('error', t('friends.feedDeleteFailed'));
    }
  };

  const relativeTime = (dateStr: string) => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t('friends.justNow');
    if (diffMin < 60) return `${diffMin} ${t('friends.minutesAgo')}`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} ${t('friends.hoursAgo')}`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} ${t('friends.daysAgo')}`;
  };

  const firstName = (name: string | null) => {
    if (!name) return 'User';
    const parts = name.trim().split(/\s+/);
    return parts[0];
  };

  // Group consecutive habit_completed events by same user, same day only
  // Also group nutrition goal events (calorie, protein, fat, carbs, water) by same user, same day
  const NUTRITION_GOAL_TYPES = new Set(['calorie_goal_met', 'protein_goal_met', 'fat_goal_met', 'carbs_goal_met', 'water_goal_met']);

  type GroupedFeedItem =
    | { type: 'single'; event: FeedEventWithProfile }
    | { type: 'group'; events: FeedEventWithProfile[]; profile: FriendProfile; userId: string }
    | { type: 'goal_group'; events: FeedEventWithProfile[]; profile: FriendProfile; userId: string };

  const sameDay = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10);

  const groupFeedEvents = (events: FeedEventWithProfile[]): GroupedFeedItem[] => {
    const items: GroupedFeedItem[] = [];
    let i = 0;
    while (i < events.length) {
      const event = events[i];
      if (event.event_type === 'habit_completed') {
        // Collect consecutive habit_completed from same user AND same day
        const group: FeedEventWithProfile[] = [event];
        let j = i + 1;
        while (
          j < events.length &&
          events[j].event_type === 'habit_completed' &&
          events[j].user_id === event.user_id &&
          sameDay(events[j].created_at, event.created_at)
        ) {
          group.push(events[j]);
          j++;
        }
        // Deduplicate by habit name (keep first occurrence)
        const seen = new Set<string>();
        const deduped = group.filter(e => {
          const name = (e.data as Record<string, string>).habit_name;
          if (seen.has(name)) return false;
          seen.add(name);
          return true;
        });
        if (deduped.length > 1) {
          items.push({ type: 'group', events: deduped, profile: event.profile, userId: event.user_id });
        } else {
          items.push({ type: 'single', event: deduped[0] });
        }
        i = j;
      } else if (NUTRITION_GOAL_TYPES.has(event.event_type)) {
        // Collect consecutive nutrition goal events from same user AND same day
        const group: FeedEventWithProfile[] = [event];
        let j = i + 1;
        while (
          j < events.length &&
          NUTRITION_GOAL_TYPES.has(events[j].event_type) &&
          events[j].user_id === event.user_id &&
          sameDay(events[j].created_at, event.created_at)
        ) {
          group.push(events[j]);
          j++;
        }
        // Deduplicate by event type (keep first occurrence)
        const seen = new Set<string>();
        const deduped = group.filter(e => {
          if (seen.has(e.event_type)) return false;
          seen.add(e.event_type);
          return true;
        });
        if (deduped.length > 1) {
          items.push({ type: 'goal_group', events: deduped, profile: event.profile, userId: event.user_id });
        } else {
          items.push({ type: 'single', event: deduped[0] });
        }
        i = j;
      } else {
        items.push({ type: 'single', event });
        i++;
      }
    }
    return items;
  };

  const renderSingleEvent = (event: FeedEventWithProfile) => {
    const data = event.data as Record<string, string | number>;
    const name = firstName(event.profile.display_name);
    const isMe = event.user_id === user?.id;

    let description = '';

    switch (event.event_type) {
      case 'habit_completed': {
        const emoji = (data.habit_emoji as string) ?? '✅';
        const hcStreak = typeof data.streak === 'number' ? data.streak : 0;
        if (hcStreak > 1) {
          description = `${name} ${t('friends.hitStreak')} 🔥 ${hcStreak} ${t('friends.dayStreak')} ${emoji} ${data.habit_name}!`;
        } else {
          description = `${name} ${t('friends.completed')} ${emoji} ${data.habit_name}`;
        }
        break;
      }
      case 'streak_milestone':
        description = `${name} ${t('friends.hitStreak')} 🔥 ${data.streak} ${t('friends.dayStreak')} ${data.habit_name}!`;
        break;
      case 'friend_added':
        description = `${firstName(data.user1_name as string)} ${t('friends.nowFriends')} ${firstName(data.user2_name as string)}`;
        break;
      case 'shared_habit_started': {
        const emoji = (data.habit_emoji as string) ?? '🤝';
        description = `${name} shared ${emoji} ${data.habit_name}`;
        break;
      }
      case 'shared_streak':
        description = `${firstName(data.user1_name as string)} & ${firstName(data.user2_name as string)} ${t('friends.sharedStreak')} ${(data.habit_emoji as string) ?? ''} ${data.habit_name}! 🔥 ${data.streak}`;
        break;
      case 'shared_streak_milestone':
        description = `${firstName(data.user1_name as string)} & ${firstName(data.user2_name as string)} ${t('friends.sharedStreak')} ${(data.habit_emoji as string) ?? ''} ${data.habit_name}! 🔥 ${data.streak} ${t('friends.dayStreak').split(' ')[0]}!`;
        break;
      case 'exercise_completed':
        description = `${name} ${t('friends.exerciseCompleted')} 🏋️ ${data.exercise_type} ${t('friends.exerciseFor')} ${data.duration_minutes} ${t('friends.exerciseMin')}`;
        break;
      case 'calorie_goal_met':
        description = `${name} ${t('friends.calorieGoalMet')} 🎯 (${data.calories} kcal)`;
        break;
      case 'protein_goal_met':
        description = `${name} ${t('friends.proteinGoalMet')} 💪 (${data.protein_g}g)`;
        break;
      case 'fat_goal_met':
        description = `${name} ${t('friends.fatGoalMet')} 🥑 (${data.fat_g}g)`;
        break;
      case 'carbs_goal_met':
        description = `${name} ${t('friends.carbsGoalMet')} 🍚 (${data.carbs_g}g)`;
        break;
      case 'water_goal_met':
        description = `${name} ${t('friends.waterGoalMet')} 💧 (${Math.round((data.water_ml as number) / 1000 * 10) / 10}L)`;
        break;
    }

    const isStreakMilestone = event.event_type === 'streak_milestone';
    const isSharedStreak = event.event_type === 'shared_streak' || event.event_type === 'shared_streak_milestone';

    return (
      <div
        key={event.id}
        className={cn(
          'px-3 py-2.5 flex items-center gap-3 group rounded-xl',
          isStreakMilestone && 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20',
          isSharedStreak && 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20'
        )}
      >
        {isSharedStreak ? (
          <div className="flex -space-x-2 shrink-0">
            <Avatar url={event.profile.avatar_url} name={event.profile.display_name} size="sm" />
            <Avatar url={(data.friend_avatar_url as string) ?? null} name={(data.friend_name as string) ?? null} size="sm" />
          </div>
        ) : (
          <Avatar url={event.profile.avatar_url} name={event.profile.display_name} size="sm" />
        )}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-[13px] leading-snug',
            (isStreakMilestone || isSharedStreak) ? 'text-text-primary font-medium' : 'text-text-primary'
          )}>{description}</p>
          <p className="text-[11px] text-text-tertiary mt-0.5">{relativeTime(event.created_at)}</p>
        </div>
        {isMe && (
          <button
            onClick={() => setConfirmDeleteEvent(event.id)}
            className="opacity-40 sm:opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-text-tertiary hover:text-red-500 rounded-lg shrink-0"
            aria-label={t('friends.deleteFeedEvent')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  const renderGroupedEvent = (item: GroupedFeedItem & { type: 'group' }) => {
    const name = firstName(item.profile.display_name);
    const isMe = item.userId === user?.id;
    const earliest = item.events[item.events.length - 1];

    return (
      <div key={item.events.map(e => e.id).join('-')} className="px-3 py-2.5 flex items-start gap-3 group">
        <Avatar url={item.profile.avatar_url} name={item.profile.display_name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-text-primary font-medium leading-snug">
            {name} {t('friends.completed')} {item.events.length} habits
          </p>
          <ul className="mt-1 space-y-0.5">
            {item.events.map(e => {
              const d = e.data as Record<string, string | number>;
              const streak = typeof d.streak === 'number' ? d.streak : 0;
              return (
                <li key={e.id} className="text-[12px] text-text-secondary leading-snug">
                  {d.habit_emoji ?? '✅'} {d.habit_name}
                  {streak > 1 && <span className="text-orange-500 font-semibold ml-1">🔥 {streak} days</span>}
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-text-tertiary mt-1">{relativeTime(earliest.created_at)}</p>
        </div>
        {isMe && (
          <button
            onClick={() => setConfirmDeleteEvent(item.events[0].id)}
            className="opacity-40 sm:opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-text-tertiary hover:text-red-500 rounded-lg shrink-0 mt-1"
            aria-label={t('friends.deleteFeedEvent')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  const goalEventDetail = (event: FeedEventWithProfile) => {
    const data = event.data as Record<string, string | number>;
    switch (event.event_type) {
      case 'calorie_goal_met':
        return { emoji: '🎯', label: `${t('friends.calorieGoalMet')} (${data.calories} kcal)` };
      case 'protein_goal_met':
        return { emoji: '💪', label: `${t('friends.proteinGoalMet')} (${data.protein_g}g)` };
      case 'fat_goal_met':
        return { emoji: '🥑', label: `${t('friends.fatGoalMet')} (${data.fat_g}g)` };
      case 'carbs_goal_met':
        return { emoji: '🍚', label: `${t('friends.carbsGoalMet')} (${data.carbs_g}g)` };
      case 'water_goal_met':
        return { emoji: '💧', label: `${t('friends.waterGoalMet')} (${Math.round((data.water_ml as number) / 1000 * 10) / 10}L)` };
      default:
        return { emoji: '✅', label: '' };
    }
  };

  const renderGoalGroup = (item: GroupedFeedItem & { type: 'goal_group' }) => {
    const name = firstName(item.profile.display_name);
    const isMe = item.userId === user?.id;
    const earliest = item.events[item.events.length - 1];

    return (
      <div key={item.events.map(e => e.id).join('-')} className="px-3 py-2.5 flex items-start gap-3 group">
        <Avatar url={item.profile.avatar_url} name={item.profile.display_name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-text-primary font-medium leading-snug">
            {name} {t('friends.hitGoals')} {item.events.length} {t('friends.goals')}
          </p>
          <ul className="mt-1 space-y-0.5">
            {item.events.map(e => {
              const detail = goalEventDetail(e);
              return (
                <li key={e.id} className="text-[12px] text-text-secondary leading-snug">
                  {detail.emoji} {detail.label}
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-text-tertiary mt-1">{relativeTime(earliest.created_at)}</p>
        </div>
        {isMe && (
          <button
            onClick={() => setConfirmDeleteEvent(item.events[0].id)}
            className="opacity-40 sm:opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-text-tertiary hover:text-red-500 rounded-lg shrink-0 mt-1"
            aria-label={t('friends.deleteFeedEvent')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  const filteredFeedEvents = feedEvents.filter(e => {
    if (feedFilter === 'mine') return e.user_id === user?.id;
    if (feedFilter === 'friends') return e.user_id !== user?.id;
    return true;
  });

  const groupedFeed = groupFeedEvents(filteredFeedEvents);

  const getSearchButtonState = (userId: string) => {
    const fs = friendshipMap[userId];
    if (!fs) return 'add';
    if (fs.status === 'accepted') return 'friends';
    if (fs.status === 'pending') return 'pending';
    return 'add';
  };

  const tabs: { key: Tab; labelKey: string }[] = [
    { key: 'feed', labelKey: 'friends.feed' },
    { key: 'friends', labelKey: 'friends.friendsList' },
    { key: 'add', labelKey: 'friends.addFriend' },
  ];

  const { isExpanded } = useDesktopLayout();

  return (
    <div className={cn('max-w-lg mx-auto px-4 pt-6', isExpanded && 'lg:max-w-3xl lg:px-8')}>
      {ToastContainer}

      <h1 className="text-xl font-bold text-text-primary mb-4">{t('friends.title')}</h1>

      {/* Pill tabs */}
      <div className="flex gap-1 bg-surface-secondary rounded-xl p-1 mb-3">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 relative',
              tab === tb.key
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-secondary'
            )}
          >
            {t(tb.labelKey)}
            {tb.key === 'friends' && incomingRequests.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {incomingRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Feed Tab ── */}
          {tab === 'feed' && (
            <div className="space-y-1">
              {/* Filter tabs */}
              <div className="flex gap-3 mb-2">
                {([
                  { key: 'all' as FeedFilter, labelKey: 'friends.feedAll' },
                  { key: 'mine' as FeedFilter, labelKey: 'friends.feedMine' },
                  { key: 'friends' as FeedFilter, labelKey: 'friends.feedFriends' },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFeedFilter(f.key)}
                    className={cn(
                      'text-xs font-medium transition-colors',
                      feedFilter === f.key
                        ? 'text-text-primary'
                        : 'text-text-tertiary'
                    )}
                  >
                    {t(f.labelKey)}
                  </button>
                ))}
              </div>

              {friends.length === 0 && feedEvents.length === 0 ? (
                <EmptyState
                  message={t('friends.noFeedYet')}
                  action={() => setTab('add')}
                  actionLabel={t('friends.addFriend')}
                />
              ) : groupedFeed.length === 0 ? (
                <p className="text-center text-text-secondary py-8">{t('friends.noActivity')}</p>
              ) : (
                <>
                  {groupedFeed.map(item =>
                    item.type === 'group'
                      ? renderGroupedEvent(item)
                      : item.type === 'goal_group'
                      ? renderGoalGroup(item)
                      : renderSingleEvent(item.event)
                  )}
                  {hasMoreFeed && (
                    <button
                      onClick={loadMoreFeed}
                      disabled={loadingMore}
                      className="w-full py-3 text-sm text-accent-text font-medium rounded-xl bg-surface hover:bg-surface-secondary transition-colors"
                    >
                      {loadingMore ? (
                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                      ) : (
                        t('friends.loadMore')
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Friends List Tab ── */}
          {tab === 'friends' && (
            <div className="space-y-4">
              {/* Shared habit invitations */}
              {sharedInvites.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-text-secondary mb-2">{t('friends.sharedHabits')}</h2>
                  <div className="space-y-2">
                    {sharedInvites.map((invite) => (
                      <div key={invite.id} className="bg-surface rounded-xl p-4 shadow-xs">
                        <p className="text-sm text-text-primary mb-2">
                          <span className="font-medium">{invite.owner_name}</span>
                          {' '}{t('friends.sharedHabitInvite').replace('{name}', '').trim()}
                        </p>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-base">{invite.habit_emoji}</span>
                          <span className="text-sm font-medium text-text-primary">{invite.habit_name}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => acceptSharedHabit(invite)}
                            className="flex-1 py-2 text-sm text-accent-fg bg-accent rounded-xl hover:bg-accent-hover transition-all"
                          >
                            {t('friends.accept')}
                          </button>
                          <button
                            onClick={() => rejectSharedHabit(invite.id)}
                            className="flex-1 py-2 text-sm text-text-secondary bg-surface-secondary rounded-xl hover:bg-surface-hover transition-all"
                          >
                            {t('friends.reject')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Incoming requests */}
              {incomingRequests.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-text-secondary mb-2">{t('friends.pendingRequests')}</h2>
                  <div className="space-y-2">
                    {incomingRequests.map((req) => (
                      <div key={req.id} className="bg-surface rounded-xl p-4 shadow-xs flex items-center gap-3">
                        <Avatar url={req.profile.avatar_url} name={req.profile.display_name} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-text-primary truncate">{req.profile.display_name ?? 'User'}</p>
                          {req.profile.username && (
                            <p className="text-xs text-text-secondary">@{req.profile.username}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => acceptRequest(req.id)}
                            className="px-3 py-1.5 bg-accent text-accent-fg text-xs font-medium rounded-lg"
                          >
                            {t('friends.accept')}
                          </button>
                          <button
                            onClick={() => declineRequest(req.id)}
                            className="px-3 py-1.5 bg-surface-secondary text-text-secondary text-xs font-medium rounded-lg"
                          >
                            {t('friends.decline')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sent requests */}
              {sentRequests.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-text-secondary mb-2">{t('friends.sentRequests')}</h2>
                  <div className="space-y-2">
                    {sentRequests.map((req) => (
                      <div key={req.id} className="bg-surface rounded-xl p-4 shadow-xs flex items-center gap-3">
                        <Avatar url={req.profile.avatar_url} name={req.profile.display_name} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-text-primary truncate">{req.profile.display_name ?? 'User'}</p>
                          {req.profile.username && (
                            <p className="text-xs text-text-secondary">@{req.profile.username}</p>
                          )}
                        </div>
                        <button
                          onClick={() => declineRequest(req.id)}
                          className="px-3 py-1.5 bg-surface-secondary text-text-secondary text-xs font-medium rounded-lg"
                        >
                          {t('friends.cancelRequest')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Accepted friends */}
              {friends.length > 0 ? (
                <div>
                  {(incomingRequests.length > 0 || sentRequests.length > 0) && (
                    <h2 className="text-sm font-semibold text-text-secondary mb-2">{t('friends.friendsList')}</h2>
                  )}
                  <div className={cn('space-y-2', isExpanded && 'lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0')}>
                    {friends.map((friend) => (
                      <div key={friend.id} className="bg-surface rounded-xl p-4 shadow-xs flex items-center gap-3">
                        <Avatar url={friend.profile.avatar_url} name={friend.profile.display_name} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-text-primary truncate">{friend.profile.display_name ?? 'User'}</p>
                          {friend.profile.username && (
                            <p className="text-xs text-text-secondary">@{friend.profile.username}</p>
                          )}
                        </div>
                        <button
                          onClick={() => setConfirmUnfriend({ id: friend.id, name: friend.profile.display_name ?? friend.profile.username ?? 'User' })}
                          className="px-3 py-1.5 text-red-500 text-xs font-medium"
                        >
                          {t('friends.unfriend')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : incomingRequests.length === 0 && sentRequests.length === 0 ? (
                <EmptyState
                  message={t('friends.noFriendsYet')}
                  action={() => setTab('add')}
                  actionLabel={t('friends.addFriend')}
                />
              ) : null}
            </div>
          )}

          {/* ── Add / Search Tab ── */}
          {tab === 'add' && (
            <div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('friends.searchPlaceholder')}
                className="w-full px-4 py-3 bg-surface rounded-xl border border-border text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 mb-4"
                autoFocus
              />

              {searching ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : searchQuery.trim().length >= 2 && searchResults.length === 0 ? (
                <p className="text-center text-text-secondary py-8">{t('friends.noResults')}</p>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((result) => {
                    const state = getSearchButtonState(result.id);
                    return (
                      <div key={result.id} className="bg-surface rounded-xl p-4 shadow-xs flex items-center gap-3">
                        <Avatar url={result.avatar_url} name={result.display_name} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-text-primary truncate">{result.display_name ?? 'User'}</p>
                          {result.username && (
                            <p className="text-xs text-text-secondary">@{result.username}</p>
                          )}
                        </div>
                        {state === 'friends' ? (
                          <span className="text-xs text-accent font-medium">{t('friends.alreadyFriends')}</span>
                        ) : state === 'pending' ? (
                          <span className="text-xs text-text-secondary font-medium">{t('friends.pending')}</span>
                        ) : (
                          <button
                            onClick={() => sendRequest(result.id)}
                            className="px-3 py-1.5 bg-accent text-accent-fg text-xs font-medium rounded-lg"
                          >
                            {t('friends.sendRequest')}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirmUnfriend}
        title={t('friends.unfriendConfirm')}
        message={confirmUnfriend ? `${t('friends.unfriend')} ${confirmUnfriend.name}?` : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => confirmUnfriend && unfriend(confirmUnfriend.id)}
        onCancel={() => setConfirmUnfriend(null)}
      />

      <ConfirmDialog
        open={!!confirmDeleteEvent}
        title={t('friends.deleteConfirmTitle')}
        message={t('friends.deleteConfirmMessage')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => confirmDeleteEvent && deleteFeedEvent(confirmDeleteEvent)}
        onCancel={() => setConfirmDeleteEvent(null)}
      />
    </div>
  );
}

function Avatar({ url, name, size = 'md' }: { url: string | null; name: string | null; size?: 'sm' | 'md' }) {
  const initials = (name ?? '?').charAt(0).toUpperCase();
  const sizeClass = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const textClass = size === 'sm' ? 'text-xs' : 'text-sm';

  if (url) {
    return (
      <img
        src={url}
        alt={name ?? 'Avatar'}
        className={cn(sizeClass, 'rounded-full object-cover flex-shrink-0')}
      />
    );
  }

  return (
    <div className={cn(sizeClass, 'rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0')}>
      <span className={cn(textClass, 'font-semibold text-accent')}>{initials}</span>
    </div>
  );
}

function EmptyState({ message, action, actionLabel }: { message: string; action: () => void; actionLabel: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-text-secondary mb-4">{message}</p>
      <button
        onClick={action}
        className="px-5 py-2.5 bg-accent text-accent-fg text-sm font-medium rounded-xl"
      >
        {actionLabel}
      </button>
    </div>
  );
}
