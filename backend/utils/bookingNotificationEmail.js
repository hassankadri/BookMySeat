const {
  Resend,
} =
  require("resend");

let resendInstance =
  null;

// =====================================================
// RESEND
// =====================================================

const getResend =
  () => {
    if (
      !process.env
        .RESEND_API_KEY
    ) {
      throw new Error(
        "RESEND_API_KEY is not configured."
      );
    }

    if (
      !resendInstance
    ) {
      resendInstance =
        new Resend(
          process.env
            .RESEND_API_KEY
        );
    }

    return resendInstance;
  };

// =====================================================
// SECURITY
// =====================================================

const escapeHtml = (
  value = ""
) =>
  String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

// =====================================================
// DATE
// =====================================================

const formatShowDate =
  (value) => {
    if (!value) {
      return "—";
    }

    return new Intl.DateTimeFormat(
      "en-IN",
      {
        weekday:
          "long",

        day:
          "numeric",

        month:
          "long",

        year:
          "numeric",

        timeZone:
          "Asia/Kolkata",
      }
    ).format(
      new Date(value)
    );
  };

const formatShowTime =
  (value) => {
    if (!value) {
      return "—";
    }

    return new Intl.DateTimeFormat(
      "en-IN",
      {
        hour:
          "numeric",

        minute:
          "2-digit",

        timeZone:
          "Asia/Kolkata",
      }
    ).format(
      new Date(value)
    );
  };

// =====================================================
// CONTENT
// =====================================================

const getNotificationContent =
  ({
    type,
    name,
    movieTitle,
    amount,
    reason,
  }) => {
    switch (type) {
      case "CANCELLATION":
        return {
          subject:
            `Booking cancelled — ${movieTitle}`,

          heading:
            "Booking Cancelled",

          message:
            `Hi ${name}, your booking for ${movieTitle} has been cancelled successfully.`,

          accent:
            "#ef4444",
        };

      case "REFUND_PENDING":
        return {
          subject:
            `Refund processing — ${movieTitle}`,

          heading:
            "Refund Processing",

          message:
            `Hi ${name}, your cancellation has been received. Your refund of ₹${amount} is currently being processed.`,

          accent:
            "#a855f7",
        };

      case "REFUND_COMPLETED":
        return {
          subject:
            `Refund completed — ${movieTitle}`,

          heading:
            "Refund Completed",

          message:
            `Hi ${name}, your refund of ₹${amount} for ${movieTitle} has been processed successfully.`,

          accent:
            "#3b82f6",
        };

      case "PAYMENT_FAILED":
        return {
          subject:
            `Payment failed — ${movieTitle}`,

          heading:
            "Payment Failed",

          message:
            `Hi ${name}, we could not complete your payment for ${movieTitle}. Your seats have been released and you can try booking again.`,

          accent:
            "#ef4444",
        };

      case "SHOW_REMINDER":
        return {
          subject:
            `Your show is coming up — ${movieTitle}`,

          heading:
            "Your Movie Starts Soon",

          message:
            `Hi ${name}, this is a reminder that your booking for ${movieTitle} is coming up soon.`,

          accent:
            "#dc2626",
        };

      default:
        return {
          subject:
            "BookMySeat update",

          heading:
            "Booking Update",

          message:
            `Hi ${name}, there is an update regarding your BookMySeat booking.`,

          accent:
            "#dc2626",
        };
    }
  };

// =====================================================
// SEND
// =====================================================

