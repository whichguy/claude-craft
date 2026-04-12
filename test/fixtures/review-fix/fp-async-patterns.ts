/**
 * notification-manager.ts — React component + async helpers for
 * managing user notifications with proper async error handling patterns.
 *
 * All async patterns here are intentionally correct — this file is used
 * to test that reviewers don't flag well-written async code.
 */

import React, { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Notification {
  id: string;
  message: string;
  level: 'info' | 'warn' | 'error';
  timestamp: number;
}

interface FetchResult<T> {
  data: T | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Async helpers
// ---------------------------------------------------------------------------

async function fetchNotification(id: string): Promise<Notification> {
  const response = await fetch(`/api/notifications/${id}`);
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<Notification>;
}

async function dismissNotification(id: string): Promise<void> {
  const response = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Dismiss failed: ${response.status}`);
  }
}

// ---------------------------------------------------------------------------
// [TRAP] Promise.all with individual .catch handlers — NOT missing error handling
// Each item's failure is caught individually and returns null rather than
// rejecting the whole batch.
// ---------------------------------------------------------------------------

export async function fetchAllNotifications(
  ids: string[]
): Promise<FetchResult<Notification>[]> {
  const settled = await Promise.all(
    ids.map(id =>
      fetchNotification(id)
        .then((data): FetchResult<Notification> => ({ data, error: null }))
        .catch((err: unknown): FetchResult<Notification> => ({
          data: null,
          error: err instanceof Error ? err.message : String(err),
        }))
    )
  );
  return settled;
}

// ---------------------------------------------------------------------------
// [TRAP] .then().catch() chain — properly handles both success and error paths
// ---------------------------------------------------------------------------

export function dismissWithFeedback(
  id: string,
  onSuccess: () => void,
  onError: (msg: string) => void
): void {
  dismissNotification(id)
    .then(() => {
      onSuccess();
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      onError(message);
    });
}

// ---------------------------------------------------------------------------
// [TRAP] !val check is intentional — 0 is not a valid count here
// The comment documents that 0 should be treated as absent/invalid.
// ---------------------------------------------------------------------------

export function hasUnreadCount(count: number | null | undefined): boolean {
  // 0 is intentionally treated as "no unread" — the server returns null
  // for "never loaded" and 0 for "explicitly checked, none found";
  // callers need both to resolve to false here.
  if (!count) return false;
  return count > 0;
}

// ---------------------------------------------------------------------------
// React component with proper useEffect cleanup
// ---------------------------------------------------------------------------

interface NotificationBannerProps {
  pollIntervalMs?: number;
  maxVisible?: number;
}

// [TRAP] setTimeout with clearTimeout cleanup in useEffect — correct React pattern
export function NotificationBanner({
  pollIntervalMs = 30_000,
  maxVisible = 5,
}: NotificationBannerProps): React.ReactElement {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadNotifications = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications?unread=true');
      if (response.ok) {
        const data = (await response.json()) as Notification[];
        setNotifications(data.slice(0, maxVisible));
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();

    const scheduleNext = (): void => {
      // [TRAP] setTimeout stored in ref and cleared in cleanup — correct pattern
      timerRef.current = setTimeout(() => {
        void loadNotifications();
        scheduleNext();
      }, pollIntervalMs);
    };

    scheduleNext();

    return () => {
      // Cleanup: cancel the pending timer when component unmounts
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pollIntervalMs]);

  const handleDismiss = (id: string): void => {
    dismissWithFeedback(
      id,
      () => setNotifications(prev => prev.filter(n => n.id !== id)),
      (msg) => console.error('Dismiss failed:', msg)
    );
  };

  if (loading && notifications.length === 0) {
    return React.createElement('div', { className: 'notification-loading' }, 'Loading...');
  }

  return React.createElement(
    'div',
    { className: 'notification-banner' },
    ...notifications.map(n =>
      React.createElement(
        'div',
        { key: n.id, className: `notification notification--${n.level}` },
        React.createElement('span', null, n.message),
        React.createElement('button', { onClick: () => handleDismiss(n.id) }, 'Dismiss')
      )
    )
  );
}
