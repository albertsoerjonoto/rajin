'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { useLocale } from '@/lib/i18n';
import { useToast } from '@/components/Toast';
import { cn, getToday } from '@/lib/utils';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import type { Friendship, FriendProfile, FriendActivity } from '@/lib/types';

type Tab = 'feed' | 'friends' | 'add';

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
  const [activities, setActivities] = useState<FriendActivity[]>([]);

  // Friends list state
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendWithProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendWithProfile[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [friendshipMap, setFriendshipMap] = useState<Record<string, { status: string; isRequester: boolean; id: string }>>({});

  const today = getToday();

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

  const loadActivity = useCallback(async () => {
    if (!user) return;
    try {
      const sb = createClient();
      const { data, error } = await sb.rpc('get_friend_activity', { for_date: today });
      if (error) throw error;
      setActivities((data ?? []) as FriendActivity[]);
    } catch {
      // Activity feed is non-critical, silently fail
    }
  }, [user, today]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadFriendships(), loadActivity()]);
    setLoading(false);
  }, [loadFriendships, loadActivity]);

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
        const sb = createClient();
        const { data, error } = await sb.rpc('search_users_by_username', {
          search_term: searchQuery.trim(),
        });
        if (error) throw error;
        setSearchResults((data ?? []) as FriendProfile[]);
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
      await loadAll();
    } catch {
      showToast('error', t('friends.failedUnfriend'));
    }
  };

  const activityIcon = (type: string) => {
    switch (type) {
      case 'food': return '🍽️';
      case 'exercise': return '🏃';
      case 'drink': return '💧';
      case 'habit': return '✅';
      default: return '📝';
    }
  };

  const activityLabel = (type: string) => {
    switch (type) {
      case 'food': return t('friends.food');
      case 'exercise': return t('friends.exercise');
      case 'drink': return t('friends.drink');
      case 'habit': return t('friends.habit');
      default: return '';
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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

      <h1 className="text-2xl font-bold text-text-primary mb-4">{t('friends.title')}</h1>

      {/* Pill tabs */}
      <div className="flex gap-1 bg-surface-secondary rounded-xl p-1 mb-5">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200',
              tab === tb.key
                ? 'bg-surface text-text-text-primary shadow-sm'
                : 'text-text-text-secondary'
            )}
          >
            {t(tb.labelKey)}
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
            <div className="space-y-3">
              {friends.length === 0 ? (
                <EmptyState
                  message={t('friends.addFriendsHint')}
                  action={() => setTab('add')}
                  actionLabel={t('friends.addFriend')}
                />
              ) : activities.length === 0 ? (
                <p className="text-center text-text-secondary py-8">{t('friends.noActivity')}</p>
              ) : (
                activities.map((activity, i) => (
                  <div key={i} className="bg-surface rounded-xl p-4 shadow-xs flex items-start gap-3">
                    <Avatar url={activity.friend_avatar_url} name={activity.friend_display_name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm text-text-primary truncate">
                          {activity.friend_display_name ?? 'User'}
                        </span>
                        <span className="text-xs text-text-secondary">{activityLabel(activity.activity_type)}</span>
                        <span>{activityIcon(activity.activity_type)}</span>
                      </div>
                      <p className="text-sm text-text-primary mt-0.5">{activity.description}</p>
                      {activity.detail && (
                        <p className="text-xs text-text-secondary mt-0.5">{activity.detail}</p>
                      )}
                      <p className="text-xs text-text-tertiary mt-1">{formatTime(activity.logged_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Friends List Tab ── */}
          {tab === 'friends' && (
            <div className="space-y-4">
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
                          onClick={() => unfriend(friend.id)}
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
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string | null }) {
  const initials = (name ?? '?').charAt(0).toUpperCase();

  if (url) {
    return (
      <img
        src={url}
        alt={name ?? 'Avatar'}
        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
      />
    );
  }

  return (
    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
      <span className="text-sm font-semibold text-accent">{initials}</span>
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
