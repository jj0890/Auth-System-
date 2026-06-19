// One-time script to seed the 5 test albums directly using known MusicBrainz IDs.
// Run with: node scripts/seed-albums.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://abuntrzwtaaqsdypfiev.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidW50cnp3dGFhcXNkeXBmaWV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTc1MTQ3NiwiZXhwIjoyMDk3MzI3NDc2fQ.HosdbtOzJQaOD-2_TtzfGZZZF_kQppj15NPi9Wb0pSc";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Test user — replace clerk_id with your real one after you sign in
const TEST_CLERK_ID = "user_test_seed_001";
const TEST_EMAIL    = "jarradjones7@gmail.com";

const ALBUMS = [
  {
    rank: 1,
    mb_id: "b6981b3a-00a1-414b-a149-f3e17c7df060",
    title: "Blonde",
    artist: "Frank Ocean",
    year: "2016",
    cover_url: "https://upload.wikimedia.org/wikipedia/en/a/a0/Blonde_-_Frank_Ocean.jpeg",
  },
  {
    rank: 2,
    mb_id: "3d32b603-6e9d-424b-bc44-0c834fb0e0c4",
    title: "Charm",
    artist: "Clairo",
    year: "2024",
    cover_url: null, // fetched from Cover Art Archive at runtime
  },
  {
    rank: 3,
    mb_id: "0ac3e22c-11d8-4b01-81f3-8989b19b4271",
    title: "MEEK.VOL1_",
    artist: "Knxwledge",
    year: "2017",
    cover_url: null,
  },
  {
    rank: 4,
    mb_id: "d742dd6e-ca20-4081-8eb7-224be953ef25",
    title: "Barter 6",
    artist: "Young Thug",
    year: "2015",
    cover_url: null,
  },
  {
    rank: 5,
    mb_id: "1b06eff3-5902-4c27-8af9-33a93ad2a9f8",
    title: "Reading, Writing and Arithmetic",
    artist: "The Sundays",
    year: "1990",
    cover_url: null,
  },
];

async function run() {
  console.log("1. Creating test profile...");
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ clerk_id: TEST_CLERK_ID, email: TEST_EMAIL, display_name: "Jarrad Jones", is_public: true }, { onConflict: "clerk_id" });

  if (profileError) {
    console.error("Profile error:", profileError.message);
    process.exit(1);
  }
  console.log("   ✓ Profile ready");

  console.log("2. Saving 5 albums...");
  for (const album of ALBUMS) {
    const { error } = await supabase
      .from("profile_albums")
      .upsert({ clerk_id: TEST_CLERK_ID, ...album }, { onConflict: "clerk_id,rank" });

    if (error) {
      console.error(`   ✗ Rank ${album.rank} (${album.title}):`, error.message);
    } else {
      console.log(`   ✓ #${album.rank} ${album.title} — ${album.artist}`);
    }
  }

  console.log("3. Reading back from DB...");
  const { data, error } = await supabase
    .from("profile_albums")
    .select("rank, title, artist, year, mb_id")
    .eq("clerk_id", TEST_CLERK_ID)
    .order("rank");

  if (error) { console.error("Read error:", error.message); process.exit(1); }

  console.log("\n   Your top 5 albums in the database:");
  data.forEach(a => console.log(`   #${a.rank}  ${a.title} — ${a.artist} (${a.year}) [${a.mb_id}]`));
  console.log("\nDone.");
}

run();
