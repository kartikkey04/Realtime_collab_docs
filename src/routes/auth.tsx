import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Sparkles, Users, Zap, FileText, Phone, ArrowRight, Loader2 } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult 
} from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import { useAuth, type User } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      const data = await apiFetch<{ token: string; user: User }>(
        "POST",
        "/auth/google",
        { idToken: credentialResponse.credential }
      );
      setSession(data.token, data.user);
      toast.success("Welcome!");
      if (!data.user.name) {
        navigate({ to: "/complete-profile" });
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google login failed");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Hero side */}
      <div className="hidden lg:flex flex-col justify-between p-12 gradient-hero-bg text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center">
              <FileText size={18} />
            </div>
            <span className="text-lg font-bold tracking-tight">CollabDocs</span>
          </div>
        </div>
        <div className="relative z-10 space-y-8 animate-fade-in">
          <div>
            <h2 className="text-4xl font-bold tracking-tight leading-tight">
              Write together,<br />in real time.
            </h2>
            <p className="mt-4 text-white/80 text-lg max-w-md">
              The fastest way to draft, edit, and ship documents with your team —
              no friction, no lag.
            </p>
          </div>
          <div className="space-y-4 max-w-md">
            <Feature icon={<Zap size={18} />} text="Instant sync across every device" />
            <Feature icon={<Users size={18} />} text="See teammates' presence live" />
            <Feature icon={<Sparkles size={18} />} text="Beautifully simple writing experience" />
          </div>
        </div>
        <div className="relative z-10 text-sm text-white/60">
          © {new Date().getFullYear()} CollabDocs
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center px-4 py-10 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md animate-slide-up">
          <div className="text-center mb-8 lg:hidden">
            <h1 className="text-3xl font-bold tracking-tight gradient-text">
              CollabDocs
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Real-time collaborative documents
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-card">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight">
                Get Started
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Secure access via Phone OTP or Google.
              </p>
            </div>

            <PhoneAuthForm onSuccess={setSession} />

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => toast.error("Google Login failed")}
                useOneTap
                theme="filled_blue"
                shape="pill"
                width="100%"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneAuthForm({ onSuccess }: { onSuccess: (t: string, u: User) => void }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    if (!recaptchaVerifier.current && recaptchaRef.current) {
      recaptchaVerifier.current = new RecaptchaVerifier(firebaseAuth, recaptchaRef.current, {
        size: "invisible",
        callback: () => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
        }
      });
    }
  }, []);

  const sendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!phoneNumber || !recaptchaVerifier.current) return;
    setLoading(true);
    try {
      const result = await signInWithPhoneNumber(firebaseAuth, phoneNumber, recaptchaVerifier.current);
      setConfirmationResult(result);
      setStep("otp");
      setTimer(60);
      toast.success("SMS code sent!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to send SMS");
      // Reset recaptcha if it fails
      if (recaptchaVerifier.current) {
        recaptchaVerifier.current.clear();
        recaptchaVerifier.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (otp.length !== 6 || !confirmationResult) return;
    setLoading(true);
    try {
      // 1. Confirm the code with Firebase
      const result = await confirmationResult.confirm(otp);
      const user = result.user;
      
      // 2. Get the Firebase ID Token
      const idToken = await user.getIdToken();

      // 3. Send the token to the backend
      const data = await apiFetch<{ token: string; user: User }>(
        "POST",
        "/auth/firebase",
        { idToken }
      );
      
      onSuccess(data.token, data.user);
      toast.success("Successfully verified!");
      
      if (!data.user.name) {
        navigate({ to: "/complete-profile" });
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  if (step === "phone") {
    return (
      <form onSubmit={sendOtp} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Phone Number
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+919876543210"
              required
              className="w-full pl-10 pr-3 py-2 bg-background border border-input rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
            />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Include country code (e.g. +91)
          </p>
        </div>
        <div ref={recaptchaRef} />
        <button
          type="submit"
          disabled={loading || !phoneNumber}
          className="w-full py-2.5 gradient-bg text-primary-foreground rounded-md font-medium hover:opacity-95 hover:shadow-elegant disabled:opacity-50 transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <>Send SMS Code <ArrowRight size={18} /></>}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code sent to <span className="text-foreground font-medium">{phoneNumber}</span>
        </p>
        <button 
          onClick={() => {
            setStep("phone");
            setOtp("");
          }} 
          className="text-xs text-primary hover:underline mt-1"
        >
          Change number
        </button>
      </div>

      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={otp}
          onChange={setOtp}
          onComplete={verifyOtp}
          disabled={loading}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      <div className="space-y-4">
        <button
          onClick={verifyOtp}
          disabled={loading || otp.length !== 6}
          className="w-full py-2.5 gradient-bg text-primary-foreground rounded-md font-medium hover:opacity-95 hover:shadow-elegant disabled:opacity-50 transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : "Verify & Continue"}
        </button>

        <div className="text-center">
          {timer > 0 ? (
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs text-muted-foreground">
                Resend code in {timer}s
              </p>
              <button
                disabled
                className="text-xs text-muted-foreground cursor-not-allowed font-medium opacity-50"
              >
                Resend Code
              </button>
            </div>
          ) : (
            <button
              onClick={() => sendOtp()}
              className="text-xs text-primary hover:underline font-medium"
            >
              Resend Code
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <span className="text-white/90">{text}</span>
    </div>
  );
}
