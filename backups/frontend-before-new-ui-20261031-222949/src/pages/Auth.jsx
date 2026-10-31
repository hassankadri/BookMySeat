
import React, {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Ticket,
  User,
} from "lucide-react";

import toast from "react-hot-toast";

import {
  GoogleLogin,
  GoogleOAuthProvider,
} from "@react-oauth/google";

import {
  useAuth,
} from "../context/AuthContext";

const GOOGLE_CLIENT_ID =
  process.env.REACT_APP_GOOGLE_CLIENT_ID;

// =====================================================
// MAIN AUTH CONTENT
// =====================================================

const AuthContent = ({
  googleEnabled,
}) => {
  const navigate =
    useNavigate();

  const {
    login,
    loginWithGoogle,

    requestRegistrationOtp,
    verifyRegistrationOtp,
    resendRegistrationOtp,

    requestPasswordReset,
    verifyPasswordResetOtp,
    resetPassword,
  } = useAuth();

  const [
    mode,
    setMode,
  ] = useState("login");

  const [
    formData,
    setFormData,
  ] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [
    otp,
    setOtp,
  ] = useState("");

  const [
    resetToken,
    setResetToken,
  ] = useState("");

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showNewPassword,
    setShowNewPassword,
  ] = useState(false);

  const [
    resendSeconds,
    setResendSeconds,
  ] = useState(0);

  // ===================================================
  // TIMER
  // ===================================================

  useEffect(() => {
    if (
      resendSeconds <= 0
    ) {
      return undefined;
    }

    const timer =
      setInterval(() => {
        setResendSeconds(
          (current) =>
            Math.max(
              0,
              current - 1
            )
        );
      }, 1000);

    return () =>
      clearInterval(timer);
  }, [resendSeconds]);

  // ===================================================
  // INPUT CHANGE
  // ===================================================

  const handleChange =
    (event) => {
      const {
        name,
        value,
      } = event.target;

      setFormData(
        (current) => ({
          ...current,
          [name]: value,
        })
      );
    };

  // ===================================================
  // GOOGLE LOGIN
  // ===================================================

  const handleGoogleSuccess =
    async (
      credentialResponse
    ) => {
      const credential =
        credentialResponse
          ?.credential;

      if (!credential) {
        toast.error(
          "Google did not return a valid login."
        );

        return;
      }

      setLoading(true);

      try {
        const result =
          await loginWithGoogle(
            credential
          );

        if (!result.success) {
          toast.error(
            result.error
          );

          return;
        }

        toast.success(
          "Signed in with Google."
        );

        navigate("/");
      } finally {
        setLoading(false);
      }
    };

  // ===================================================
  // LOGIN / REGISTER
  // ===================================================

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      if (loading) {
        return;
      }

      setLoading(true);

      try {
        if (
          mode === "login"
        ) {
          const result =
            await login(
              formData.email,
              formData.password
            );

          if (
            result.success
          ) {
            toast.success(
              "Welcome back."
            );

            navigate("/");

            return;
          }

          toast.error(
            result.error
          );

          return;
        }

        if (
          mode === "register"
        ) {
          const result =
            await requestRegistrationOtp(
              formData.name,
              formData.email,
              formData.password
            );

          if (
            !result.success
          ) {
            toast.error(
              result.error
            );

            if (
              result.retryAfterSeconds
            ) {
              setResendSeconds(
                result.retryAfterSeconds
              );
            }

            return;
          }

          setOtp("");

          setResendSeconds(
            result.resendAfterSeconds ||
              60
          );

          setMode(
            "signupOtp"
          );

          toast.success(
            "Verification code sent."
          );
        }
      } catch (error) {
        console.error(
          "Authentication error:",
          error
        );

        toast.error(
          "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    };

  // ===================================================
  // SIGNUP OTP
  // ===================================================

  const handleVerifySignupOtp =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        otp.length !== 6
      ) {
        toast.error(
          "Enter the 6-digit code."
        );

        return;
      }

      setLoading(true);

      try {
        const result =
          await verifyRegistrationOtp(
            formData.email,
            otp
          );

        if (
          !result.success
        ) {
          toast.error(
            result.error
          );

          return;
        }

        toast.success(
          "Email verified."
        );

        setOtp("");

        setFormData(
          (current) => ({
            ...current,
            password: "",
          })
        );

        setMode("login");
      } finally {
        setLoading(false);
      }
    };

  // ===================================================
  // RESEND SIGNUP OTP
  // ===================================================

  const handleResendSignupOtp =
    async () => {
      if (
        loading ||
        resendSeconds > 0
      ) {
        return;
      }

      setLoading(true);

      try {
        const result =
          await resendRegistrationOtp(
            formData.email
          );

        if (
          !result.success
        ) {
          toast.error(
            result.error
          );

          if (
            result.retryAfterSeconds
          ) {
            setResendSeconds(
              result.retryAfterSeconds
            );
          }

          return;
        }

        setResendSeconds(
          result.resendAfterSeconds ||
            60
        );

        toast.success(
          "New code sent."
        );
      } finally {
        setLoading(false);
      }
    };

  // ===================================================
  // FORGOT PASSWORD
  // ===================================================

  const handleForgotPassword =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        !formData.email.trim()
      ) {
        toast.error(
          "Enter your email."
        );

        return;
      }

      setLoading(true);

      try {
        const result =
          await requestPasswordReset(
            formData.email
          );

        if (
          !result.success
        ) {
          toast.error(
            result.error
          );

          if (
            result.retryAfterSeconds
          ) {
            setResendSeconds(
              result.retryAfterSeconds
            );
          }

          return;
        }

        setOtp("");

        setResendSeconds(
          result.resendAfterSeconds ||
            60
        );

        setMode(
          "resetOtp"
        );

        toast.success(
          "Reset code sent."
        );
      } finally {
        setLoading(false);
      }
    };

  // ===================================================
  // RESEND RESET OTP
  // ===================================================

  const handleResendResetOtp =
    async () => {
      if (
        loading ||
        resendSeconds > 0
      ) {
        return;
      }

      setLoading(true);

      try {
        const result =
          await requestPasswordReset(
            formData.email
          );

        if (
          !result.success
        ) {
          toast.error(
            result.error
          );

          if (
            result.retryAfterSeconds
          ) {
            setResendSeconds(
              result.retryAfterSeconds
            );
          }

          return;
        }

        setResendSeconds(
          result.resendAfterSeconds ||
            60
        );

        toast.success(
          "New reset code sent."
        );
      } finally {
        setLoading(false);
      }
    };

  // ===================================================
  // VERIFY RESET OTP
  // ===================================================

  const handleVerifyResetOtp =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        otp.length !== 6
      ) {
        toast.error(
          "Enter the 6-digit code."
        );

        return;
      }

      setLoading(true);

      try {
        const result =
          await verifyPasswordResetOtp(
            formData.email,
            otp
          );

        if (
          !result.success
        ) {
          toast.error(
            result.error
          );

          return;
        }

        setResetToken(
          result.resetToken
        );

        setNewPassword("");
        setConfirmPassword("");

        setMode(
          "newPassword"
        );
      } finally {
        setLoading(false);
      }
    };

  // ===================================================
  // NEW PASSWORD
  // ===================================================

  const handleNewPassword =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        newPassword.length < 6
      ) {
        toast.error(
          "Password must be at least 6 characters."
        );

        return;
      }

      if (
        newPassword !==
        confirmPassword
      ) {
        toast.error(
          "Passwords do not match."
        );

        return;
      }

      setLoading(true);

      try {
        const result =
          await resetPassword(
            resetToken,
            newPassword
          );

        if (
          !result.success
        ) {
          toast.error(
            result.error
          );

          return;
        }

        setResetToken("");
        setOtp("");
        setNewPassword("");
        setConfirmPassword("");

        setFormData(
          (current) => ({
            ...current,
            password: "",
          })
        );

        setMode(
          "resetSuccess"
        );
      } finally {
        setLoading(false);
      }
    };

  // ===================================================
  // OTP INPUT
  // ===================================================

  const OtpInput = () => (
    <input
      autoFocus
      inputMode="numeric"
      autoComplete="one-time-code"
      value={otp}
      maxLength={6}
      onChange={(
        event
      ) =>
        setOtp(
          event.target.value
            .replace(
              /\D/g,
              ""
            )
            .slice(
              0,
              6
            )
        )
      }
      placeholder="000000"
      className="w-full rounded-2xl border border-white/10 bg-black/30 px-6 py-5 text-center font-mono text-3xl font-bold tracking-[0.5em] outline-none transition-all focus:border-red-500 focus:shadow-[0_0_35px_rgba(239,68,68,0.10)]"
    />
  );

  const isLogin =
    mode === "login";

  // ===================================================
  // PAGE
  // ===================================================

    return (
      <div className="cine-grain relative min-h-screen overflow-hidden bg-void pt-16 text-bone">
        <div className="grid min-h-[calc(100svh-4rem)] lg:grid-cols-[1.15fr_0.85fr]">
          {/* ---------- the stage ---------- */}
          <aside className="relative hidden overflow-hidden lg:block">
            <div aria-hidden="true" className="absolute inset-0" style={{ background: "radial-gradient(70% 60% at 30% 0%, rgba(215,25,53,.34), transparent 70%)" }} />
            <svg aria-hidden="true" viewBox="0 0 800 800" className="absolute inset-0 h-full w-full opacity-60" preserveAspectRatio="xMidYMid slice">
              <defs>
                <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#D71935" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#D71935" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points="120,-20 260,-20 640,820 -120,820" fill="url(#beam)" opacity="0.35" />
              <polygon points="520,-20 640,-20 980,820 380,820" fill="url(#beam)" opacity="0.2" />
            </svg>

            {/* a ticket that turns slowly in space */}
            <div className="absolute right-[6%] top-[7%] [perspective:1400px]">
              <motion.div
                animate={{ rotateY: [-22, 14, -22], rotateX: [10, 2, 10], y: [0, -16, 0] }}
                transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
                style={{ transformStyle: "preserve-3d" }}
                className="relative h-[250px] w-[440px] rounded-[28px] border border-white/15 bg-gradient-to-br from-char via-[#1d1d23] to-void shadow-[0_60px_140px_-30px_rgba(215,25,53,.55)]"
              >
                <div className="absolute inset-y-0 left-[68%] w-px border-l-2 border-dashed border-white/15" />
                <div className="absolute -left-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-void" />
                <div className="absolute -right-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-void" />
                <div className="absolute left-8 top-8">
                  <p className="text-sm text-zinc-500">BookMySeat</p>
                  <p className="cine-display mt-3 text-4xl text-bone">Admit<br />one.</p>
                </div>
                <div className="absolute bottom-8 left-8 flex items-center gap-3 text-sm text-zinc-400">
                  <Ticket className="h-5 w-5 text-crimson" />
                  Your digital ticket
                </div>
                <div className="absolute inset-y-8 right-8 flex w-[24%] flex-col items-center justify-center gap-2">
                  {[7, 3, 9, 4, 8, 2, 6, 5, 9, 3].map((w, i) => (
                    <span key={i} className="block h-[5px] rounded-full bg-bone/70" style={{ width: `${w * 9}%` }} />
                  ))}
                </div>
                <div className="absolute inset-0 rounded-[28px] bg-gradient-to-tr from-transparent via-white/[0.04] to-white/[0.1]" />
              </motion.div>
            </div>

            <div className="relative flex h-full flex-col justify-end p-14 xl:p-20">
              <motion.h1
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: [0.2, 0.7, 0.1, 1] }}
                className="cine-display text-[clamp(4rem,8.5vw,9rem)] text-bone"
              >
                Book.<br />Pay.<br />Enjoy.
              </motion.h1>
              <p className="mt-8 max-w-md text-[17px] leading-relaxed text-zinc-400">
                Pick your film, reserve your seats and walk in with a digital ticket.
              </p>
            </div>
          </aside>

          {/* ---------- the form ---------- */}
          <section className="relative flex items-center border-l border-white/10 bg-char/40 px-6 py-12 backdrop-blur-xl sm:px-12 lg:px-16">
            <div className="mx-auto w-full max-w-[440px]">
              <AnimatePresence mode="wait">
                {(mode === "login" || mode === "register") && (
                  <motion.div key={mode} initial={{ opacity: 0, x: mode === "login" ? -24 : 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.2, 0.7, 0.1, 1] }}>
                    <div className="relative mb-9 grid grid-cols-2 rounded-full border border-white/10 bg-void/60 p-1" role="tablist" aria-label="Sign in or create an account">
                      {[
                        ["login", "Sign in"],
                        ["register", "Create account"],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={mode === key}
                          onClick={() => setMode(key)}
                          className={`relative z-10 rounded-full py-3 text-sm font-semibold transition-colors ${mode === key ? "text-white" : "text-zinc-500 hover:text-zinc-200"}`}
                        >
                          {mode === key && <motion.span layoutId="auth-tab" className="absolute inset-0 -z-10 rounded-full bg-crimson" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                          {label}
                        </button>
                      ))}
                    </div>

                    <h2 className="cine-display text-[clamp(2.4rem,4vw,3.4rem)] text-bone">{isLogin ? "Welcome back." : "Join BookMySeat."}</h2>
                    <p className="mt-3 text-zinc-400">{isLogin ? "Continue to your movies and bookings." : "Create your account to hold seats and keep your tickets."}</p>

                    <div className="mt-8">
                      {googleEnabled && (
                        <div className="overflow-hidden rounded-full">
                          <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => toast.error("Google sign-in failed.")} theme="filled_black" size="large" shape="pill" text="continue_with" logo_alignment="left" width="360" />
                        </div>
                      )}
                      {!googleEnabled && <div className="rounded-2xl border border-white/10 bg-void/60 px-4 py-3 text-xs text-zinc-400">Google sign-in is not configured.</div>}
                    </div>

                    <div className="my-7 flex items-center gap-4">
                      <div className="h-px flex-1 bg-white/10" />
                      <span className="text-sm text-zinc-500">or with email</span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {!isLogin && (
                        <label className="group block">
                          <span className="mb-2 block text-sm text-zinc-400">Name</span>
                          <span className="relative block">
                            <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600 transition-colors group-focus-within:text-crimson" />
                            <input name="name" value={formData.name} onChange={handleChange} required placeholder="Your name" className="w-full rounded-2xl border border-white/10 bg-void/70 py-4 pl-12 pr-4 text-[15px] outline-none transition placeholder:text-zinc-600 focus:border-crimson/80" />
                          </span>
                        </label>
                      )}
                      <label className="group block">
                        <span className="mb-2 block text-sm text-zinc-400">Email</span>
                        <span className="relative block">
                          <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600 transition-colors group-focus-within:text-crimson" />
                          <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="you@example.com" className="w-full rounded-2xl border border-white/10 bg-void/70 py-4 pl-12 pr-4 text-[15px] outline-none transition placeholder:text-zinc-600 focus:border-crimson/80" />
                        </span>
                      </label>
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <label htmlFor="auth-password" className="text-sm text-zinc-400">Password</label>
                          {isLogin && (
                            <button type="button" onClick={() => setMode("forgot")} className="text-sm text-red-400 transition-colors hover:text-red-300">Forgot password?</button>
                          )}
                        </div>
                        <span className="group relative block">
                          <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600 transition-colors group-focus-within:text-crimson" />
                          <input id="auth-password" type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} required minLength={6} placeholder="••••••••" className="w-full rounded-2xl border border-white/10 bg-void/70 py-4 pl-12 pr-12 text-[15px] outline-none transition placeholder:text-zinc-600 focus:border-crimson/80" />
                          <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-white">
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </span>
                      </div>
                      <motion.button whileTap={{ scale: 0.98 }} disabled={loading} className="group mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-crimson py-4 font-semibold text-white transition-all hover:bg-crimson-hot hover:shadow-[0_16px_44px_-14px_rgba(215,25,53,.8)] disabled:opacity-50">
                        {loading ? "Please wait..." : isLogin ? "Sign in" : "Continue"}
                        {!loading && <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />}
                      </motion.button>
                    </form>
                  </motion.div>
                )}

                {mode === "signupOtp" && (
                  <motion.div key="signupOtp" initial={{ opacity: 0, scale: 0.97, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-void/70"><Mail className="h-7 w-7 text-crimson" /></span>
                    <h2 className="cine-display mt-8 text-[clamp(2.4rem,4vw,3.4rem)] text-bone">Check your inbox.</h2>
                    <p className="mt-4 text-zinc-400">We sent a 6-digit code to</p>
                    <p className="mt-1 text-lg font-medium text-bone">{formData.email}</p>
                    <form onSubmit={handleVerifySignupOtp} className="mt-9">
                      <OtpInput />
                      <button disabled={loading || otp.length !== 6} className="mt-6 w-full rounded-full bg-crimson py-4 font-semibold text-white transition-all hover:bg-crimson-hot disabled:opacity-40">Verify email</button>
                    </form>
                    <div className="mt-6 text-center text-sm text-zinc-500">
                      Did not get it?{" "}
                      <button type="button" disabled={resendSeconds > 0} onClick={handleResendSignupOtp} className="text-red-400 transition-colors hover:text-red-300 disabled:text-zinc-600">
                        {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend"}
                      </button>
                    </div>
                  </motion.div>
                )}

                {mode === "forgot" && (
                  <motion.div key="forgot" initial={{ opacity: 0, x: 25 }} animate={{ opacity: 1, x: 0 }}>
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-void/70"><KeyRound className="h-7 w-7 text-crimson" /></span>
                    <h2 className="cine-display mt-8 text-[clamp(2.4rem,4vw,3.4rem)] text-bone">Forgot your password?</h2>
                    <p className="mt-4 text-zinc-400">Enter your email and we will send you a reset code.</p>
                    <form onSubmit={handleForgotPassword} className="mt-9">
                      <span className="group relative block">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600 transition-colors group-focus-within:text-crimson" />
                        <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="you@example.com" className="w-full rounded-2xl border border-white/10 bg-void/70 py-4 pl-12 pr-4 text-[15px] outline-none transition placeholder:text-zinc-600 focus:border-crimson/80" />
                      </span>
                      <button disabled={loading} className="mt-5 w-full rounded-full bg-crimson py-4 font-semibold text-white transition-all hover:bg-crimson-hot disabled:opacity-50">Send reset code</button>
                    </form>
                    <button type="button" onClick={() => setMode("login")} className="mx-auto mt-8 flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white">
                      <ArrowLeft className="h-4 w-4" />
                      Back to sign in
                    </button>
                  </motion.div>
                )}

                {mode === "resetOtp" && (
                  <motion.div key="resetOtp" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-void/70"><ShieldCheck className="h-7 w-7 text-crimson" /></span>
                    <h2 className="cine-display mt-8 text-[clamp(2.4rem,4vw,3.4rem)] text-bone">Enter your code.</h2>
                    <p className="mt-4 text-zinc-400">Sent to {formData.email}</p>
                    <form onSubmit={handleVerifyResetOtp} className="mt-9">
                      <OtpInput />
                      <button disabled={otp.length !== 6} className="mt-6 w-full rounded-full bg-crimson py-4 font-semibold text-white transition-all hover:bg-crimson-hot disabled:opacity-40">Verify code</button>
                    </form>
                    <div className="mt-6 text-center text-sm text-zinc-500">
                      <button type="button" disabled={resendSeconds > 0} onClick={handleResendResetOtp} className="text-red-400 transition-colors hover:text-red-300 disabled:text-zinc-600">
                        {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
                      </button>
                    </div>
                  </motion.div>
                )}

                {mode === "newPassword" && (
                  <motion.div key="newPassword" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-void/70"><KeyRound className="h-7 w-7 text-crimson" /></span>
                    <h2 className="cine-display mt-8 text-[clamp(2.4rem,4vw,3.4rem)] text-bone">New password.</h2>
                    <form onSubmit={handleNewPassword} className="mt-9 space-y-4">
                      <span className="group relative block">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600 transition-colors group-focus-within:text-crimson" />
                        <input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required placeholder="New password" className="w-full rounded-2xl border border-white/10 bg-void/70 py-4 pl-12 pr-12 text-[15px] outline-none transition placeholder:text-zinc-600 focus:border-crimson/80" />
                        <button type="button" aria-label={showNewPassword ? "Hide password" : "Show password"} onClick={() => setShowNewPassword((current) => !current)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-white">
                          {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </span>
                      <span className="group relative block">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600 transition-colors group-focus-within:text-crimson" />
                        <input type={showNewPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required placeholder="Confirm password" className="w-full rounded-2xl border border-white/10 bg-void/70 py-4 pl-12 pr-4 text-[15px] outline-none transition placeholder:text-zinc-600 focus:border-crimson/80" />
                      </span>
                      <button disabled={loading} className="w-full rounded-full bg-crimson py-4 font-semibold text-white transition-all hover:bg-crimson-hot disabled:opacity-50">Change password</button>
                    </form>
                  </motion.div>
                )}

                {mode === "resetSuccess" && (
                  <motion.div key="success" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-crimson/40 bg-crimson/10"><Check className="h-10 w-10 text-crimson" /></div>
                    <h2 className="cine-display mt-8 text-[clamp(2.4rem,4vw,3.4rem)] text-bone">Password changed.</h2>
                    <p className="mt-4 text-zinc-400">You can now sign in with your new password.</p>
                    <button onClick={() => setMode("login")} className="mt-9 w-full rounded-full bg-crimson py-4 font-semibold text-white transition-all hover:bg-crimson-hot">Sign in</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </div>
    );
};

// =====================================================
// GOOGLE PROVIDER
// =====================================================

const AuthInner = () => {
  if (
    !GOOGLE_CLIENT_ID
  ) {
    return (
      <AuthContent
        googleEnabled={
          false
        }
      />
    );
  }

  return (
    <GoogleOAuthProvider
      clientId={
        GOOGLE_CLIENT_ID
      }
    >
      <AuthContent
        googleEnabled
      />
    </GoogleOAuthProvider>
  );
};

const Auth = () => <AuthInner />;

export default Auth;
