import { useState } from "react";

const WORKFLOW_YML = `name: Strava Auto Kudos

on:
  schedule:
    - cron: '0 8 * * *'   # 08:00 UTC daily
  workflow_dispatch:       # manual trigger too

jobs:
  auto-kudos:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install requests
      - name: Run Auto Kudos
        env:
          STRAVA_CLIENT_ID:     \${{ secrets.STRAVA_CLIENT_ID }}
          STRAVA_CLIENT_SECRET: \${{ secrets.STRAVA_CLIENT_SECRET }}
          STRAVA_REFRESH_TOKEN: \${{ secrets.STRAVA_REFRESH_TOKEN }}
        run: python auto_kudos.py`;

const PYTHON_SCRIPT = `import os, sys, time, requests

DELAY  = 0.8   # seconds between kudos
PAGES  = 5     # pages of feed (50 activities each)

def get_token(cid, csec, rtok):
    r = requests.post("https://www.strava.com/oauth/token", data={
        "client_id": cid, "client_secret": csec,
        "refresh_token": rtok, "grant_type": "refresh_token"
    })
    r.raise_for_status()
    return r.json()["access_token"]

def fetch_feed(tok):
    h = {"Authorization": f"Bearer {tok}"}
    out = []
    for p in range(1, PAGES + 1):
        r = requests.get("https://www.strava.com/api/v3/activities/following",
                         headers=h, params={"per_page": 50, "page": p})
        data = r.json()
        if not data: break
        out.extend(data)
        if len(data) < 50: break
    return out

def kudo(tok, aid):
    r = requests.post(f"https://www.strava.com/api/v3/activities/{aid}/kudos",
                      headers={"Authorization": f"Bearer {tok}"})
    return r.status_code == 201

def main():
    cid   = os.environ["STRAVA_CLIENT_ID"]
    csec  = os.environ["STRAVA_CLIENT_SECRET"]
    rtok  = os.environ["STRAVA_REFRESH_TOKEN"]
    tok   = get_token(cid, csec, rtok)
    feed  = fetch_feed(tok)
    todo  = [a for a in feed if not a.get("kudoed")]
    print(f"👏 Kudoing {len(todo)} activities...")
    ok = 0
    for a in todo:
        time.sleep(DELAY)
        if kudo(tok, a["id"]):
            print(f"  ✅ {a.get('athlete',{}).get('firstname','?')} — {a.get('name','?')}")
            ok += 1
    print(f"🏆 Done! {ok} kudos given.")

if __name__ == "__main__":
    main()`;

const AUTH_URL = `https://www.strava.com/oauth/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost&approval_prompt=force&scope=activity:read,activity:write`;

const CURL = `curl -X POST https://www.strava.com/oauth/token \\
  -d client_id=YOUR_CLIENT_ID \\
  -d client_secret=YOUR_CLIENT_SECRET \\
  -d code=YOUR_CODE \\
  -d grant_type=authorization_code`;

const FILES = [
  { label: ".github/workflows/auto-kudos.yml", code: WORKFLOW_YML, lang: "yaml" },
  { label: "auto_kudos.py", code: PYTHON_SCRIPT, lang: "python" },
];

const SECRETS = [
  { name: "STRAVA_CLIENT_ID", desc: "Your Strava app Client ID" },
  { name: "STRAVA_CLIENT_SECRET", desc: "Your Strava app Client Secret" },
  { name: "STRAVA_REFRESH_TOKEN", desc: "The refresh_token from the curl response" },
];

