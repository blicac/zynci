export type TimeSlot = 'morning' | 'afternoon' | 'evening';

export const TIME_SLOTS: { key: TimeSlot; shortLabel: string; fullLabel: string; timeHint: string }[] = [
  { key: 'morning', shortLabel: 'M', fullLabel: 'Morning', timeHint: '8am – 12pm' },
  { key: 'afternoon', shortLabel: 'A', fullLabel: 'Afternoon', timeHint: '12pm – 5pm' },
  { key: 'evening', shortLabel: 'E', fullLabel: 'Evening', timeHint: '5pm – 10pm' },
];

export type SelectionPaintMode = 'available' | 'unavailable';

export interface SchedulerEvent {
  id: string;
  title: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  password_hash: string;
  created_at?: string;
}

export interface Participant {
  id: string;
  event_id: string;
  user_id?: string;
  name: string;
  created_at?: string;
}

export interface AvailabilityRecord {
  id?: string;
  participant_id: string;
  event_id: string;
  date: string; // YYYY-MM-DD
  time_slot: TimeSlot;
  is_available: boolean;
}

export type DayFilterRule = 'weekdays' | 'weekends' | 'everyday';

export interface GlobalAvailabilityRules {
  /**
   * Availability by day-of-week index (0 = Sun, 1 = Mon, ..., 6 = Sat) and slot ('morning' | 'afternoon' | 'evening').
   */
  byDayOfWeek: Record<number, Record<TimeSlot, boolean>>;
}

export interface DayRowInfo {
  dateStr: string;       // YYYY-MM-DD
  displayLabel: string;  // e.g. "Mon, Nov 2"
  weekdayShort: string;  // e.g. "Mon"
  dayNum: string;        // e.g. "2"
  monthShort: string;    // e.g. "Nov"
  dayMonthSlash: string; // e.g. "22/11"
  dayOfWeek: number;     // 0 (Sun) - 6 (Sat)
  isWeekend: boolean;
}

export interface SlotConsensus {
  dateStr: string;
  displayDate: string;   // e.g., "Nov 12"
  fullDateLabel: string; // e.g., "Thu, Nov 12"
  slot: TimeSlot;
  slotLabel: string;     // e.g., "Evening"
  availableNames: string[];
  unavailableNames: string[];
  availableCount: number;
  totalParticipants: number;
  ratio: number; // 0..1
}
