import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Camera, CheckCircle2, ChevronLeft, ChevronRight, Download, ExternalLink, Grid3X3, ImagePlus, Loader2, LogOut, MapPin, Plus, Search, Sparkles, Star, Trash2, X } from 'lucide-react';
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

  google_place_id: string | null;
  google_maps_url: string | null;
  address: string | null;
  website_url: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  google_rating: number | null;
  google_user_ratings_total: number | null;
  opening_hours: unknown | null;
  details_source: string | null;
  details_updated_at: string | null;

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

  google_place_id: string;
  google_maps_url: string;
  address: string;
  website_url: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  google_rating: number | null;
  google_user_ratings_total: number | null;
  opening_hours: unknown | null;
  details_source: string;
  details_updated_at: string;
};

type VenueSearchCandidate = {
  id: string;
  displayName: string;
  formattedAddress: string;
  googleMapsUri?: string;
  primaryTypeDisplayName?: string;
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
      })
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
      { onConflict: 'user_id,entry_date' }
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
            <p>{loading ? 'Loading photos...' : `${Object.keys(entries).length} saved day${Object.keys(entries).length === 1 ? '' : 's'}`}</p>
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
                    className={`day-cell ${entry?.signedUrl ? 'day-cell--photo' : ''} ${isToday ? 'day-cell--today' : ''}`}
                    type="button"
                    onClick={() => setSelectedDate(dateKey)}
                  >
                    {entry?.signedUrl ? (
                      <img src={entry.signedUrl} alt={entry.caption || `Memory for ${dateKey}`} />
                    ) : (
                      <span className="empty-photo"><ImagePlus size={18} /></span>
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

    google_place_id: '',
    google_maps_url: '',
    address: '',
    website_url: '',
    phone: '',
    latitude: null,
    longitude: null,
    google_rating: null,
    google_user_ratings_total: null,
    opening_hours: null,
    details_source: '',
    details_updated_at: '',
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

    google_place_id: venue.google_place_id ?? '',
    google_maps_url: venue.google_maps_url ?? '',
    address: venue.address ?? '',
    website_url: venue.website_url ?? '',
    phone: venue.phone ?? '',
    latitude: venue.latitude,
    longitude: venue.longitude,
    google_rating: venue.google_rating,
    google_user_ratings_total: venue.google_user_ratings_total,
    opening_hours: venue.opening_hours,
    details_source: venue.details_source ?? '',
    details_updated_at: venue.details_updated_at ?? '',
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

    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .order('created_at', { ascending: false });

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

        {venue.address && <p className="venue-address">{venue.address}</p>}
        {venue.notes && <p className="venue-notes">{venue.notes}</p>}

        {venue.status === 'visited' && (
          <div className="venue-rating" aria-label={venue.rating ? `${venue.rating} out of 5 stars` : 'No rating yet'}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} size={16} fill={venue.rating && star <= venue.rating ? 'currentColor' : 'none'} />
            ))}
            {venue.visited_at && <span>{venue.visited_at}</span>}
          </div>
        )}

        {(venue.google_maps_url || venue.website_url || venue.google_rating) && (
          <div className="venue-detail-row">
            {venue.google_rating && <span>Google {venue.google_rating.toFixed(1)}★</span>}
            {venue.website_url && (
              <a href={venue.website_url} target="_blank" rel="noreferrer">
                Website
              </a>
            )}
            {venue.google_maps_url && (
              <a href={venue.google_maps_url} target="_blank" rel="noreferrer">
                Maps
              </a>
            )}
          </div>
        )}
      </div>

      <div className="venue-card__actions">
        {instagramHref && (
          <a className="icon-link" href={instagramHref} target="_blank" rel="noreferrer" aria-label="Open Instagram">
            <ExternalLink size={17} />
          </a>
        )}
        {venue.google_maps_url && (
          <a className="icon-link" href={venue.google_maps_url} target="_blank" rel="noreferrer" aria-label="Open Google Maps">
            <MapPin size={17} />
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
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMessage, setDetailMessage] = useState('');
  const [candidates, setCandidates] = useState<VenueSearchCandidate[]>([]);

  function updateField<K extends keyof VenueFormState>(key: K, value: VenueFormState[K]) {
    setForm((current: VenueFormState) => ({ ...current, [key]: value }));
  }

  function handleInstagramChange(value: string) {
    const cleanedUrl = cleanInstagramUrl(value);
    const handle = extractInstagramHandle(cleanedUrl || value);
    const suggestedName = titleFromInstagramHandle(handle);

    setForm((current: VenueFormState) => ({
      ...current,
      instagram_url: cleanedUrl,
      instagram_handle: handle,
      name: current.name || suggestedName,
    }));
  }

  async function handleFindDetails() {
    setDetailLoading(true);
    setDetailMessage('');
    setCandidates([]);

    const queryParts = [form.name, form.instagram_handle?.replace(/[._-]/g, ' '), 'Brisbane Australia']
      .filter(Boolean)
      .join(' ');

    if (!queryParts.trim()) {
      setDetailMessage('Add a venue name or Instagram handle first.');
      setDetailLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/search-venue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryParts }),
      });

      const result = await response.json();

      if (!response.ok) {
        setDetailMessage(result.error ?? 'Could not search venue details.');
        return;
      }

      setCandidates(result.candidates ?? []);

      if (!result.candidates?.length) {
        setDetailMessage('No Google Places match found. You can still save the venue manually.');
      }
    } catch {
      setDetailMessage('Could not reach the venue search endpoint.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleUseCandidate(candidate: VenueSearchCandidate) {
    setDetailLoading(true);
    setDetailMessage('');

    try {
      const response = await fetch('/api/place-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: candidate.id }),
      });

      const details = await response.json();

      if (!response.ok) {
        setDetailMessage(details.error ?? 'Could not get venue details.');
        return;
      }

      setForm((current: VenueFormState) => ({
        ...current,
        name: details.name || current.name,
        address: details.address || current.address,
        google_place_id: details.googlePlaceId || candidate.id,
        google_maps_url: details.googleMapsUrl || candidate.googleMapsUri || current.google_maps_url,
        website_url: details.websiteUrl || current.website_url,
        phone: details.phone || current.phone,
        latitude: typeof details.latitude === 'number' ? details.latitude : current.latitude,
        longitude: typeof details.longitude === 'number' ? details.longitude : current.longitude,
        google_rating: typeof details.googleRating === 'number' ? details.googleRating : current.google_rating,
        google_user_ratings_total:
          typeof details.googleUserRatingsTotal === 'number'
            ? details.googleUserRatingsTotal
            : current.google_user_ratings_total,
        opening_hours: details.openingHours ?? current.opening_hours,
        details_source: 'google_places',
        details_updated_at: new Date().toISOString(),
      }));

      setCandidates([]);
      setDetailMessage('Google details added. Review before saving.');
    } catch {
      setDetailMessage('Could not reach the place details endpoint.');
    } finally {
      setDetailLoading(false);
    }
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

      google_place_id: form.google_place_id || null,
      google_maps_url: form.google_maps_url || null,
      address: form.address || null,
      website_url: form.website_url || null,
      phone: form.phone || null,
      latitude: form.latitude,
      longitude: form.longitude,
      google_rating: form.google_rating,
      google_user_ratings_total: form.google_user_ratings_total,
      opening_hours: form.opening_hours,
      details_source: form.details_source || null,
      details_updated_at: form.details_updated_at || null,

      updated_at: new Date().toISOString(),
    };

    if (!payload.name) {
      setMessage('Venue name is required.');
      setSaving(false);
      return;
    }

    const request = venue
      ? supabase.from('venues').update(payload).eq('id', venue.id)
      : supabase.from('venues').insert(payload);

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
            <input
              value={form.name}
              placeholder="Venue name"
              onChange={(event) => updateField('name', event.target.value)}
              required
            />
          </label>

          <div className="details-search-panel">
            <button className="secondary-button details-search-button" type="button" onClick={handleFindDetails} disabled={detailLoading}>
              {detailLoading ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
              Find Google details
            </button>

            {detailMessage && <p className="handle-preview">{detailMessage}</p>}

            {candidates.length > 0 && (
              <div className="candidate-list">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    className="candidate-card"
                    type="button"
                    onClick={() => handleUseCandidate(candidate)}
                    disabled={detailLoading}
                  >
                    <strong>{candidate.displayName}</strong>
                    <span>{candidate.formattedAddress}</span>
                    {candidate.primaryTypeDisplayName && <small>{candidate.primaryTypeDisplayName}</small>}
                  </button>
                ))}
              </div>
            )}

            {(form.address || form.google_maps_url || form.website_url) && (
              <div className="saved-details-preview">
                {form.address && <p>{form.address}</p>}
                <div>
                  {form.google_maps_url && (
                    <a href={form.google_maps_url} target="_blank" rel="noreferrer">
                      Google Maps
                    </a>
                  )}
                  {form.website_url && (
                    <a href={form.website_url} target="_blank" rel="noreferrer">
                      Website
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

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
            <div className="visited-fields">
              <label>
                Rating
                <div className="star-picker">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={form.rating && star <= form.rating ? 'star-button star-button--active' : 'star-button'}
                      onClick={() => updateField('rating', star)}
                      aria-label={`${star} stars`}
                    >
                      <Star size={22} fill={form.rating && star <= form.rating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </label>

              <label>
                Visited date
                <input type="date" value={form.visited_at} onChange={(event) => updateField('visited_at', event.target.value)} />
              </label>
            </div>
          )}

          <textarea
            className="caption-input"
            rows={4}
            placeholder="Notes, what to try, who recommended it..."
            value={form.notes}
            onChange={(event) => updateField('notes', event.target.value)}
          />

          {message && <p className="form-message">{message}</p>}

          <div className="modal-actions">
            {venue && (
              <button className={confirmDelete ? 'danger-button danger-button--confirm' : 'danger-button'} type="button" onClick={handleDelete}>
                <Trash2 size={16} />
                {confirmDelete ? 'Tap again to delete' : 'Delete'}
              </button>
            )}

            <button className="primary-button" type="submit" disabled={saving}>
              {saving && <Loader2 className="spin" size={18} />}
              Save venue
            </button>
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
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setRemovePhoto(false);

    if (nextFile) {
      setPreviewUrl(URL.createObjectURL(nextFile));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    await onSave({ dateKey, caption, file, removePhoto });
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
            <X size={20} />
          </button>
        </div>

        <form className="day-form" onSubmit={handleSubmit}>
          <div className="photo-preview">
            {previewUrl && !removePhoto ? (
              <img src={previewUrl} alt="Selected calendar memory" />
            ) : (
              <div className="photo-placeholder">
                <Camera size={32} />
                <span>No picture yet</span>
              </div>
            )}
          </div>

          <div className="photo-action-row">
            <label className="upload-control upload-control--compact">
              <ImagePlus size={16} />
              {entry?.photo_path || file ? 'Change' : 'Add'}
              <input type="file" accept="image/*" onChange={handleFileChange} />
            </label>

            {(entry?.photo_path || file) && !removePhoto && (
              <button
                className="secondary-button secondary-button--compact"
                type="button"
                onClick={() => {
                  setFile(null);
                  setPreviewUrl('');
                  setRemovePhoto(true);
                }}
              >
                Remove
              </button>
            )}
          </div>

          {file && entry?.photo_path && (
            <p className="safe-note">Your old picture will stay saved until you tap Save day.</p>
          )}

          {removePhoto && (
            <div className="pending-removal">
              <p>Picture marked for removal. It will only be deleted after you tap Save day.</p>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setRemovePhoto(false);
                  setPreviewUrl(entry?.signedUrl ?? '');
                }}
              >
                Undo remove picture
              </button>
            </div>
          )}

          <textarea
            className="caption-input"
            rows={3}
            placeholder="Tiny note about this day..."
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
          />

          <div className="modal-actions">
            {entry && (
              <button
                className={confirmDelete ? 'danger-button danger-button--confirm' : 'danger-button'}
                type="button"
                onClick={() => {
                  if (confirmDelete) {
                    onDelete(dateKey);
                    return;
                  }
                  setConfirmDelete(true);
                }}
              >
                <Trash2 size={16} />
                {confirmDelete ? 'Tap again to delete' : 'Delete day'}
              </button>
            )}
            <button className="primary-button" type="submit" disabled={saving}>
              {saving && <Loader2 className="spin" size={18} />}
              Save day
            </button>
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
