import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://jljljrkubullcrspicvj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsamxqcmt1YnVsbGNyc3BpY3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1NTMzMzUsImV4cCI6MjA2NjEyOTMzNX0.mtQ9V2NgxPXTTg6x3uv9wL_Qz6WicnKxujiSIrpxpcw"
);

const loginBtn = document.getElementById("login-btn");
const loginSection = document.getElementById("login-section");
const adminSection = document.getElementById("admin-section");

async function checkAccess(user) {
  const { data, error } = await supabase
    .from("admin_users")
    .select("email")
    .eq("email", user.email)
    .single();

  if (error || !data) {
    alert("❌ Accesso non autorizzato");
    await supabase.auth.signOut();
    return;
  }

  loginSection.style.display = "none";
  adminSection.style.display = "block";
}

async function restoreSession() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (session?.user) {
    checkAccess(session.user);
  }
}

async function login() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google"
  });
  if (error) alert("Errore login: " + error.message);
}

window.logout = async function () {
  await supabase.auth.signOut();
  location.reload();
};

loginBtn?.addEventListener("click", login);

restoreSession();
