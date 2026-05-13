import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Loader2, LogOut, Trash2, X } from 'lucide-react';
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

  const monthDays = useMemo(() => getMonthMatrix(activeMonth), [activeMonth]);
  const selectedEntry = selectedDate ? entries[selectedDate] : undefined;

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
          <p className="eyebrow">Private photo diary</p>
          <h1>Memory Calendar</h1>
        </div>
        <button className="icon-button" type="button" onClick={() => supabase.auth.signOut()} aria-label="Sign out">
          <LogOut size={20} />
        </button>
      </header>

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

        {status && <p className="status-message">{status}</p>}

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
                {entry?.caption && <span className="caption-strip">{entry.caption}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <footer className="app-footer">
        Tap a day to add, change, or remove its picture.
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

          <label className="upload-control">
            <ImagePlus size={18} />
            {entry?.photo_path || file ? 'Change picture' : 'Add picture'}
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </label>

          {(entry?.photo_path || file) && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setFile(null);
                setPreviewUrl('');
                setRemovePhoto(true);
              }}
            >
              Remove picture
            </button>
          )}

          <label>
            Caption
            <textarea
              rows={3}
              placeholder="Tiny note about this day..."
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
            />
          </label>

          <div className="modal-actions">
            {entry && (
              <button className="danger-button" type="button" onClick={() => onDelete(dateKey)}>
                <Trash2 size={16} />
                Delete day
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
