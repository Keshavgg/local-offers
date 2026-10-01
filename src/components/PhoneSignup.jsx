import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Lock, Send, CheckCircle2 } from "lucide-react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RolePicker from "@/components/RolePicker";
import { safeReturnTo } from "@/lib/authReturnTo";

// Sign up with a phone number verified through Telegram (no email, no SMS cost).
export default function PhoneSignup({ role, onRoleChange }) {
  const [step, setStep] = useState("start"); // start -> waiting -> verified -> (redirect)
  const [session, setSession] = useState(null); // { token, link }
  const [last4, setLast4] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  const stop = () => { clearInterval(timer.current); timer.current = null; };
  useEffect(() => stop, []);

  const poll = (token) => {
    stop();
    timer.current = setInterval(async () => {
      try {
        const s = await api.auth.phone.status(token);
        if (s.status === "verified") { stop(); setLast4(s.phone_last4 || ""); setStep("verified"); }
        else if (s.status === "exists") { stop(); setStep("start"); setError("That number already has an account. Log in instead."); }
        else if (s.status === "expired") { stop(); setStep("start"); setError("That sign-up expired. Please start again."); }
      } catch { /* keep polling; a blip shouldn't end the sign-up */ }
    }, 2000);
  };

  const start = async () => {
    setError(""); setBusy(true);
    try {
      const out = await api.auth.phone.start(role);
      setSession(out);
      window.open(out.link, "_blank", "noopener");
      setStep("waiting");
      poll(out.token);
    } catch (e) { setError(e.message || "Could not start sign-up"); }
    setBusy(false);
  };

  const finish = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setBusy(true);
    try {
      await api.auth.phone.complete({ token: session.token, password });
      window.location.href = safeReturnTo();
    } catch (err) { setError(err.message || "Could not create the account"); setBusy(false); }
  };

  const Err = () => error ? <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div> : null;

  if (step === "waiting") {
    return (
      <div className="space-y-4 text-center">
        <Err />
        <p className="text-sm text-muted-foreground">In Telegram, tap <b>Start</b>, then tap <b>Share my phone number</b>. This page continues by itself.</p>
        <a href={session.link} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-md bg-primary text-primary-foreground font-medium">
          <Send className="w-4 h-4" /> Open Telegram
        </a>
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Waiting for you to share your number…</p>
        <button type="button" onClick={() => { stop(); setStep("start"); }} className="text-xs text-muted-foreground hover:underline">Cancel</button>
      </div>
    );
  }

  if (step === "verified") {
    return (
      <form onSubmit={finish} className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4" /> Number ending {last4} is verified. Choose a password to finish.
        </div>
        <Err />
        <div className="space-y-2">
          <Label htmlFor="pw">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="pw" type="password" autoComplete="new-password" autoFocus placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" required minLength={8} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw2">Confirm password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="pw2" type="password" autoComplete="new-password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={busy}>
          {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating account...</> : "Create account"}
        </Button>
      </form>
    );
  }

  return (
    <div>
      <RolePicker value={role} onChange={onRoleChange} />
      <Err />
      <Button type="button" onClick={start} className="w-full h-12 font-medium" disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />} Continue with Telegram
      </Button>
      <p className="text-xs text-muted-foreground mt-3 text-center">
        We use Telegram only to confirm your phone number. After this you log in with your number and password.
        {" "}<Link to="/login" className="text-primary hover:underline">Already have an account?</Link>
      </p>
    </div>
  );
}
