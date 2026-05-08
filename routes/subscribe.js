const express = require('express');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

module.exports = (db) => {
  const router = express.Router();

  let isSendingFollowUpEmails = false;

  // Retry helper
  const exponentialBackoff = async (
    fn,
    retries = 5,
    delay = 1000
  ) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i < retries - 1) {
          console.warn(
            `Retry ${i + 1} failed. Retrying in ${
              delay * Math.pow(2, i)
            }ms...`
          );

          await new Promise((res) =>
            setTimeout(res, delay * Math.pow(2, i))
          );
        } else {
          throw error;
        }
      }
    }
  };

  // Email transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Send follow-up emails
  const sendFollowUpEmails = async () => {
    try {
      const result = await db.execute(
        'SELECT email FROM subscribers'
      );

      const subscriberEmails = result.rows.map(
        (row) => row.email
      );

      for (const subscriberEmail of subscriberEmails) {
        const followUpMailOptions = {
          from: `Personal Assistant App Team <${process.env.EMAIL_USER}>`,
          to: subscriberEmail,
          subject:
            'Exclusive Update from Personal Assistant App!',
          html: `
            <html>
              <body style="font-family: sans-serif; background-color: #ffffff; padding: 20px;">
                <div style="max-width: 600px; margin: auto; background: linear-gradient(to bottom, #4c1d95, #000000, #4c1d95); color: white; padding: 30px; border-radius: 12px;">
                  <h2 style="color: #F59E0B; text-align: center;">
                    Exclusive Update from Personal Assistant App!
                  </h2>

                  <p>
                    Dear Valued Customer,
                  </p>

                  <p>
                    Thanks for being part of our productivity ecosystem.
                  </p>

                  <footer style="margin-top: 30px;">
                    Personal Assistant App Team
                  </footer>
                </div>
              </body>
            </html>
          `,
        };

        await exponentialBackoff(() =>
          transporter.sendMail(followUpMailOptions)
        );

        console.log(
          `Follow-up email sent to ${subscriberEmail}`
        );
      }
    } catch (error) {
      console.error(
        'Error sending follow-up emails:',
        error
      );
    }
  };

  // Subscribe Route
  router.post('/', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res
          .status(400)
          .json({ error: 'Email is required' });
      }

      // Check existing subscriber
      const existingSubscriber = await db.execute({
        sql: 'SELECT * FROM subscribers WHERE email = ?',
        args: [email],
      });

      if (existingSubscriber.rows.length > 0) {
        return res.status(200).json({
          message: 'You are already subscribed!',
        });
      }

      // Insert subscriber
      await db.execute({
        sql: `
          INSERT INTO subscribers (
            email,
            subscribedAt
          )
          VALUES (?, ?)
        `,
        args: [email, new Date().toISOString()],
      });

      console.log(`New subscriber added: ${email}`);

      // Welcome email
      const mailOptions = {
        from: `Personal Assistant App Team <${process.env.EMAIL_USER}>`,
        to: email,
        subject:
          'Welcome to Personal Assistant App! 👋',
        html: `
          <html>
            <body style="font-family: sans-serif; background-color: #f7f7f7; padding: 20px;">
              <div style="max-width: 650px; margin: auto; background-color: white; border-radius: 12px; padding: 30px;">
                <h1 style="color: #764ba2;">
                  Welcome to Personal Assistant App!
                </h1>

                <p>
                  Your journey to productivity starts now.
                </p>

                <a
                  href="https://yourfrontend.vercel.app"
                  style="
                    display:inline-block;
                    margin-top:20px;
                    background:#764ba2;
                    color:white;
                    padding:12px 24px;
                    border-radius:8px;
                    text-decoration:none;
                  "
                >
                  Open App
                </a>
              </div>
            </body>
          </html>
        `,
      };

      const info = await exponentialBackoff(() =>
        transporter.sendMail(mailOptions)
      );

      console.log(
        'Welcome email sent:',
        info.response
      );

      // Start follow-up loop once
      if (!isSendingFollowUpEmails) {
        isSendingFollowUpEmails = true;

        setInterval(
          sendFollowUpEmails,
          7 * 24 * 60 * 60 * 1000
        );
      }

      return res.status(200).json({
        message:
          'Subscription successful! Welcome email sent.',
        email,
      });
    } catch (error) {
      console.error(
        'Error processing subscription:',
        error
      );

      return res.status(500).json({
        error:
          'Error processing subscription. Please try again later.',
      });
    }
  });

  return router;
};