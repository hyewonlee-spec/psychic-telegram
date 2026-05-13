import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Grid3X3,
  ImagePlus,
  Loader2,
  LogOut,
  MapPin,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { CALENDAR_PHOTOS_BUCKET, supabase } from './lib/supabase';
import type { CalendarEntry, EntryWithUrl } from './types';
import {
  formatDisplayDate,
  formatMonth,
  getMonthMatrix,
  getMonthRange,
  toDateKey,
} from './utils/date';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type AppSection = 'calendar' | 'venues';

type VenueStatus = 'want_to_go' | 'visited' | 'not_interested';
type VenueType = 'cafe' | 'restaurant' | 'bar' | 'bakery' | 'dessert' | 'other';

type Venue = {
  id: string;
  user_id: string;
  name: string;
  venue_type: VenueType;
  status: VenueStatus;
  instagram_handle: string | null;
  instagram_url: string | null;
  notes: string | null;
  rating: number | null;
  visited_at: string | null;
  created_at: string;
  updated_at: string;
};

type VenueFormState = {
  name: string;
  venue_type: VenueType;
  status: VenueStatus;
  instagram_handle: string;
  instagram_url: string;
  notes: string;
  rating: number | null;
  visited_at: string;
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return <FullPageLoader label="Opening your calendar..." />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <CalendarApp session={session} />;
}

function AuthScreen() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const authAction =
      mode === 'sign-in'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { error } = await authAction;

    if (error) {
      setMessage(error.message);
    } else if (mode === 'sign-up') {
      setMessage('Account created. Check your email if confirmation is enabled, then sign in.');
    }

    setLoading(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">MC</div>
        <p className="eyebrow">Memory Calendar</p>
        <h1>Put a picture on each day.</h1>
        <p className="auth-intro">
          A private photo calendar for saving one picture and a short caption per day.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {message && <p className="form-message">{message}</p>}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading && <Loader2 className="spin" size={18} />}
            {mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          className="text-button"
          type="button"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setMessage('');
          }}
        >
          {mode === 'sign-in' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
        </button>
      </section>
    </main>
  );
}

