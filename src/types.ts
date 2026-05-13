export type CalendarEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  photo_path: string | null;
  caption: string | null;
  created_at: string;
  updated_at: string;
};

export type EntryWithUrl = CalendarEntry & {
  signedUrl?: string;
};