const sendBookingNotification =
  async ({
    to,
    type,

    name =
      "Moviegoer",

    movieTitle =
      "your movie",

    bookingCode =
      "",

    showTime =
      null,

    theatreName =
      "",

    screenName =
      "",

    seats =
      [],

    amount =
      0,

    reason =
      "",
  }) => {
    if (!to) {
      throw new Error(
        "Notification email address is missing."
      );
    }

    const {
      subject,
      heading,
      message,
      accent,
    } =
      getNotificationContent({
        type,

        name,

        movieTitle,

        amount:
          Number(
            amount || 0
          ).toLocaleString(
            "en-IN"
          ),

        reason,
      });

    const frontendUrl =
      String(
        process.env
          .FRONTEND_URL ||
          "http://localhost:3000"
      ).replace(
        /\/$/,
        ""
      );

    const safe = {
      heading:
        escapeHtml(
          heading
        ),

      message:
        escapeHtml(
          message
        ),

      movieTitle:
        escapeHtml(
          movieTitle
        ),

      bookingCode:
        escapeHtml(
          bookingCode
        ),

      theatreName:
        escapeHtml(
          theatreName
        ),

      screenName:
        escapeHtml(
          screenName
        ),

      reason:
        escapeHtml(
          reason
        ),

      seats:
        escapeHtml(
          Array.isArray(
            seats
          )
            ? seats.join(
                ", "
              )
            : String(
                seats || ""
              )
        ),
    };

    const details = [];

    if (
      safe.bookingCode
    ) {
      details.push({
        label:
          "Booking",

        value:
          `#${safe.bookingCode}`,
      });
    }

    if (
      showTime
    ) {
      details.push({
        label:
          "Show",

        value:
          `${formatShowDate(
            showTime
          )} • ${formatShowTime(
            showTime
          )}`,
      });
    }

    if (
      safe.theatreName
    ) {
      details.push({
        label:
          "Cinema",

        value:
          `${safe.theatreName}${
            safe.screenName
              ? ` • ${safe.screenName}`
              : ""
          }`,
      });
    }

    if (
      safe.seats
    ) {
      details.push({
        label:
          "Seats",

        value:
          safe.seats,
      });
    }

    if (
      amount &&
      [
        "REFUND_PENDING",
        "REFUND_COMPLETED",
      ].includes(type)
    ) {
      details.push({
        label:
          "Refund",

        value:
          `₹${Number(
            amount
          ).toLocaleString(
            "en-IN"
          )}`,
      });
    }

    const detailsHtml =
      details
        .map(
          (
            item
          ) => `
            <tr>
              <td style="
                padding:10px 0;
                color:#71717a;
                font-size:13px;
                width:90px;
                vertical-align:top;
              ">
                ${item.label}
              </td>

              <td style="
                padding:10px 0;
                color:#f4f4f5;
                font-size:14px;
              ">
                ${item.value}
              </td>
            </tr>
          `
        )
        .join("");

    const reasonHtml =
      safe.reason &&
      type !==
        "SHOW_REMINDER"
        ? `
          <div style="
            margin-top:22px;
            padding:14px 16px;
            border:1px solid #27272a;
            border-radius:10px;
            background:#111113;
          ">
            <div style="
              color:#71717a;
              font-size:11px;
              text-transform:uppercase;
              letter-spacing:.08em;
            ">
              Details
            </div>

            <div style="
              margin-top:7px;
              color:#d4d4d8;
              font-size:13px;
              line-height:1.6;
            ">
              ${safe.reason}
            </div>
          </div>
        `
        : "";

    const html = `
      <!doctype html>

      <html>
        <body style="
          margin:0;
          padding:0;
          background:#09090b;
          font-family:Arial,Helvetica,sans-serif;
        ">

          <div style="
            max-width:620px;
            margin:0 auto;
            padding:40px 20px;
          ">

            <div style="
              color:#ef4444;
              font-weight:800;
              font-size:20px;
            ">
              BookMySeat
            </div>

            <div style="
              margin-top:25px;
              border:1px solid #27272a;
              border-radius:16px;
              background:#18181b;
              overflow:hidden;
            ">

              <div style="
                height:4px;
                background:${accent};
              "></div>

              <div style="
                padding:30px;
              ">

                <h1 style="
                  margin:0;
                  color:#ffffff;
                  font-size:25px;
                ">
                  ${safe.heading}
                </h1>

                <p style="
                  margin:15px 0 0;
                  color:#a1a1aa;
                  font-size:14px;
                  line-height:1.7;
                ">
                  ${safe.message}
                </p>

                <div style="
                  margin-top:25px;
                  padding:20px;
                  background:#0c0c0f;
                  border-radius:12px;
                ">

                  <div style="
                    color:#ffffff;
                    font-size:17px;
                    font-weight:700;
                    margin-bottom:10px;
                  ">
                    ${safe.movieTitle}
                  </div>

                  <table
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                  >
                    ${detailsHtml}
                  </table>

                </div>

                ${reasonHtml}

                <a
                  href="${frontendUrl}/my-bookings"
                  style="
                    display:inline-block;
                    margin-top:25px;
                    padding:13px 20px;
                    background:#dc2626;
                    color:#ffffff;
                    text-decoration:none;
                    border-radius:9px;
                    font-size:14px;
                    font-weight:700;
                  "
                >
                  View My Bookings
                </a>

              </div>

            </div>

            <p style="
              margin-top:20px;
              color:#52525b;
              font-size:11px;
              line-height:1.6;
            ">
              This is an automated BookMySeat notification.
            </p>

          </div>

        </body>
      </html>
    `;

    const resend =
      getResend();

    const {
      data,
      error,
    } =
      await resend.emails.send({
        from:
          process.env
            .EMAIL_FROM ||
          "BookMySeat <onboarding@resend.dev>",

        to: [to],

        subject,

        html,

        text:
          `${heading}\n\n${message}\n\n` +
          `Movie: ${movieTitle}\n` +
          (
            bookingCode
              ? `Booking: #${bookingCode}\n`
              : ""
          ) +
          (
            showTime
              ? `Show: ${formatShowDate(
                  showTime
                )} ${formatShowTime(
                  showTime
                )}\n`
              : ""
          ) +
          (
            theatreName
              ? `Cinema: ${theatreName}\n`
              : ""
          ),
      });

    if (error) {
      throw new Error(
        error.message ||
        "Resend could not send notification."
      );
    }

    return data;
  };

module.exports = {
  sendBookingNotification,
};