function CalendarApp({ session }: { session: Session }) {
  const [activeMonth, setActiveMonth] = useState(() => new Date());
  const [entries, setEntries] = useState<Record<string, EntryWithUrl>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [viewMode, setViewMode] = useState<'calendar' | 'photos'>('calendar');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installMessage, setInstallMessage] = useState('');
  const [appSection, setAppSection] = useState<AppSection>('calendar');

  const monthDays = useMemo(() => getMonthMatrix(activeMonth), [activeMonth]);
  const selectedEntry = selectedDate ? entries[selectedDate] : undefined;

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  async function handleInstallApp() {
    if (!installPrompt) {
      setInstallMessage('On iPhone/iPad: open Safari, tap Share, then Add to Home Screen.');
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      setInstallMessage('Install started.');
      setInstallPrompt(null);
    } else {
      setInstallMessage('Install cancelled. You can try again later.');
    }
  }

  async function loadEntries(month = activeMonth) {
    setLoading(true);
    setStatus('');

    const { start, end } = getMonthRange(month);
    const { data, error } = await supabase
      .from('calendar_entries')
      .select('*')
      .gte('entry_date', start)
      .lte('entry_date', end)
      .order('entry_date', { ascending: true });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    const entriesWithUrls = await Promise.all(
      (data ?? []).map(async (entry: CalendarEntry): Promise<EntryWithUrl> => {
        if (!entry.photo_path) return entry;

        const { data: signedData } = await supabase.storage
          .from(CALENDAR_PHOTOS_BUCKET)
          .createSignedUrl(entry.photo_path, 60 * 60);

        return {
          ...entry,
          signedUrl: signedData?.signedUrl,
        };
      }),
    );

    const nextEntries = entriesWithUrls.reduce<Record<string, EntryWithUrl>>((acc, entry) => {
      acc[entry.entry_date] = entry;
      return acc;
    }, {});

    setEntries(nextEntries);
    setLoading(false);
  }

  useEffect(() => {
    loadEntries(activeMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth]);

  function moveMonth(direction: -1 | 1) {
    setActiveMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  async function handleSaveDay(input: { dateKey: string; caption: string; file: File | null; removePhoto: boolean }) {
    setStatus('');
    const currentEntry = entries[input.dateKey];
    let photoPath = currentEntry?.photo_path ?? null;

    if ((input.removePhoto || input.file) && currentEntry?.photo_path) {
      await supabase.storage.from(CALENDAR_PHOTOS_BUCKET).remove([currentEntry.photo_path]);
      photoPath = null;
    }

    if (input.file) {
      const extension = input.file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const safeFileName = `${crypto.randomUUID()}.${extension}`;
      const storagePath = `${session.user.id}/${input.dateKey}/${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from(CALENDAR_PHOTOS_BUCKET)
        .upload(storagePath, input.file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        setStatus(uploadError.message);
        return;
      }

      photoPath = storagePath;
    }

    const { error } = await supabase.from('calendar_entries').upsert(
      {
        user_id: session.user.id,
        entry_date: input.dateKey,
        caption: input.caption.trim() || null,
        photo_path: photoPath,
      },
      { onConflict: 'user_id,entry_date' },
    );

    if (error) {
      setStatus(error.message);
      return;
    }

    setSelectedDate(null);
    await loadEntries(activeMonth);
  }

  async function handleDeleteDay(dateKey: string) {
    const entry = entries[dateKey];
    if (!entry) return;

    setStatus('');

    if (entry.photo_path) {
      await supabase.storage.from(CALENDAR_PHOTOS_BUCKET).remove([entry.photo_path]);
    }

    const { error } = await supabase.from('calendar_entries').delete().eq('id', entry.id);

    if (error) {
      setStatus(error.message);
      return;
    }

    setSelectedDate(null);
    await loadEntries(activeMonth);
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">{appSection === 'calendar' ? 'Private photo diary' : 'Places to try'}</p>
          <h1>{appSection === 'calendar' ? 'Memory Calendar' : 'Venues'}</h1>
        </div>

        <div className="top-actions">
          <button className="install-button" type="button" onClick={handleInstallApp}>
            <Download size={16} />
            Install
          </button>

          <button className="icon-button" type="button" onClick={() => supabase.auth.signOut()} aria-label="Sign out">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <nav className="app-nav" aria-label="App sections">
        <button
          className={appSection === 'calendar' ? 'app-nav__button app-nav__button--active' : 'app-nav__button'}
          type="button"
          onClick={() => setAppSection('calendar')}
        >
          <CalendarDays size={16} />
          Calendar
        </button>

        <button
          className={appSection === 'venues' ? 'app-nav__button app-nav__button--active' : 'app-nav__button'}
          type="button"
          onClick={() => setAppSection('venues')}
        >
          <MapPin size={16} />
          Venues
        </button>
      </nav>

      {appSection === 'calendar' ? (
        <section className="calendar-card">
          <div className="month-toolbar">
            <button className="icon-button" type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">
              <ChevronLeft size={22} />
            </button>

            <div>
              <h2>{formatMonth(activeMonth)}</h2>
              <p>
                {loading
                  ? 'Loading photos...'
                  : `${Object.keys(entries).length} saved day${Object.keys(entries).length === 1 ? '' : 's'}`}
              </p>
            </div>

            <button className="icon-button" type="button" onClick={() => moveMonth(1)} aria-label="Next month">
              <ChevronRight size={22} />
            </button>
          </div>

          <div className="view-toggle" aria-label="Calendar display options">
            <button
              className={viewMode === 'calendar' ? 'view-toggle__button view-toggle__button--active' : 'view-toggle__button'}
              type="button"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarDays size={16} />
              Calendar
            </button>

            <button
              className={viewMode === 'photos' ? 'view-toggle__button view-toggle__button--active' : 'view-toggle__button'}
              type="button"
              onClick={() => setViewMode('photos')}
            >
              <Grid3X3 size={16} />
              Photo view
            </button>
          </div>

          {status && <p className="status-message">{status}</p>}
          {installMessage && <p className="status-message">{installMessage}</p>}

          {viewMode === 'calendar' ? (
            <>
              <div className="weekday-grid" aria-hidden="true">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="calendar-grid">
                {monthDays.map((date, index) => {
                  if (!date) return <div className="day-cell day-cell--empty" key={`empty-${index}`} />;

                  const dateKey = toDateKey(date);
                  const entry = entries[dateKey];
                  const isToday = dateKey === toDateKey(new Date());

                  return (
                    <button
                      key={dateKey}
                      className={`day-cell ${entry?.signedUrl ? 'day-cell--photo' : ''} ${
                        isToday ? 'day-cell--today' : ''
                      }`}
                      type="button"
                      onClick={() => setSelectedDate(dateKey)}
                    >
                      {entry?.signedUrl ? (
                        <img src={entry.signedUrl} alt={entry.caption || `Memory for ${dateKey}`} />
                      ) : (
                        <span className="empty-photo">
                          <ImagePlus size={18} />
                        </span>
                      )}

                      <span className="date-badge">{date.getDate()}</span>
                      {entry?.caption && <span className="note-dot" aria-label="Caption saved" title={entry.caption} />}
                      {entry?.caption && <span className="caption-strip">{entry.caption}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <section className="photo-view" aria-label="Large monthly photo view">
              {Object.values(entries).filter((entry) => entry.signedUrl).length === 0 ? (
                <div className="photo-view-empty">
                  <ImagePlus size={30} />
                  <h3>No photos saved for this month yet.</h3>
                  <p>Switch back to Calendar and tap a day to add your first picture.</p>
                </div>
              ) : (
                Object.values(entries)
                  .filter((entry) => entry.signedUrl)
                  .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
                  .map((entry) => (
                    <button
                      key={entry.id}
                      className="photo-view-card"
                      type="button"
                      onClick={() => setSelectedDate(entry.entry_date)}
                    >
                      <img src={entry.signedUrl} alt={entry.caption || `Memory for ${entry.entry_date}`} />
                      <span className="photo-view-date">{formatDisplayDate(entry.entry_date)}</span>
                      {entry.caption && <span className="photo-view-caption">{entry.caption}</span>}
                    </button>
                  ))
              )}
            </section>
          )}
        </section>
      ) : (
        <VenuesPanel session={session} />
      )}

      <footer className="app-footer">
        {appSection === 'calendar'
          ? viewMode === 'calendar'
            ? 'Tap a day to add, change, or remove its picture.'
            : 'Photo view shows this month’s saved pictures in a larger 4:3 layout.'
          : 'Save Instagram venue links, then mark places as visited and rate them.'}
      </footer>

      {selectedDate && (
        <DayModal
          dateKey={selectedDate}
          entry={selectedEntry}
          onClose={() => setSelectedDate(null)}
          onSave={handleSaveDay}
          onDelete={handleDeleteDay}
        />
      )}
    </main>
  );
}

function cleanInstagramUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    if (!url.hostname.includes('instagram.com')) return trimmed;

    const handle = extractInstagramHandle(url.toString());
    return handle ? `https://www.instagram.com/${handle}` : url.origin;
  } catch {
    return trimmed;
  }
}

function extractInstagramHandle(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;

  try {
    const url = new URL(withoutAt.startsWith('http') ? withoutAt : `https://${withoutAt}`);
    if (!url.hostname.includes('instagram.com')) return '';

    const firstPathPart = url.pathname.split('/').filter(Boolean)[0] ?? '';
    const blockedPaths = ['p', 'reel', 'reels', 'stories', 'explore', 'accounts'];

    if (!firstPathPart || blockedPaths.includes(firstPathPart.toLowerCase())) return '';

    return firstPathPart.replace(/^@/, '');
  } catch {
    const simple = withoutAt
      .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
      .split(/[/?#]/)[0]
      .replace(/^@/, '');

    return simple.includes('.') || simple.includes('_') || simple.length > 1 ? simple : '';
  }
}

function titleFromInstagramHandle(handle: string) {
  if (!handle) return '';

  return handle
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function createEmptyVenueForm(): VenueFormState {
  return {
    name: '',
    venue_type: 'cafe',
    status: 'want_to_go',
    instagram_handle: '',
    instagram_url: '',
    notes: '',
    rating: null,
    visited_at: '',
  };
}

function formFromVenue(venue: Venue): VenueFormState {
  return {
    name: venue.name,
    venue_type: venue.venue_type,
    status: venue.status,
    instagram_handle: venue.instagram_handle ?? '',
    instagram_url: venue.instagram_url ?? '',
    notes: venue.notes ?? '',
    rating: venue.rating,
    visited_at: venue.visited_at ?? '',
  };
}

function VenuesPanel({ session }: { session: Session }) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [filter, setFilter] = useState<'all' | VenueStatus>('want_to_go');
  const [search, setSearch] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);

  async function loadVenues() {
    setLoading(true);
    setStatus('');

    const { data, error } = await supabase.from('venues').select('*').order('created_at', { ascending: false });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    setVenues((data ?? []) as Venue[]);
    setLoading(false);
  }

  useEffect(() => {
    loadVenues();
  }, []);

  function openNewVenue() {
    setEditingVenue(null);
    setIsEditorOpen(true);
  }

  const filteredVenues = venues.filter((venue) => {
    const matchesFilter = filter === 'all' || venue.status === filter;
    const q = search.trim().toLowerCase();

    const matchesSearch =
      !q ||
      venue.name.toLowerCase().includes(q) ||
      (venue.instagram_handle ?? '').toLowerCase().includes(q) ||
      (venue.notes ?? '').toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  const wantToGoCount = venues.filter((venue) => venue.status === 'want_to_go').length;
  const visitedCount = venues.filter((venue) => venue.status === 'visited').length;

  return (
    <section className="venues-card">
      <div className="venues-header">
        <div>
          <p className="eyebrow">Venue tracker</p>
          <h2>Places saved from Instagram</h2>
          <p>{loading ? 'Loading venues...' : `${wantToGoCount} to try · ${visitedCount} visited`}</p>
        </div>

        <button className="primary-button venue-add-button" type="button" onClick={openNewVenue}>
          <Plus size={18} />
          Add venue
        </button>
      </div>

      {status && <p className="status-message">{status}</p>}

      <div className="instagram-capture">
        <div>
          <h3>Quick save Instagram venue</h3>
          <p>Paste an Instagram profile link. The app will save the handle and link — no scraping needed.</p>
        </div>

        <button className="secondary-button" type="button" onClick={openNewVenue}>
          Paste link
        </button>
      </div>

      <div className="venue-tools">
        <label className="search-box">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search venues, handles, notes..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <div className="venue-filters" aria-label="Venue filters">
          {[
            ['want_to_go', 'Want to go'],
            ['visited', 'Visited'],
            ['all', 'All'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? 'venue-filter venue-filter--active' : 'venue-filter'}
              type="button"
              onClick={() => setFilter(value as 'all' | VenueStatus)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filteredVenues.length === 0 ? (
        <div className="venues-empty">
          <MapPin size={28} />
          <h3>{venues.length === 0 ? 'No venues saved yet.' : 'No venues match this view.'}</h3>
          <p>Save cafés, bars, and restaurants from Instagram, then mark them visited later.</p>
        </div>
      ) : (
        <div className="venue-list">
          {filteredVenues.map((venue) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              onEdit={() => {
                setEditingVenue(venue);
                setIsEditorOpen(true);
              }}
              onRefresh={loadVenues}
            />
          ))}
        </div>
      )}

      {isEditorOpen && (
        <VenueModal
          session={session}
          venue={editingVenue}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingVenue(null);
          }}
          onSaved={async () => {
            setIsEditorOpen(false);
            setEditingVenue(null);
            await loadVenues();
          }}
        />
      )}
    </section>
  );
}

function VenueCard({ venue, onEdit, onRefresh }: { venue: Venue; onEdit: () => void; onRefresh: () => Promise<void> }) {
  async function markVisited() {
    const { error } = await supabase
      .from('venues')
      .update({
        status: 'visited',
        visited_at: venue.visited_at ?? new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq('id', venue.id);

    if (!error) await onRefresh();
  }

  const instagramHref = venue.instagram_url || (venue.instagram_handle ? `https://www.instagram.com/${venue.instagram_handle}` : '');

  return (
    <article className="venue-card">
      <div className="venue-card__main">
        <div className="venue-card__title-row">
          <h3>{venue.name}</h3>
          <span className={`venue-status venue-status--${venue.status}`}>
            {venue.status === 'visited' ? 'Visited' : venue.status === 'not_interested' ? 'Not interested' : 'Want to go'}
          </span>
        </div>

        <p className="venue-meta">
          {venue.venue_type}
          {venue.instagram_handle && <> · @{venue.instagram_handle}</>}
        </p>

        {venue.notes && <p className="venue-notes">{venue.notes}</p>}

        {venue.status === 'visited' && (
          <div className="venue-rating" aria-label={venue.rating ? `${venue.rating} out of 5 stars` : 'No rating yet'}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} size={16} fill={venue.rating && star <= venue.rating ? 'currentColor' : 'none'} />
            ))}
            {venue.visited_at && <span>{venue.visited_at}</span>}
          </div>
        )}
      </div>

      <div className="venue-card__actions">
        {instagramHref && (
          <a className="icon-link" href={instagramHref} target="_blank" rel="noreferrer" aria-label="Open Instagram">
            <ExternalLink size={17} />
          </a>
        )}

        {venue.status !== 'visited' && (
          <button className="icon-button" type="button" onClick={markVisited} aria-label="Mark visited">
            <CheckCircle2 size={18} />
          </button>
        )}

        <button className="secondary-button venue-edit-button" type="button" onClick={onEdit}>
          Edit
        </button>
      </div>
    </article>
  );
}

function VenueModal({
  session,
  venue,
  onClose,
  onSaved,
}: {
  session: Session;
  venue: Venue | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<VenueFormState>(() => (venue ? formFromVenue(venue) : createEmptyVenueForm()));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  function updateField<K extends keyof VenueFormState>(key: K, value: VenueFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleInstagramChange(value: string) {
    const cleanedUrl = cleanInstagramUrl(value);
    const handle = extractInstagramHandle(cleanedUrl || value);
    const suggestedName = titleFromInstagramHandle(handle);

    setForm((current) => ({
      ...current,
      instagram_url: cleanedUrl,
      instagram_handle: handle,
      name: current.name || suggestedName,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    const payload = {
      user_id: session.user.id,
      name: form.name.trim(),
      venue_type: form.venue_type,
      status: form.status,
      instagram_handle: form.instagram_handle.trim() || null,
      instagram_url: form.instagram_url.trim() || null,
      notes: form.notes.trim() || null,
      rating: form.status === 'visited' ? form.rating : null,
      visited_at: form.status === 'visited' ? form.visited_at || new Date().toISOString().slice(0, 10) : null,
      updated_at: new Date().toISOString(),
    };

    if (!payload.name) {
      setMessage('Venue name is required.');
      setSaving(false);
      return;
    }

    const request = venue ? supabase.from('venues').update(payload).eq('id', venue.id) : supabase.from('venues').insert(payload);

    const { error } = await request;

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    await onSaved();
    setSaving(false);
  }

  async function handleDelete() {
    if (!venue) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('venues').delete().eq('id', venue.id);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    await onSaved();
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="venue-modal" role="dialog" aria-modal="true" aria-label="Edit venue" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{venue ? 'Edit venue' : 'New venue'}</p>
            <h2>{venue ? venue.name : 'Save a place'}</h2>
          </div>

          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form className="venue-form" onSubmit={handleSubmit}>
          <label>
            Instagram link
            <input
              type="url"
              placeholder="https://www.instagram.com/venue.handle"
              value={form.instagram_url}
              onChange={(event) => handleInstagramChange(event.target.value)}
            />
          </label>

          {form.instagram_handle && (
            <p className="handle-preview">
              Saved as <strong>@{form.instagram_handle}</strong>
            </p>
          )}

          <label>
            Venue name
            <input value={form.name} placeholder="Venue name" onChange={(event) => updateField('name', event.target.value)} required />
          </label>

          <div className="form-grid-2">
            <label>
              Type
              <select value={form.venue_type} onChange={(event) => updateField('venue_type', event.target.value as VenueType)}>
                <option value="cafe">Café</option>
                <option value="restaurant">Restaurant</option>
                <option value="bar">Bar</option>
                <option value="bakery">Bakery</option>
                <option value="dessert">Dessert</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              Status
              <select value={form.status} onChange={(event) => updateField('status', event.target.value as VenueStatus)}>
                <option value="want_to_go">Want to go</option>
                <option value="visited">Visited</option>
                <option value="not_interested">Not interested</option>
              </select>
            </label>
          </div>

          {form.status === 'visited' && (
            <div className="form-grid-2">
              <label>
                Rating
                <select
                  value={form.rating ?? ''}
                  onChange={(event) => updateField('rating', event.target.value ? Number(event.target.value) : null)}
                >
                  <option value="">No rating</option>
                  <option value="1">1 star</option>
                  <option value="2">2 stars</option>
                  <option value="3">3 stars</option>
                  <option value="4">4 stars</option>
                  <option value="5">5 stars</option>
                </select>
              </label>

              <label>
                Visited date
                <input type="date" value={form.visited_at} onChange={(event) => updateField('visited_at', event.target.value)} />
              </label>
            </div>
          )}

          <label>
            Notes
            <textarea value={form.notes} rows={3} onChange={(event) => updateField('notes', event.target.value)} />
          </label>

          {message && <p className="form-message">{message}</p>}

          <div className="modal-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving && <Loader2 className="spin" size={17} />}
              Save venue
            </button>

            {venue && (
              <button
                className={confirmDelete ? 'danger-button danger-button--confirm' : 'danger-button'}
                type="button"
                onClick={handleDelete}
                disabled={saving}
              >
                <Trash2 size={17} />
                {confirmDelete ? 'Confirm delete' : 'Delete venue'}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

function DayModal({
  dateKey,
  entry,
  onClose,
  onSave,
  onDelete,
}: {
  dateKey: string;
  entry?: EntryWithUrl;
  onClose: () => void;
  onSave: (input: { dateKey: string; caption: string; file: File | null; removePhoto: boolean }) => Promise<void>;
  onDelete: (dateKey: string) => Promise<void>;
}) {
  const [caption, setCaption] = useState(entry?.caption ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(entry?.signedUrl ?? '');
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
    setRemovePhoto(false);

    if (selectedFile) {
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  }

  function handleRemovePhoto() {
    setFile(null);
    setPreviewUrl('');
    setRemovePhoto(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    await onSave({
      dateKey,
      caption,
      file,
      removePhoto,
    });

    setSaving(false);
  }

  async function handleDelete() {
    if (!entry) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setSaving(true);
    await onDelete(dateKey);
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="day-modal" role="dialog" aria-modal="true" aria-label="Edit calendar day" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Calendar day</p>
            <h2>{formatDisplayDate(dateKey)}</h2>
          </div>

          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </div>

        <form className="day-form" onSubmit={handleSubmit}>
          <div className="photo-preview">
            {previewUrl ? (
              <img src={previewUrl} alt={caption || `Memory for ${dateKey}`} />
            ) : (
              <div className="photo-placeholder">
                <Camera size={30} />
              </div>
            )}
          </div>

          <div className="photo-action-row">
            <label className="upload-control upload-control--compact">
              <ImagePlus size={17} />
              Change
              <input type="file" accept="image/*" onChange={handleFileChange} />
            </label>

            <button className="secondary-button secondary-button--compact" type="button" onClick={handleRemovePhoto}>
              Remove
            </button>
          </div>

          {removePhoto && entry?.photo_path && (
            <div className="pending-removal">
              <p>Photo will be removed when you press Save.</p>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setRemovePhoto(false);
                  setPreviewUrl(entry?.signedUrl ?? '');
                }}
              >
                Undo remove
              </button>
            </div>
          )}

          <textarea
            className="caption-input"
            placeholder="Write a short caption..."
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
          />

          <div
            className="modal-actions modal-actions--same-row"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              alignItems: 'stretch',
              gap: '0.55rem',
              marginTop: '0.1rem',
            }}
          >
            <button className="primary-button" type="submit" disabled={saving}>
              {saving && <Loader2 className="spin" size={17} />}
              Save
            </button>

            {entry ? (
              <button
                className={confirmDelete ? 'danger-button danger-button--confirm' : 'danger-button'}
                type="button"
                onClick={handleDelete}
                disabled={saving}
              >
                <Trash2 size={17} />
                {confirmDelete ? 'Confirm' : 'Delete'}
              </button>
            ) : (
              <button className="danger-button" type="button" onClick={onClose}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

function FullPageLoader({ label }: { label: string }) {
  return (
    <main className="loader-page">
      <Loader2 className="spin" size={26} />
      <p>{label}</p>
    </main>
  );
}

export default App;
