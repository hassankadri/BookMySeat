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
    <div className="relative min-h-screen overflow-hidden bg-[#08090b] px-4 pt-24 pb-12">

      {/* BACKGROUND */}

      <motion.div
        animate={{
          x: [
            0,
            70,
            0,
          ],

          y: [
            0,
            -40,
            0,
          ],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease:
            "easeInOut",
        }}
        className="pointer-events-none absolute -left-40 top-20 h-[420px] w-[420px] rounded-full bg-red-600/10 blur-[120px]"
      />

      <motion.div
        animate={{
          x: [
            0,
            -50,
            0,
          ],

          y: [
            0,
            40,
            0,
          ],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease:
            "easeInOut",
        }}
        className="pointer-events-none absolute -right-40 bottom-0 h-[420px] w-[420px] rounded-full bg-red-500/5 blur-[120px]"
      />

      <div className="relative mx-auto grid min-h-[650px] max-w-5xl overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950/80 shadow-2xl backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">

        {/* LEFT */}

        <div className="relative hidden overflow-hidden border-r border-white/10 bg-black p-12 lg:flex lg:flex-col lg:justify-between">

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(239,68,68,0.18),transparent_35%)]" />

          <motion.div
            animate={{
              y: [
                0,
                -14,
                0,
              ],

              rotate: [
                -7,
                -4,
                -7,
              ],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease:
                "easeInOut",
            }}
            className="absolute right-10 top-24 h-32 w-52 rounded-2xl border border-red-500/20 bg-red-500/5"
          >
            <div className="absolute left-5 top-5 h-2 w-20 rounded-full bg-white/10" />

            <div className="absolute left-5 top-11 h-2 w-32 rounded-full bg-white/5" />

            <Ticket className="absolute bottom-5 right-5 h-7 w-7 text-red-500/60" />
          </motion.div>

          <motion.div
            animate={{
              y: [
                0,
                12,
                0,
              ],

              rotate: [
                7,
                4,
                7,
              ],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease:
                "easeInOut",
            }}
            className="absolute right-24 top-44 h-32 w-52 rounded-2xl border border-white/10 bg-zinc-900/80"
          />

          <div className="relative z-10">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600">
                <Ticket className="h-6 w-6" />
              </div>

              <span className="text-xl font-bold">
                BookMySeat
              </span>

            </div>

          </div>

          <div className="relative z-10">

            <p className="text-sm uppercase tracking-[0.3em] text-red-500">
              Your movie night starts here
            </p>

            <h1 className="mt-5 text-5xl font-bold leading-[1.05]">

              Book.
              <br />

              Pay.
              <br />

              <span className="text-red-500">
                Enjoy.
              </span>

            </h1>

            <p className="mt-6 max-w-sm text-sm leading-6 text-zinc-500">
              Pick your movie, reserve your seats and enter
              the theatre with your digital ticket.
            </p>

          </div>

          <div className="relative z-10 flex items-center gap-3 text-xs text-zinc-600">

            <ShieldCheck className="h-4 w-4 text-green-500" />

            Secure authentication

          </div>

        </div>

        {/* RIGHT */}

        <div className="flex items-center p-7 sm:p-10 lg:p-12">

          <div className="w-full">

            <AnimatePresence mode="wait">

              {/* LOGIN / REGISTER */}

              {(
                mode ===
                  "login" ||
                mode ===
                  "register"
              ) && (
                <motion.div
                  key={mode}
                  initial={{
                    opacity: 0,

                    x:
                      mode ===
                      "login"
                        ? -20
                        : 20,
                  }}
                  animate={{
                    opacity: 1,
                    x: 0,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                >

                  <div className="mb-7">

                    <p className="text-sm uppercase tracking-[0.25em] text-red-500">
                      {isLogin
                        ? "Welcome back"
                        : "Join BookMySeat"}
                    </p>

                    <h2 className="mt-2 text-3xl font-bold">
                      {isLogin
                        ? "Sign in"
                        : "Create account"}
                    </h2>

                    <p className="mt-2 text-sm text-zinc-500">
                      {isLogin
                        ? "Continue to your movies and bookings."
                        : "Create your BookMySeat account."}
                    </p>

                  </div>

                  {/* GOOGLE */}

                  {googleEnabled && (
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: -8,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      whileHover={{
                        scale:
                          1.01,
                      }}
                      className="overflow-hidden rounded-xl"
                    >

                      <GoogleLogin
                        onSuccess={
                          handleGoogleSuccess
                        }
                        onError={() =>
                          toast.error(
                            "Google sign-in failed."
                          )
                        }
                        theme="filled_black"
                        size="large"
                        shape="pill"
                        text="continue_with"
                        logo_alignment="left"
                        width="400"
                      />

                    </motion.div>
                  )}

                  {!googleEnabled && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-400">
                      Google login is not configured.
                    </div>
                  )}

                  {/* OR */}

                  <div className="my-6 flex items-center gap-4">

                    <div className="h-px flex-1 bg-white/10" />

                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                      or
                    </span>

                    <div className="h-px flex-1 bg-white/10" />

                  </div>

                  <form
                    onSubmit={
                      handleSubmit
                    }
                    className="space-y-5"
                  >

                    {!isLogin && (
                      <div>

                        <label className="mb-2 block text-sm text-zinc-400">
                          Name
                        </label>

                        <div className="group relative rounded-xl border border-white/10 bg-black/30 focus-within:border-red-500">

                          <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600 group-focus-within:text-red-500" />

                          <input
                            name="name"
                            value={
                              formData.name
                            }
                            onChange={
                              handleChange
                            }
                            required
                            placeholder="Your name"
                            className="w-full bg-transparent py-4 pl-12 pr-4 outline-none"
                          />

                        </div>

                      </div>
                    )}

                    <div>

                      <label className="mb-2 block text-sm text-zinc-400">
                        Email
                      </label>

                      <div className="group relative rounded-xl border border-white/10 bg-black/30 focus-within:border-red-500">

                        <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600 group-focus-within:text-red-500" />

                        <input
                          type="email"
                          name="email"
                          value={
                            formData.email
                          }
                          onChange={
                            handleChange
                          }
                          required
                          placeholder="you@example.com"
                          className="w-full bg-transparent py-4 pl-12 pr-4 outline-none"
                        />

                      </div>

                    </div>

                    <div>

                      <div className="mb-2 flex justify-between">

                        <label className="text-sm text-zinc-400">
                          Password
                        </label>

                        {isLogin && (
                          <button
                            type="button"
                            onClick={() =>
                              setMode(
                                "forgot"
                              )
                            }
                            className="text-xs text-red-500 hover:text-red-400"
                          >
                            Forgot password?
                          </button>
                        )}

                      </div>

                      <div className="group relative rounded-xl border border-white/10 bg-black/30 focus-within:border-red-500">

                        <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600" />

                        <input
                          type={
                            showPassword
                              ? "text"
                              : "password"
                          }
                          name="password"
                          value={
                            formData.password
                          }
                          onChange={
                            handleChange
                          }
                          required
                          minLength={6}
                          placeholder="••••••••"
                          className="w-full bg-transparent py-4 pl-12 pr-12 outline-none"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword(
                              (current) =>
                                !current
                            )
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white"
                        >

                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}

                        </button>

                      </div>

                    </div>

                    <motion.button
                      whileHover={{
                        scale:
                          1.01,
                      }}
                      whileTap={{
                        scale:
                          0.98,
                      }}
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-4 font-semibold hover:bg-red-500 disabled:opacity-50"
                    >

                      {loading
                        ? "Please wait..."
                        : isLogin
                        ? "Sign In"
                        : "Continue"}

                      {!loading && (
                        <ArrowRight className="h-4 w-4" />
                      )}

                    </motion.button>

                  </form>

                  <div className="mt-7 text-center text-sm text-zinc-500">

                    {isLogin
                      ? "New to BookMySeat? "
                      : "Already have an account? "}

                    <button
                      type="button"
                      onClick={() =>
                        setMode(
                          isLogin
                            ? "register"
                            : "login"
                        )
                      }
                      className="text-red-500 hover:text-red-400"
                    >
                      {isLogin
                        ? "Create account"
                        : "Sign in"}
                    </button>

                  </div>

                </motion.div>
              )}

              {/* SIGNUP OTP */}

              {mode ===
                "signupOtp" && (
                <motion.div
                  key="signupOtp"
                  initial={{
                    opacity: 0,
                    scale: 0.96,
                    y: 20,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                >

                  <Mail className="mb-6 h-12 w-12 text-red-500" />

                  <p className="text-sm uppercase tracking-[0.25em] text-red-500">
                    Verify email
                  </p>

                  <h2 className="mt-2 text-3xl font-bold">
                    Check your inbox
                  </h2>

                  <p className="mt-3 text-sm text-zinc-500">
                    Code sent to
                  </p>

                  <p className="mt-1 font-medium">
                    {
                      formData.email
                    }
                  </p>

                  <form
                    onSubmit={
                      handleVerifySignupOtp
                    }
                    className="mt-8"
                  >

                    <OtpInput />

                    <button
                      disabled={
                        loading ||
                        otp.length !== 6
                      }
                      className="mt-5 w-full rounded-xl bg-red-600 py-4 font-semibold disabled:opacity-50"
                    >
                      Verify Email
                    </button>

                  </form>

                  <div className="mt-6 text-center text-sm text-zinc-500">

                    Didn't receive it?{" "}

                    <button
                      type="button"
                      disabled={
                        resendSeconds > 0
                      }
                      onClick={
                        handleResendSignupOtp
                      }
                      className="text-red-500 disabled:text-zinc-600"
                    >
                      {resendSeconds > 0
                        ? `Resend in ${resendSeconds}s`
                        : "Resend"}
                    </button>

                  </div>

                </motion.div>
              )}

              {/* FORGOT */}

              {mode ===
                "forgot" && (
                <motion.div
                  key="forgot"
                  initial={{
                    opacity: 0,
                    x: 25,
                  }}
                  animate={{
                    opacity: 1,
                    x: 0,
                  }}
                >

                  <KeyRound className="mb-6 h-12 w-12 text-red-500" />

                  <p className="text-sm uppercase tracking-[0.25em] text-red-500">
                    Account recovery
                  </p>

                  <h2 className="mt-2 text-3xl font-bold">
                    Forgot password?
                  </h2>

                  <p className="mt-3 text-sm text-zinc-500">
                    Enter your email and we'll send you a reset code.
                  </p>

                  <form
                    onSubmit={
                      handleForgotPassword
                    }
                    className="mt-8"
                  >

                    <div className="relative rounded-xl border border-white/10 bg-black/30">

                      <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600" />

                      <input
                        type="email"
                        name="email"
                        value={
                          formData.email
                        }
                        onChange={
                          handleChange
                        }
                        required
                        placeholder="you@example.com"
                        className="w-full bg-transparent py-4 pl-12 pr-4 outline-none"
                      />

                    </div>

                    <button
                      disabled={loading}
                      className="mt-5 w-full rounded-xl bg-red-600 py-4 font-semibold disabled:opacity-50"
                    >
                      Send Reset Code
                    </button>

                  </form>

                  <button
                    type="button"
                    onClick={() =>
                      setMode(
                        "login"
                      )
                    }
                    className="mx-auto mt-7 flex items-center gap-2 text-sm text-zinc-500"
                  >
                    <ArrowLeft className="h-4 w-4" />

                    Back to sign in
                  </button>

                </motion.div>
              )}

              {/* RESET OTP */}

              {mode ===
                "resetOtp" && (
                <motion.div
                  key="resetOtp"
                  initial={{
                    opacity: 0,
                    y: 20,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                >

                  <ShieldCheck className="mb-6 h-12 w-12 text-red-500" />

                  <h2 className="text-3xl font-bold">
                    Enter reset code
                  </h2>

                  <p className="mt-3 text-sm text-zinc-500">
                    Sent to {
                      formData.email
                    }
                  </p>

                  <form
                    onSubmit={
                      handleVerifyResetOtp
                    }
                    className="mt-8"
                  >

                    <OtpInput />

                    <button
                      disabled={
                        otp.length !== 6
                      }
                      className="mt-5 w-full rounded-xl bg-red-600 py-4 font-semibold disabled:opacity-50"
                    >
                      Verify Code
                    </button>

                  </form>

                  <div className="mt-6 text-center text-sm text-zinc-500">

                    <button
                      type="button"
                      disabled={
                        resendSeconds > 0
                      }
                      onClick={
                        handleResendResetOtp
                      }
                      className="text-red-500 disabled:text-zinc-600"
                    >
                      {resendSeconds > 0
                        ? `Resend in ${resendSeconds}s`
                        : "Resend code"}
                    </button>

                  </div>

                </motion.div>
              )}

              {/* NEW PASSWORD */}

              {mode ===
                "newPassword" && (
                <motion.div
                  key="newPassword"
                  initial={{
                    opacity: 0,
                    y: 20,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                >

                  <KeyRound className="mb-6 h-12 w-12 text-green-400" />

                  <h2 className="text-3xl font-bold">
                    New password
                  </h2>

                  <form
                    onSubmit={
                      handleNewPassword
                    }
                    className="mt-8 space-y-5"
                  >

                    <div className="relative rounded-xl border border-white/10 bg-black/30">

                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600" />

                      <input
                        type={
                          showNewPassword
                            ? "text"
                            : "password"
                        }
                        value={
                          newPassword
                        }
                        onChange={(
                          event
                        ) =>
                          setNewPassword(
                            event.target.value
                          )
                        }
                        required
                        placeholder="New password"
                        className="w-full bg-transparent py-4 pl-12 pr-12 outline-none"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowNewPassword(
                            (current) =>
                              !current
                          )
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2"
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>

                    </div>

                    <div className="relative rounded-xl border border-white/10 bg-black/30">

                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600" />

                      <input
                        type={
                          showNewPassword
                            ? "text"
                            : "password"
                        }
                        value={
                          confirmPassword
                        }
                        onChange={(
                          event
                        ) =>
                          setConfirmPassword(
                            event.target.value
                          )
                        }
                        required
                        placeholder="Confirm password"
                        className="w-full bg-transparent py-4 pl-12 pr-4 outline-none"
                      />

                    </div>

                    <button
                      disabled={loading}
                      className="w-full rounded-xl bg-red-600 py-4 font-semibold disabled:opacity-50"
                    >
                      Change Password
                    </button>

                  </form>

                </motion.div>
              )}

              {/* SUCCESS */}

              {mode ===
                "resetSuccess" && (
                <motion.div
                  key="success"
                  initial={{
                    opacity: 0,
                    scale: 0.9,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  className="text-center"
                >

                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
                    <Check className="h-10 w-10 text-green-400" />
                  </div>

                  <h2 className="mt-7 text-3xl font-bold">
                    Password changed
                  </h2>

                  <p className="mt-3 text-zinc-500">
                    You can now sign in with your new password.
                  </p>

                  <button
                    onClick={() =>
                      setMode(
                        "login"
                      )
                    }
                    className="mt-8 w-full rounded-xl bg-red-600 py-4 font-semibold"
                  >
                    Sign In
                  </button>

                </motion.div>
              )}

            </AnimatePresence>

          </div>

        </div>

      </div>

    </div>
  );
};

// =====================================================
// GOOGLE PROVIDER
// =====================================================

const Auth = () => {
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

export default Auth;