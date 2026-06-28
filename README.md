# Studio OS — internal agency platform

Next.js + Supabase + Vercel. Modules: Dashboard, Sales CRM (visits + calendar + pipeline),
Clients, Tasks, Payments, Finance (auto profit-share), Team (CEO creates accounts).
Installable as a PWA on any device.

---

## 1. Database — run the schema (once)

1. Open **Supabase → your project → SQL Editor → New query**.
2. Paste the entire contents of `supabase/schema.sql` and click **Run**.
   This creates all tables, the role system, and the security rules.

## 2. Environment variables (already done in Vercel)

These three must exist in **Vercel → Project → Settings → Environment Variables**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`  ← server-only, no `NEXT_PUBLIC_` prefix

For local testing, copy `.env.local.example` to `.env.local` and fill the same values.

## 3. Push the code (Vercel auto-deploys)

From the unzipped folder:

```bash
git init
git add .
git commit -m "Studio OS initial build"
git branch -M main
git remote add origin https://github.com/shareef6907/Agency.git
git push -u origin main
```

Make sure the Vercel project is connected to this GitHub repo
(**Vercel → Project → Settings → Git**). Every push to `main` then redeploys automatically.

## 4. Create your first CEO account (one-time bootstrap)

Accounts are created inside the app by the CEO — so you bootstrap the first CEO by hand:

1. **Supabase → Authentication → Users → Add user.** Enter your email + a password,
   tick **Auto Confirm User**, create.
2. **Supabase → SQL Editor**, run (replace the email):

   ```sql
   update profiles set role = 'ceo', full_name = 'Shareef'
   where id = (select id from auth.users where email = 'you@youremail.com');
   ```

3. Open your Vercel app URL, sign in with that email/password — you're the CEO.
4. Go to **Team → Add employee** to create the sales manager, editors, etc.
   (Roles: CEO, Sales Manager, Account Manager, Video/Content Editor.)

## 5. Install it like an app (PWA)

Open the Vercel URL on any device → browser menu → **Install / Add to Home Screen**.
It then opens full-screen with its own icon. Works on Mac, Windows, iPhone, Android.

---

## Who sees what

| Module    | CEO | Sales Manager | Account Manager | Editor |
|-----------|:---:|:-------------:|:---------------:|:------:|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Sales CRM | ✓ | ✓ | — | — |
| Clients   | ✓ | ✓ | assigned only | assigned only |
| Tasks     | ✓ | — | ✓ | own only |
| Payments  | ✓ | ✓ | — | — |
| Finance   | ✓ | ✓ | — | — |
| Team      | ✓ | — | — | — |

Permissions are enforced in the database (Row-Level Security), not just hidden in the UI.

## Finance / profit-share

The Finance page calculates the sales manager's share automatically:
**profit = collected revenue − costs**, then **20%** of profit (or **25%** when monthly
revenue exceeds SAR 100,000). Use **Add standard costs** to seed the agreed monthly cost
list (sales manager, rent, electricity, subscriptions, and 1 editor per 4 active clients).
