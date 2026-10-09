// Supabase connection for the Bala Vyakarana app.
// The anon (publishable) key is meant to ship in a client: row-level
// security guards the data, and the Edge Functions verify the JWT.
// The Gemini key is NOT here - it lives as an Edge Function secret.
window.BALA_CONFIG = {
  supabaseUrl: "https://qndkvizszwdvhrccjxtr.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuZGt2aXpzendkdmhyY2NqeHRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNzk4OTYsImV4cCI6MjEwNjk1NTg5Nn0.XvFrd1rtuxBF6hB0H7PyFxfQzniINNLs2vP-BN0e3Tg"
};
