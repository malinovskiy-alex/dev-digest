"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button, Card, Input, Spinner } from "@devdigest/ui";

type Provider = "openai" | "anthropic" | "google";

export default function SettingsPage() {
  const { section } = useParams<{ section: string }>();

  const [settings, setSettings] = useState<any>(null);
  const [secrets, setSecrets] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftKey, setDraftKey] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [configuredCount, setConfiguredCount] = useState(0);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_BASE}/settings`)
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_BASE}/settings/secrets-status`)
      .then((r) => r.json())
      .then(setSecrets);
  }, []);

  useEffect(() => {
    setConfiguredCount(Object.values(secrets).filter(Boolean).length);
  }, [secrets]);

  async function handleSaveKey() {
    setSaving(true);
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE}/settings/test-connection`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, key: draftKey }),
      },
    );
    const json = await res.json();
    setTestResult(json.ok ? "Connection OK" : "Connection failed");
    if (json.ok) {
      const fresh = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/settings/secrets-status`,
      ).then((r) => r.json());
      setSecrets(fresh);
    }
    setSaving(false);
  }

  function providerLabel(p: Provider) {
    if (p === "openai") return "OpenAI";
    if (p === "anthropic") return "Anthropic";
    return "Google";
  }

  function maskedKey(k: string) {
    if (k.length <= 8) return "••••";
    return `${k.slice(0, 4)}••••${k.slice(-4)}`;
  }

  if (loading) return <Spinner />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>Settings</h1>

      {section === "providers" && (
        <Card>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Provider keys</h2>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>
            {configuredCount} of 3 providers configured
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {(["openai", "anthropic", "google"] as Provider[]).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: provider === p ? "var(--accent)" : "transparent",
                }}
              >
                {providerLabel(p)} {secrets[p] ? "✓" : ""}
              </button>
            ))}
          </div>

          <Input
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            placeholder="Paste API key"
          />
          {draftKey.length > 0 && (
            <p style={{ fontSize: 12, color: "var(--muted)" }}>
              Will be stored as {maskedKey(draftKey)}
            </p>
          )}

          <Button onClick={handleSaveKey} disabled={saving || draftKey.length < 8}>
            {saving ? "Testing…" : "Save and test"}
          </Button>

          {testResult && <p style={{ marginTop: 8 }}>{testResult}</p>}
        </Card>
      )}

      {section === "engine" && (
        <Card>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Engine</h2>
          <p style={{ color: "var(--muted)" }}>
            Max concurrent reviews: {settings?.maxConcurrency ?? 2}
          </p>
          <p style={{ color: "var(--muted)" }}>
            Review timeout: {(settings?.timeoutMs ?? 120000) / 1000}s
          </p>
        </Card>
      )}
    </div>
  );
}
