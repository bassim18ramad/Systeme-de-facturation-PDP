const nodemailer = require("nodemailer");

// Create reusable transporter object using the default SMTP transport
const createTransporter = async () => {
  // If we have real credentials, use them
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Otherwise generate a test account
  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log("Ethereal Email Test Account Created:", testAccount.user);

    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user, // generated ethereal user
        pass: testAccount.pass, // generated ethereal password
      },
    });
  } catch (err) {
    console.warn(
      "⚠️ Failed to create Ethereal test account. Emails will only be logged to console.",
    );
    return {
      sendMail: async (mailOptions) => {
        console.log("---------------------------------------------------");
        console.log("📧 EMAIL MOCK (No SMTP configured & Ethereal failed)");
        console.log("TO:", mailOptions.to);
        console.log("SUBJECT:", mailOptions.subject);
        console.log("TEXT:", mailOptions.text);
        console.log("---------------------------------------------------");
        return { messageId: "mock-id-" + Date.now() };
      },
    };
  }
};

const sendVerificationEmail = async (email, token) => {
  try {
    const transporter = await createTransporter();

    // Setup email data
    const verifyLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email?token=${token}`;

    const info = await transporter.sendMail({
      from: '"Support" <support@example.com>', // sender address
      to: email, // list of receivers
      subject: "Verify your email address", // Subject line
      text: `Please click the link to verify your email: ${verifyLink}`, // plain text body
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Email Verification</h2>
          <p>Thank you for registering. Please confirm your email address by clicking the link below:</p>
          <a href="${verifyLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
          <p>Or verify using this code: <strong>${token}</strong></p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `, // html body
    });

    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
};