function CodeBlock({ code, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ background: "#162142", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 16px", background: "rgba(255,255,255,0.05)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        <span style={{ color: "#a8acb2", fontSize: 11.5, fontFamily: "monospace", fontWeight: 600 }}>{label}</span>
        <button onClick={copy} style={{
          background: copied ? "#28c940" : "linear-gradient(135deg,#c6168d,#4c1e58)",
          border: "none", borderRadius: 6, color: "#fff", cursor: "pointer",
          fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 11, padding: "5px 12px",
          transition: "all 0.2s",
        }}>{copied ? "✓ Copied" : "Copy"}</button>
      </div>
      <pre style={{
        margin: 0, padding: "16px", color: "#f7cae2",
        fontSize: 11.5, lineHeight: 1.7, fontFamily: "'Fira Code','Courier New',monospace",
        maxHeight: 280, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>{code}</pre>
    </div>
  );
}

function InlineCode({ children }) {
  return (
    <code style={{
      background: "#ebf0f7", color: "#c6168d", borderRadius: 4,
      padding: "2px 7px", fontSize: 12, fontFamily: "monospace", fontWeight: 600,
    }}>{children}</code>
  );
}

const STEPS = [
  {
    num: "01", emoji: "🔑",
    title: "Create a Strava API App",
    accent: true,
    content: (
      <div>
        <p style={{ margin: "0 0 10px", color: "#585a5e", fontSize: 13, lineHeight: 1.7 }}>
          Go to <a href="https://www.strava.com/settings/api" target="_blank" rel="noreferrer"
            style={{ color: "#c6168d", fontWeight: 700 }}>strava.com/settings/api</a> and create an app.
          Set <strong>Authorization Callback Domain</strong> to <InlineCode>localhost</InlineCode>.
          Note your <InlineCode>Client ID</InlineCode> and <InlineCode>Client Secret</InlineCode>.
        </p>
      </div>
    ),
  },
  {
    num: "02", emoji: "🔐",
    title: "Get Your Refresh Token (one-time)",
    content: (
      <div>
        <p style={{ margin: "0 0 10px", color: "#585a5e", fontSize: 13, lineHeight: 1.7 }}>
          Open this URL in your browser (swap in your Client ID), approve the app, then copy the <InlineCode>code=</InlineCode> value from the redirect URL:
        </p>
        <CodeBlock code={AUTH_URL} label="Authorization URL" />
        <p style={{ margin: "10px 0", color: "#585a5e", fontSize: 13, lineHeight: 1.7 }}>
          Then exchange the code for tokens via terminal:
        </p>
        <CodeBlock code={CURL} label="Terminal" />
        <p style={{ margin: "10px 0 0", color: "#585a5e", fontSize: 13, lineHeight: 1.7 }}>
          Copy the <InlineCode>refresh_token</InlineCode> from the JSON response — you only need to do this once.
        </p>
      </div>
    ),
  },
  {
    num: "03", emoji: "🔒",
    title: "Add GitHub Secrets",
    content: (
      <div>
        <p style={{ margin: "0 0 12px", color: "#585a5e", fontSize: 13, lineHeight: 1.7 }}>
          In your repo → <strong>Settings → Secrets and variables → Actions → New repository secret</strong>. Add these three:
        </p>
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #ebf0f7" }}>
          {SECRETS.map((s, i) => (
            <div key={s.name} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "12px 16px", background: i % 2 === 0 ? "#fff" : "#ebf0f7",
              borderBottom: i < SECRETS.length - 1 ? "1px solid #ebf0f7" : "none",
            }}>
              <code style={{ color: "#c6168d", fontWeight: 700, fontSize: 12, minWidth: 220, fontFamily: "monospace" }}>{s.name}</code>
              <span style={{ color: "#585a5e", fontSize: 13 }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    num: "04", emoji: "📁",
    title: "Add Files to Your Repo",
    content: (
      <div>
        <p style={{ margin: "0 0 12px", color: "#585a5e", fontSize: 13, lineHeight: 1.7 }}>
          Add both files to your repository. The workflow must live at exactly this path:
        </p>
        <div style={{ background: "#162142", borderRadius: 10, padding: "14px 18px", marginBottom: 14, fontFamily: "monospace", fontSize: 13, color: "#f7cae2", lineHeight: 2 }}>
          your-repo/<br />
          ├── .github/<br />
          │&nbsp;&nbsp;&nbsp;└── workflows/<br />
          │&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── <span style={{ color: "#c6168d" }}>auto-kudos.yml</span><br />
          └── <span style={{ color: "#c6168d" }}>auto_kudos.py</span>
        </div>
        {FILES.map(f => <CodeBlock key={f.label} code={f.code} label={f.label} />)}
      </div>
    ),
  },
  {
    num: "05", emoji: "🚀",
    title: "Push & You're Done",
    content: (
      <div>
        <p style={{ margin: "0 0 10px", color: "#585a5e", fontSize: 13, lineHeight: 1.7 }}>
          Commit and push. The workflow runs daily at <InlineCode>08:00 UTC</InlineCode>. To change the time, edit the <InlineCode>cron:</InlineCode> line in the YAML. Use{" "}
          <a href="https://crontab.guru" target="_blank" rel="noreferrer" style={{ color: "#c6168d", fontWeight: 700 }}>crontab.guru</a> to build your schedule.
        </p>
        <p style={{ margin: 0, color: "#585a5e", fontSize: 13, lineHeight: 1.7 }}>
          To trigger manually: <strong>Actions → Strava Auto Kudos → Run workflow</strong>.
        </p>
      </div>
    ),
  },
];

export default function App() {
  const [open, setOpen] = useState(0);

  return (
    <div style={{ fontFamily: "'Montserrat',sans-serif", background: "#ebf0f7", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        a { text-decoration: none; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #a8acb2; border-radius: 3px; }
        .acc-btn { transition: background 0.15s; }
        .acc-btn:hover { opacity: 0.9; }
      `}</style>

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg,#162142 0%,#4c1e58 55%,#c6168d 100%)",
        padding: "44px 28px 56px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 180, height: 180, borderRadius: "50%", background: "rgba(198,22,141,0.12)" }} />
        <div style={{ position: "absolute", bottom: -50, left: -10, width: 140, height: 140, borderRadius: "50%", background: "rgba(247,202,226,0.08)" }} />

        <div style={{ position: "relative", maxWidth: 660, margin: "0 auto" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(247,202,226,0.15)", border: "1px solid rgba(247,202,226,0.3)",
            borderRadius: 50, padding: "5px 14px", marginBottom: 18,
          }}>
            <span style={{ fontSize: 12, color: "#f7cae2", fontWeight: 700, letterSpacing: "0.8px" }}>GITHUB ACTIONS • ZERO HUMAN INTERACTION</span>
          </div>
          <h1 style={{ margin: "0 0 10px", color: "#fff", fontSize: 34, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.5px" }}>
            👏 Strava Auto Kudos
          </h1>
          <p style={{ margin: "0 0 24px", color: "#a8acb2", fontSize: 15, fontWeight: 500, lineHeight: 1.6, maxWidth: 460 }}>
            A scheduled GitHub Actions workflow that automatically kudos your Strava following feed every day — no browser, no click, no you.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {["Runs on cron schedule","No API keys exposed","Skips own activities","Manual trigger option","Free with GitHub Actions"].map(f => (
              <span key={f} style={{
                background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 50, padding: "5px 13px", color: "#fff", fontSize: 11.5, fontWeight: 600,
              }}>✓ {f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Accordion Steps */}
      <div style={{ maxWidth: 660, margin: "-20px auto 0", padding: "0 20px 40px" }}>

        {/* Flow diagram */}
        <div style={{
          background: "#fff", borderRadius: 14, padding: "16px 20px", marginBottom: 20,
          boxShadow: "0 4px 16px rgba(22,33,66,0.09)", border: "1px solid #ebf0f7",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap",
        }}>
          {["⏰ Cron triggers", "→", "🔑 Auth token", "→", "📡 Fetch feed", "→", "👏 Give kudos"].map((s, i) => (
            <span key={i} style={{
              color: s === "→" ? "#a8acb2" : "#162142",
              fontWeight: s === "→" ? 400 : 700, fontSize: 12,
              whiteSpace: "nowrap",
            }}>{s}</span>
          ))}
        </div>

        {STEPS.map((step, i) => (
          <div key={step.num} style={{
            background: "#fff", borderRadius: 14, marginBottom: 10,
            boxShadow: "0 2px 10px rgba(22,33,66,0.07)", border: "1px solid #ebf0f7",
            overflow: "hidden",
          }}>
            <button className="acc-btn" onClick={() => setOpen(open === i ? -1 : i)} style={{
              width: "100%", background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", textAlign: "left",
            }}>
              <div style={{
                minWidth: 38, height: 38, borderRadius: 10,
                background: open === i ? "linear-gradient(135deg,#c6168d,#4c1e58)" : "#ebf0f7",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 12.5,
                color: open === i ? "#fff" : "#585a5e",
                transition: "all 0.2s",
              }}>{step.num}</div>
              <span style={{ fontSize: 17, }}>{step.emoji}</span>
              <span style={{ fontWeight: 700, color: "#162142", fontSize: 14, flex: 1 }}>{step.title}</span>
              <span style={{ color: "#a8acb2", fontSize: 18, fontWeight: 700, transform: open === i ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
            </button>

            {open === i && (
              <div style={{ padding: "0 20px 20px", borderTop: "1px solid #ebf0f7" }}>
                <div style={{ height: 12 }} />
                {step.content}
              </div>
            )}
          </div>
        ))}

        {/* Note */}
        <div style={{
          background: "linear-gradient(135deg,#f7cae2,#ebf0f7)",
          borderRadius: 12, padding: "14px 18px", marginTop: 4,
          border: "1px solid rgba(198,22,141,0.12)",
          display: "flex", gap: 12, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 18 }}>💡</span>
          <p style={{ margin: 0, color: "#585a5e", fontSize: 13, lineHeight: 1.6 }}>
            <strong style={{ color: "#4c1e58" }}>Strava refresh tokens don't expire</strong> as long as the app stays authorised. GitHub Actions on public repos gets 2,000 free minutes/month — this workflow uses about 1 minute per run.
          </p>
        </div>
      </div>
    </div>
  );
}
