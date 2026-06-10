// ===== PAISABOOM - SUPABASE CONFIG =====
const SUPABASE_URL = 'https://vunfdomewescglidqqip.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1bmZkb21ld2VzY2dsaWRxcWlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTE0MTEsImV4cCI6MjA5NjU2NzQxMX0.Lnc2E_LuRC3m0QhBbTKx6m5N66sTpIWtA95cXMTCg94';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
