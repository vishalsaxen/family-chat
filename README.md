# Family Table Chat

A tiny, private, real-time chat room built just for your family — no WhatsApp,
no third-party app, no accounts. Everyone opens one link, types your shared
passcode and their name, and they're in.

Built with Node.js, Express, and Socket.io. Messages are stored in a small
JSON file on the server so history survives restarts.

Since your group is around 200–250 people, this needs to run on a real
server (not your laptop) so it's reachable 24/7. The free-tier steps below
handle that.

## 1. Run it locally first (optional, to try it out)

You'll need [Node.js](https://nodejs.org) 18+ installed.

```bash
cd family-chat
npm install
FAMILY_PASSCODE=yourpasscode FAMILY_NAME="Damdar Family" npm start
```

Open `http://localhost:3000` in a couple of browser tabs to test chatting
with yourself.

## 2. Put it online for free (Render.com)

Render has a free web service tier that's plenty for a family chat.

1. Create a free [GitHub](https://github.com) account if you don't have one,
   create a new repository (e.g. `family-chat`), and upload this whole
   `family-chat` folder to it.
2. Create a free [Render](https://render.com) account.
3. Click **New +** → **Web Service** → connect your GitHub repo.
4. Fill in:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Under **Environment**, add these variables:
   - `FAMILY_PASSCODE` → a passcode only your family knows (e.g. `sundaydinner7`)
   - `FAMILY_NAME` → what shows at the top of the chat (e.g. `The Sharma Family`)
6. Click **Create Web Service**. Render will build and give you a URL like
   `https://family-chat-xyz.onrender.com`.

That URL is what you share with your family — that's the whole app.

**Note on the free tier:** Render's free web services "sleep" after 15
minutes of no traffic and take ~30–60 seconds to wake up on the next visit.
For an always-instant chat, Render's cheapest paid tier (~$7/month) removes
that delay — worth it once the group is actively using it. Railway and
Fly.io are similar alternatives if you want to compare pricing.

## 3. Share it with the family

Send them: the link + the passcode, once, over whatever channel is
convenient (text, email, phone call). After that, they never need
WhatsApp or any other app — just that link, which they can bookmark or
save to their home screen like an app icon.

## How it works

- **No accounts:** anyone with the link and passcode can join under
  whatever name they type in.
- **One shared room:** everyone sees the same conversation, like a family
  group chat.
- **Presence:** the left rail shows who's currently online.
- **History:** the last 500 messages are kept in `messages.json` on the
  server and reloaded for anyone who joins.

## Changing things later

- **Change the passcode:** update the `FAMILY_PASSCODE` environment
  variable in Render's dashboard and it takes effect on next restart.
- **Wipe history:** delete `messages.json` and restart the service.
- **Bigger group / more features** (photo sharing, multiple rooms,
  read receipts): doable, but each is its own follow-up build — this
  version focuses on solid real-time text chat first.

## Security notes

- Treat the passcode like a house key — anyone who has it can read and
  post in the chat. Change it if it ever leaks outside the family.
- This is a simple shared-passcode room, not end-to-end encrypted. For a
  family group chat that's a reasonable trade-off, but don't use it for
  anything you wouldn't say in a group text.
