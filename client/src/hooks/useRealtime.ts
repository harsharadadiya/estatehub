// Live updates: keeps an EventSource open while the user is logged in.
// When a viewing is booked, confirmed or cancelled, the dashboard data refreshes by itself.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { API_URL } from '@/lib/api';
import { formatDay, formatTime } from '@/lib/format';
import { realtimeService } from '@/services';
import type { User } from '@/types';

interface AppointmentEvent {
  appointmentId: string;
  ownerId: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  date: string;
  time: string;
  name: string;
}

export function useRealtime(user: User | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || typeof EventSource === 'undefined') return;
    const userId = user._id;

    let source: EventSource | null = null;
    let retryTimer: number | undefined;
    let stopped = false;
    let failures = 0;

    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['slots'] });
    };

    async function connect() {
      try {
        const ticket = await realtimeService.ticket(); // a fresh 60-second ticket for each connection
        if (stopped) return;
        source = new EventSource(`${API_URL}/realtime/stream?ticket=${encodeURIComponent(ticket)}`);

        source.addEventListener('ready', () => {
          failures = 0;
        });
        source.addEventListener('appointment.created', (e) => {
          const data = JSON.parse((e as MessageEvent).data) as AppointmentEvent;
          refresh();
          // Only the owner hears about new requests (the visitor already saw their own booking succeed)
          if (data.ownerId === userId) toast.info(`New viewing request from ${data.name} for ${formatDay(data.date, 'd MMM')}, ${formatTime(data.time)}`);
        });
        source.addEventListener('appointment.updated', (e) => {
          const data = JSON.parse((e as MessageEvent).data) as AppointmentEvent;
          refresh();
          // Only the visitor hears about confirmations (the owner just clicked "Confirm")
          if (data.status === 'confirmed' && data.ownerId !== userId) toast.success(`Viewing on ${formatDay(data.date, 'd MMM')} at ${formatTime(data.time)} is confirmed`);
        });
        // The ticket only works once, so on any error close and reconnect with a new ticket
        source.onerror = () => {
          source?.close();
          scheduleReconnect();
        };
      } catch {
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      if (stopped) return;
      failures += 1;
      const delay = Math.min(60_000, 2000 * 2 ** Math.min(failures, 5)); // backoff up to 1 minute
      retryTimer = window.setTimeout(connect, delay);
    }

    void connect();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      source?.close();
    };
  }, [user, queryClient]);
}
