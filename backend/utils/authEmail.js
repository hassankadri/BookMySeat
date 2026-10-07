const { Resend } = require("resend");

const getResend = () => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is missing."
    );
  }

  return new Resend(
    process.env.RESEND_API_KEY
  );
};

const getFrom = () =>
  process.env.EMAIL_FROM ||
  "BookMySeat <onboarding@resend.dev>";

// =====================================================
// SIGNUP OTP
// =====================================================

const sendVerificationOtp = async ({
  email,
  name,
  otp,
}) => {
  const resend = getResend();

  const { error } =
    await resend.emails.send({
      from: getFrom(),

      to: [email],

      subject:
        `${otp} is your BookMySeat verification code`,

      html: createOtpEmail({
        name,
        otp,
        title:
          "Verify your email",

        message:
          "Enter this code to finish creating your BookMySeat account.",
      }),
    });

  if (error) {
    console.error(
      "Resend verification error:",
      error
    );

    throw new Error(
      error.message
    );
  }
};

// =====================================================
// PASSWORD RESET OTP
// =====================================================

const sendPasswordResetOtp = async ({
  email,
  name,
  otp,
}) => {
  const resend = getResend();

  const { error } =
    await resend.emails.send({
      from: getFrom(),

      to: [email],

      subject:
        `${otp} is your BookMySeat password reset code`,

      html: createOtpEmail({
        name,
        otp,
        title:
          "Reset your password",

        message:
          "Enter this code in BookMySeat to reset your password.",
      }),
    });

  if (error) {
    console.error(
      "Resend reset error:",
      error
    );

    throw new Error(
      error.message
    );
  }
};

// =====================================================
// EMAIL TEMPLATE
// =====================================================

const createOtpEmail = ({
  name,
  otp,
  title,
  message,
}) => `
  <div
    style="
      font-family:Arial,sans-serif;
      background:#09090b;
      padding:40px 20px;
      color:#fff;
    "
  >
    <div
      style="
        max-width:520px;
        margin:auto;
        background:#18181b;
        border:1px solid #27272a;
        border-radius:18px;
        padding:32px;
      "
    >

      <div
        style="
          color:#ef4444;
          font-size:22px;
          font-weight:700;
          margin-bottom:28px;
        "
      >
        BookMySeat
      </div>

      <h2>
        ${title}
      </h2>

      <p
        style="
          color:#a1a1aa;
          line-height:1.6;
        "
      >
        Hi ${name},
        ${message}
      </p>

      <div
        style="
          margin:30px 0;
          background:#09090b;
          border:1px solid #3f3f46;
          border-radius:14px;
          padding:22px;
          text-align:center;
          font-size:34px;
          font-weight:700;
          letter-spacing:10px;
        "
      >
        ${otp}
      </div>

      <p
        style="
          color:#71717a;
          font-size:13px;
        "
      >
        This code expires in 10 minutes.
      </p>

    </div>
  </div>
`;

module.exports = {
  sendVerificationOtp,
  sendPasswordResetOtp,
};