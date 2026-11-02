import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import {
  AvailabilityRecord,
  Participant,
  SchedulerEvent,
} from '../models/scheduler.models';
import {
  calculateDaysInclusive,
  hashPassword,
  isValidIsoDate,
} from '../utils/scheduler.utils';

interface LocalStoreSchema {
  events: SchedulerEvent[];
  participants: Participant[];
  availabilities: AvailabilityRecord[];
}

const LEGACY_DEMO_EVENT_ID = '11111111-2222-3333-4444-555555555555';
const LOCAL_STORAGE_DB_KEY = 'syncup_local_db_v1';
const UNLOCKED_EVENTS_KEY = 'syncup_unlocked_events_v1';
const OWNED_PARTICIPANTS_KEY = 'syncup_owned_participants_v1';
const ADMIN_EVENTS_KEY = 'syncup_admin_events_v1';
const GLOBAL_USER_NAME_KEY = 'syncup_global_user_name_v1';
const MERGED_TO_SERVER_KEY = 'syncup_merged_to_server_v1';

export interface OwnedParticipantIdentity {
  participantId: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient | null = null;
  readonly isUsingSupabase: boolean;

  constructor() {
    const url = environment.supabaseUrl?.trim();
    const key = environment.supabaseAnonKey?.trim();
    if (url && key) {
      this.supabase = createClient(url, key);
      this.isUsingSupabase = true;
    } else {
      this.isUsingSupabase = false;
      this.purgeLegacyDemoEventFromLocal();
    }
  }

  private getLocalApiBaseUrl(): string {
    const host =
      typeof window !== 'undefined' && window.location?.hostname
        ? window.location.hostname
        : '127.0.0.1';
    return `http://${host}:4201/api/db`;
  }

  // ============================================================================
  // Password & LocalStorage Auth Gate Management
  // ============================================================================

  /**
   * Checks if the user has already unlocked this event in localStorage.
   */
  isEventUnlocked(eventId: string, expectedPasswordHash: string): boolean {
    const unlockedMap = this.getUnlockedEventsMap();
    return unlockedMap[eventId] === expectedPasswordHash;
  }

  /**
   * Stores the verified password hash in localStorage so the participant isn't re-prompted.
   */
  markEventUnlocked(eventId: string, passwordHash: string): void {
    const unlockedMap = this.getUnlockedEventsMap();
    unlockedMap[eventId] = passwordHash;
    localStorage.setItem(UNLOCKED_EVENTS_KEY, JSON.stringify(unlockedMap));
  }

