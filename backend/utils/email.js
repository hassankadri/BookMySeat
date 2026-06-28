const nodemailer = require('nodemailer');

const createTransporter = () => {
  // Only create transporter if mail credentials are provided
  if (!process.env.MAIL_USER || !process.env.MAIL_PASSWORD) {
    console.warn('⚠️  Email credentials not configured. Emails will not be sent.');
    return null;
  }

  return nodemailer.createTransporter({
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT),
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD
    }
  });
};

const sendBookingConfirmation = async (bookingData) => {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.log('📧 Email would be sent to:', bookingData.email);
    return;
  }

  const { email, name, bookingReference, movieTitle, movieRating, showDate, showTime, seats, totalAmount, theaterName, theaterAddress } = bookingData;

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .booking-ref { background: #f9fafb; padding: 15px; border-radius: 8px; text-align: center; font-size: 20px; font-weight: bold; color: #dc2626; margin: 20px 0; }
    .section { margin: 20px 0; padding-bottom: 15px; border-bottom: 1px solid #e5e7eb; }
    .section h2 { color: #1f2937; font-size: 18px; margin-bottom: 10px; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .label { font-weight: 600; color: #6b7280; }
    .value { color: #1f2937; }
    .seats { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
    .seat { background: #dc2626; color: white; padding: 8px 12px; border-radius: 4px; font-weight: 600; }
    .total { background: #f9fafb; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
    .total .amount { font-size: 32px; font-weight: bold; color: #dc2626; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎬 Booking Confirmed!</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>Your movie tickets have been successfully booked! Get ready for an amazing cinematic experience.</p>
      
      <div class="booking-ref">Booking Reference: ${bookingReference}</div>
      
      <div class="section">
        <h2>Movie Details</h2>
        <div class="info-row">
          <span class="label">Movie:</span>
          <span class="value">${movieTitle} (${movieRating})</span>
        </div>
        <div class="info-row">
          <span class="label">Date:</span>
          <span class="value">${showDate}</span>
        </div>
        <div class="info-row">
          <span class="label">Time:</span>
          <span class="value">${showTime}</span>
        </div>
      </div>
      
      <div class="section">
        <h2>Theater Information</h2>
        <div class="info-row">
          <span class="label">Theater:</span>
          <span class="value">${theaterName}</span>
        </div>
        <div class="info-row">
          <span class="label">Address:</span>
          <span class="value">${theaterAddress}</span>
        </div>
      </div>
      
      <div class="section">
        <h2>Your Seats</h2>
        <div class="seats">
          ${seats.map(seat => `<span class="seat">${seat}</span>`).join('')}
        </div>
      </div>
      
      <div class="total">
        <div class="label">Total Amount Paid</div>
        <div class="amount">$${totalAmount.toFixed(2)}</div>
      </div>
      
      <div class="section">
        <h2>Important Information</h2>
        <ul>
          <li>Please arrive 15 minutes before showtime</li>
          <li>Present your booking reference at the counter</li>
          <li>Food and beverages are available at the concession stand</li>
        </ul>
      </div>
    </div>
    <div class="footer">
      <p>Thank you for choosing BookMySeat!</p>
      <p>For support, contact us at support@bookmyseat.com</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: `"BookMySeat" <${process.env.MAIL_FROM}>`,
      to: email,
      subject: `Booking Confirmation - ${bookingReference}`,
      html: emailHtml
    });
    console.log('✅ Booking confirmation email sent to:', email);
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
  }
};

module.exports = { sendBookingConfirmation };