  private getUnlockedEventsMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem(UNLOCKED_EVENTS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  // ============================================================================
  // Browser-Bound Participant Identity (No Accounts, Prevents Editing Others)
  // ============================================================================

  /**
   * Retrieves the global user name remembered across all polls in this browser.
   */
  getGlobalUserName(): string | null {
    try {
      const name = localStorage.getItem(GLOBAL_USER_NAME_KEY)?.trim();
      return name || null;
    } catch {
      return null;
    }
  }

  /**
   * Saves the global user name across all polls in this browser.
   */
  setGlobalUserName(name: string): void {
    const clean = name.trim().slice(0, 60);
    if (!clean) return;
    localStorage.setItem(GLOBAL_USER_NAME_KEY, clean);
  }

  /**
   * Retrieves the participant identity saved in this browser for the given event.
   */
  getOwnedParticipant(eventId: string): OwnedParticipantIdentity | null {
    const map = this.getOwnedParticipantsMap();
    return map[eventId] ?? null;
  }

  /**
   * Binds a participant ID & name to this event in localStorage and updates the global user name.
   */
  saveOwnedParticipant(eventId: string, identity: OwnedParticipantIdentity): void {
    const map = this.getOwnedParticipantsMap();
    map[eventId] = identity;
    localStorage.setItem(OWNED_PARTICIPANTS_KEY, JSON.stringify(map));
    this.setGlobalUserName(identity.name);
  }

  private getOwnedParticipantsMap(): Record<string, OwnedParticipantIdentity> {
    try {
      const raw = localStorage.getItem(OWNED_PARTICIPANTS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /**
   * Clears the browser-owned participant identity for an event (if deleted).
   */
  clearOwnedParticipant(eventId: string): void {
    const map = this.getOwnedParticipantsMap();
    delete map[eventId];
    localStorage.setItem(OWNED_PARTICIPANTS_KEY, JSON.stringify(map));
  }

  // ============================================================================
  // Poll Creator / Admin Management (Saved in Browser Storage on Creation)
  // ============================================================================

  /**
   * Checks if the current browser is the creator/admin of this event.
   */
  isEventAdmin(eventId: string): boolean {
    const map = this.getAdminEventsMap();
    return !!map[eventId];
  }

  /**
   * Marks the current browser as the creator/admin of an event in localStorage.
   */
  markEventAdmin(eventId: string): void {
    const map = this.getAdminEventsMap();
    map[eventId] = true;
    localStorage.setItem(ADMIN_EVENTS_KEY, JSON.stringify(map));
  }

  private getAdminEventsMap(): Record<string, boolean> {
    try {
      const raw = localStorage.getItem(ADMIN_EVENTS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      delete parsed[LEGACY_DEMO_EVENT_ID];
      return parsed;
    } catch {
      return {};
    }
  }

  /**
   * Returns all events created/administered by this browser.
   */
  async getMyCreatedEvents(): Promise<SchedulerEvent[]> {
    const adminMap = this.getAdminEventsMap();
    const adminIds = new Set<string>(
      Object.keys(adminMap).filter((k) => adminMap[k] && k !== LEGACY_DEMO_EVENT_ID)
    );

    if (this.supabase) {
      const ids = Array.from(adminIds);
      if (ids.length === 0) return [];
      const { data, error } = await this.supabase
        .from('events')
        .select('*')
        .in('id', ids)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []) as SchedulerEvent[];
    }

    const db = await this.fetchSyncedDb();
    return db.events
      .filter((e) => adminIds.has(e.id))
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  }

  /**
   * Updates an event's title, start_date, end_date (adds/removes days), and optionally its shared password.
   * Also cleans up any availability records that fall outside the new date range.
   */
  async updateEventSettings(
    eventId: string,
    params: {
      title: string;
      start_date: string;
      end_date: string;
      new_raw_password?: string;
    }
  ): Promise<SchedulerEvent> {
    const cleanTitle = params.title.trim().slice(0, 120);
    if (!cleanTitle) throw new Error('Event title is required.');

    if (!isValidIsoDate(params.start_date) || !isValidIsoDate(params.end_date)) {
      throw new Error('Invalid start or end date format.');
    }

    const days = calculateDaysInclusive(params.start_date, params.end_date);
    if (days <= 0 || days > 90) {
      throw new Error('Date range must be between 1 and 90 days.');
    }

    let newPasswordHash: string | undefined;
    if (params.new_raw_password && params.new_raw_password.trim()) {
      newPasswordHash = await hashPassword(params.new_raw_password);
    }

    if (this.supabase) {
      const updatePayload: Partial<SchedulerEvent> = {
        title: cleanTitle,
        start_date: params.start_date,
        end_date: params.end_date,
      };
      if (newPasswordHash) {
        updatePayload.password_hash = newPasswordHash;
      }

      const { data, error } = await this.supabase
        .from('events')
        .update(updatePayload)
        .eq('id', eventId)
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Remove out-of-range availabilities using separate safe lt / gt queries
      await Promise.all([
        this.supabase
          .from('availabilities')
          .delete()
          .eq('event_id', eventId)
          .lt('date', params.start_date),
        this.supabase
          .from('availabilities')
          .delete()
          .eq('event_id', eventId)
          .gt('date', params.end_date),
      ]);

      const updated = data as SchedulerEvent;
      this.markEventUnlocked(updated.id, updated.password_hash);
      return updated;
    }

    const db = await this.fetchSyncedDb();
    const idx = db.events.findIndex((e) => e.id === eventId);
    if (idx === -1) throw new Error('Event not found.');

    const updatedEvent: SchedulerEvent = {
      ...db.events[idx],
      title: cleanTitle,
      start_date: params.start_date,
      end_date: params.end_date,
      password_hash: newPasswordHash ?? db.events[idx].password_hash,
    };
    db.events[idx] = updatedEvent;

    db.availabilities = db.availabilities.filter(
      (a) =>
        a.event_id !== eventId ||
        (a.date >= params.start_date && a.date <= params.end_date)
    );

    await this.saveSyncedDb(db);
    this.markEventUnlocked(updatedEvent.id, updatedEvent.password_hash);
    return updatedEvent;
  }

  /**
   * Deletes an entire poll created by the admin.
   */
  async deleteEvent(eventId: string): Promise<void> {
    if (this.supabase) {
      const { error } = await this.supabase.from('events').delete().eq('id', eventId);
      if (error) throw new Error(error.message);
    } else {
      const db = await this.fetchSyncedDb();
      db.events = db.events.filter((e) => e.id !== eventId);
      db.participants = db.participants.filter((p) => p.event_id !== eventId);
      db.availabilities = db.availabilities.filter((a) => a.event_id !== eventId);
      await this.saveSyncedDb(db);
    }
    const adminMap = this.getAdminEventsMap();
    delete adminMap[eventId];
    localStorage.setItem(ADMIN_EVENTS_KEY, JSON.stringify(adminMap));
  }

  // ============================================================================
  // Database Operations (Supabase REST API + Shared Local Sync Server)
  // ============================================================================

  async createEvent(params: {
    title: string;
    start_date: string;
    end_date: string;
    raw_password: string;
  }): Promise<SchedulerEvent> {
    const cleanTitle = params.title.trim().slice(0, 120);
    if (!cleanTitle) throw new Error('Please enter a poll title.');

    if (!isValidIsoDate(params.start_date) || !isValidIsoDate(params.end_date)) {
      throw new Error('Invalid date format.');
    }

    const days = calculateDaysInclusive(params.start_date, params.end_date);
    if (days <= 0 || days > 90) {
      throw new Error('Date range must be between 1 and 90 days.');
    }

    const password_hash = await hashPassword(params.raw_password);

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('events')
        .insert({
          title: cleanTitle,
          start_date: params.start_date,
          end_date: params.end_date,
          password_hash,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      const created = data as SchedulerEvent;
      this.markEventUnlocked(created.id, created.password_hash);
      this.markEventAdmin(created.id);
      return created;
    }

    const db = await this.fetchSyncedDb();
    const newEvent: SchedulerEvent = {
      id: crypto.randomUUID ? crypto.randomUUID() : `evt-${Date.now()}`,
      title: cleanTitle,
      start_date: params.start_date,
      end_date: params.end_date,
      password_hash,
      created_at: new Date().toISOString(),
    };
    db.events.push(newEvent);
    await this.saveSyncedDb(db);
    this.markEventUnlocked(newEvent.id, newEvent.password_hash);
    this.markEventAdmin(newEvent.id);
    return newEvent;
  }

  async getEventById(
    eventId: string,
    sharedFallback?: SchedulerEvent | null
  ): Promise<SchedulerEvent | null> {
    if (eventId === LEGACY_DEMO_EVENT_ID) {
      return null;
    }

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return (data as SchedulerEvent | null) ?? sharedFallback ?? null;
    }

    const db = await this.fetchSyncedDb();
    let found = db.events.find((e) => e.id === eventId) ?? null;
    if (!found && sharedFallback && sharedFallback.id === eventId) {
      db.events.push(sharedFallback);
      await this.saveSyncedDb(db);
      found = sharedFallback;
    }
    return found;
  }

  async getEventParticipantsAndAvailabilities(eventId: string): Promise<{
    participants: Participant[];
    availabilities: AvailabilityRecord[];
  }> {
    if (this.supabase) {
      const [participantsRes, availabilitiesRes] = await Promise.all([
        this.supabase
          .from('participants')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true }),
        this.supabase
          .from('availabilities')
          .select('*')
          .eq('event_id', eventId),
      ]);

      if (participantsRes.error) throw new Error(participantsRes.error.message);
      if (availabilitiesRes.error) throw new Error(availabilitiesRes.error.message);

      return {
        participants: (participantsRes.data ?? []) as Participant[],
        availabilities: (availabilitiesRes.data ?? []) as AvailabilityRecord[],
      };
    }

    const db = await this.fetchSyncedDb();
    return {
      participants: db.participants.filter((p) => p.event_id === eventId),
      availabilities: db.availabilities.filter((a) => a.event_id === eventId),
    };
  }

  /**
   * Resolves the browser's owned participant if one already exists in localStorage,
   * or creates a brand-new participant while rejecting names that belong to someone else.
   */
  async registerOrResolveOwnParticipant(
    eventId: string,
    requestedName: string
  ): Promise<{ participant: Participant; isExisting: boolean }> {
    const cleanName = requestedName.trim().slice(0, 60);
    if (!cleanName) throw new Error('Please enter your name.');

    const owned = this.getOwnedParticipant(eventId);

    if (this.supabase) {
      const { data: existingList, error: fetchErr } = await this.supabase
        .from('participants')
        .select('*')
        .eq('event_id', eventId);

      if (fetchErr) throw new Error(fetchErr.message);

      const match = (existingList ?? []).find(
        (p: Participant) => p.name.toLowerCase() === cleanName.toLowerCase()
      ) as Participant | undefined;

      if (match) {
        if (owned && owned.participantId === match.id) {
          return { participant: match, isExisting: true };
        }
        throw new Error(
          `"${match.name}" has already been submitted by another participant. Please add an initial or nickname so you don't overwrite their schedule.`
        );
      }

      const { data: created, error: insertErr } = await this.supabase
        .from('participants')
        .insert({
          event_id: eventId,
          name: cleanName,
        })
        .select()
        .single();

      if (insertErr) throw new Error(insertErr.message);
      const participant = created as Participant;
      this.saveOwnedParticipant(eventId, {
        participantId: participant.id,
        name: participant.name,
      });
      return { participant, isExisting: false };
    }

    const db = await this.fetchSyncedDb();
    const existing = db.participants.find(
      (p) => p.event_id === eventId && p.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      if (owned && owned.participantId === existing.id) {
        return { participant: existing, isExisting: true };
      }
      throw new Error(
        `"${existing.name}" has already been submitted by another participant. Please add an initial or nickname so you don't overwrite their schedule.`
      );
    }

    const created: Participant = {
      id: crypto.randomUUID ? crypto.randomUUID() : `part-${Date.now()}`,
      event_id: eventId,
      name: cleanName,
      created_at: new Date().toISOString(),
    };
    db.participants.push(created);
    await this.saveSyncedDb(db);
    this.saveOwnedParticipant(eventId, {
      participantId: created.id,
      name: created.name,
    });
    return { participant: created, isExisting: false };
  }

  /**
   * Updates the global user name and renames the user's participant record in the current event
   * (and any other locally stored events owned by this browser where the name is not taken).
   */
  async updateOwnName(eventId: string, newName: string): Promise<string> {
    const cleanName = newName.trim().slice(0, 60);
    if (!cleanName) throw new Error('Name cannot be empty.');

    const ownedMap = this.getOwnedParticipantsMap();
    const ownedInCurrent = ownedMap[eventId];

    if (this.supabase) {
      if (ownedInCurrent) {
        const { data: eventParticipants } = await this.supabase
          .from('participants')
          .select('*')
          .eq('event_id', eventId);

        const conflict = (eventParticipants ?? []).some(
          (p: Participant) =>
            p.id !== ownedInCurrent.participantId &&
            p.name.toLowerCase() === cleanName.toLowerCase()
        );

        if (conflict) {
          throw new Error(`"${cleanName}" is already taken in this poll.`);
        }

        const { error } = await this.supabase
          .from('participants')
          .update({ name: cleanName })
          .eq('id', ownedInCurrent.participantId)
          .eq('event_id', eventId);

        if (error) throw new Error(error.message);
        ownedMap[eventId] = { participantId: ownedInCurrent.participantId, name: cleanName };
        localStorage.setItem(OWNED_PARTICIPANTS_KEY, JSON.stringify(ownedMap));
      }
      this.setGlobalUserName(cleanName);
      return cleanName;
    }

    const db = await this.fetchSyncedDb();
    if (ownedInCurrent) {
      const conflict = db.participants.find(
        (p) =>
          p.event_id === eventId &&
          p.id !== ownedInCurrent.participantId &&
          p.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (conflict) {
        throw new Error(`"${cleanName}" is already taken in this poll.`);
      }
    }

    for (const [evtId, ident] of Object.entries(ownedMap)) {
      const conflictInOtherPoll = db.participants.some(
        (p) =>
          p.event_id === evtId &&
          p.id !== ident.participantId &&
          p.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (!conflictInOtherPoll) {
        const p = db.participants.find(
          (item) => item.id === ident.participantId && item.event_id === evtId
        );
        if (p) {
          p.name = cleanName;
        }
        ownedMap[evtId] = { participantId: ident.participantId, name: cleanName };
      }
    }

    await this.saveSyncedDb(db);
    localStorage.setItem(OWNED_PARTICIPANTS_KEY, JSON.stringify(ownedMap));
    this.setGlobalUserName(cleanName);
    return cleanName;
  }

  /**
   * Saves the full set of availability records for a participant on an event.
   */
  async saveParticipantAvailabilities(
    eventId: string,
    participantId: string,
    records: AvailabilityRecord[]
  ): Promise<void> {
    if (this.supabase) {
      const payload = records.map((r) => ({
        participant_id: participantId,
        event_id: eventId,
        date: r.date,
        time_slot: r.time_slot,
        is_available: r.is_available,
      }));

      const { error } = await this.supabase
        .from('availabilities')
        .upsert(payload, { onConflict: 'participant_id,date,time_slot' });

      if (error) throw new Error(error.message);
      return;
    }

    const db = await this.fetchSyncedDb();
    db.availabilities = db.availabilities.filter(
      (a) => !(a.event_id === eventId && a.participant_id === participantId)
    );
    for (const r of records) {
      db.availabilities.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `av-${Math.random()}`,
        participant_id: participantId,
        event_id: eventId,
        date: r.date,
        time_slot: r.time_slot,
        is_available: r.is_available,
      });
    }
    await this.saveSyncedDb(db);
  }

  /**
   * Deletes a participant and all of their availability records from the event (Admin action).
   */
  async deleteParticipant(eventId: string, participantId: string): Promise<void> {
    if (this.supabase) {
      const { error } = await this.supabase
        .from('participants')
        .delete()
        .eq('id', participantId)
        .eq('event_id', eventId);

      if (error) throw new Error(error.message);
    } else {
      const db = await this.fetchSyncedDb();
      db.participants = db.participants.filter(
        (p) => !(p.id === participantId && p.event_id === eventId)
      );
      db.availabilities = db.availabilities.filter(
        (a) => !(a.participant_id === participantId && a.event_id === eventId)
      );
      await this.saveSyncedDb(db);
    }

    const owned = this.getOwnedParticipant(eventId);
    if (owned && owned.participantId === participantId) {
      this.clearOwnedParticipant(eventId);
    }
  }

  // ============================================================================
  // Shared Local Server + LocalStorage Sync Engine
  // ============================================================================

  private purgeLegacyDemoEventFromLocal(): void {
    try {
      const db = this.readLocalDb();
      const filtered: LocalStoreSchema = {
        events: db.events.filter((e) => e.id !== LEGACY_DEMO_EVENT_ID),
        participants: db.participants.filter((p) => p.event_id !== LEGACY_DEMO_EVENT_ID),
        availabilities: db.availabilities.filter((a) => a.event_id !== LEGACY_DEMO_EVENT_ID),
      };
      this.writeLocalDb(filtered);
    } catch {
      // ignore
    }
  }

  private async fetchSyncedDb(): Promise<LocalStoreSchema> {
    const localDb = this.readLocalDb();
    const apiUrl = this.getLocalApiBaseUrl();

    try {
      const alreadyMerged = localStorage.getItem(MERGED_TO_SERVER_KEY) === 'true';
      if (
        !alreadyMerged &&
        (localDb.events.length > 0 ||
          localDb.participants.length > 0 ||
          localDb.availabilities.length > 0)
      ) {
        const mergeRes = await fetch(`${apiUrl}/merge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localDb),
        });
        if (mergeRes.ok) {
          const merged = (await mergeRes.json()) as LocalStoreSchema;
          localStorage.setItem(MERGED_TO_SERVER_KEY, 'true');
          this.writeLocalDb(merged);
          return merged;
        }
      }

      const res = await fetch(apiUrl, { method: 'GET' });
      if (res.ok) {
        const remoteDb = (await res.json()) as LocalStoreSchema;
        localStorage.setItem(MERGED_TO_SERVER_KEY, 'true');
        this.writeLocalDb(remoteDb);
        return remoteDb;
      }
    } catch {
      // Fallback to localStorage if local sync server is unreachable
    }

    return localDb;
  }

  private async saveSyncedDb(db: LocalStoreSchema): Promise<void> {
    this.writeLocalDb(db);
    try {
      const res = await fetch(this.getLocalApiBaseUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db),
      });
      if (res.ok) {
        const saved = (await res.json()) as LocalStoreSchema;
        this.writeLocalDb(saved);
      }
    } catch {
      // Fallback to localStorage if local sync server is unreachable
    }
  }

  private readLocalDb(): LocalStoreSchema {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LocalStoreSchema;
        return {
          events: (parsed.events ?? []).filter((e) => e.id !== LEGACY_DEMO_EVENT_ID),
          participants: (parsed.participants ?? []).filter(
            (p) => p.event_id !== LEGACY_DEMO_EVENT_ID
          ),
          availabilities: (parsed.availabilities ?? []).filter(
            (a) => a.event_id !== LEGACY_DEMO_EVENT_ID
          ),
        };
      }
    } catch {
      // ignore parse errors
    }
    return { events: [], participants: [], availabilities: [] };
  }

  private writeLocalDb(db: LocalStoreSchema): void {
    localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(db));
  }
}
