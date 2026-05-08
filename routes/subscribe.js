const express = require('express');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose(); 
const { open } = require('sqlite');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const router = express.Router();
const DB_PATH = path.join(__dirname, '../personal_assistant.db');
let isSendingFollowUpEmails = false;

const exponentialBackoff = async (fn, retries = 5, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i < retries - 1) {
        console.warn(`Retry ${i + 1} for function failed. Retrying in ${delay * Math.pow(2, i)}ms...`);
        await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
      } else {
        throw error;
      }
    }
  }
};

async function getDb() {
  let db;
  try {
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    });

    // Simplified and clean SQL query
    await db.exec(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        subscribedAt TEXT NOT NULL
      )
    `);
    console.log('Subscribers table initialized');
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

const sendFollowUpEmails = async () => {
  let followUpDb;
  try {
    followUpDb = await getDb();
    const currentSubscribers = await followUpDb.all('SELECT email FROM subscribers');
    const subscriberEmails = currentSubscribers.map(s => s.email);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    for (const subscriberEmail of subscriberEmails) {
      const followUpMailOptions = {
        from: `Personal Assistant App Team <${process.env.EMAIL_USER}>`,
        to: subscriberEmail,
        subject: 'Exclusive Update from Personal Assistant App!',
        html: `
          <html>
            <body style="font-family: 'Inter', sans-serif; background-color: #ffffff; padding: 20px; margin: 0;">
              <div style="max-width: 600px; margin: auto; background: linear-gradient(to bottom, #4c1d95, #000000, #4c1d95); color: #E2E8F0; padding: 30px; border-radius: 12px; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);">
                <h2 style="color: #F59E0B; text-align: center; font-size: 28px; margin-bottom: 20px;">Exclusive Update from Personal Assistant App!</h2>
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">Dear Valued Customer,</p>
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                  We hope you're enjoying your journey with Personal Assistant App! As a token of our appreciation, here’s an exclusive update sent on ${new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}.
                </p>
                <div style="margin-top: 20px; text-align: center; margin-bottom: 25px;">
                  <img src="https://media.istockphoto.com/id/2166551077/photo/technology-artificial-intelligence-digital-ai-hand-concept-on-cyber-future-business-tech.jpg?s=612x612&w=0&k=20&c=EfDz2yfJMSNe7HAw7NQD8AOsWu8IaYd1axb7amhUveY=" alt="Productivity Tools" style="width: 100%; max-width: 500px; border-radius: 10px; margin-bottom: 15px;">
                </div>
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
                  Discover our latest features, productivity tips, and special offers crafted just for you. Stay inspired and organized!
                </p>
                <footer style="margin-top: 40px; text-align: center; font-size: 14px; color: #94A3B8;">
                  <p style="margin-bottom: 5px;">Warm regards,<br>The Personal Assistant App Team</p>
                  <p style="margin-bottom: 5px;">No 69 Obafemi Awolowo Way, Ikeja, Lagos, Nigeria</p>
                  <p>+234 807 937 9510<br>${process.env.EMAIL_USER}</p>
                </footer>
              </div>
            </body>
          </html>
        `,
      };

      await exponentialBackoff(() => transporter.sendMail(followUpMailOptions));
      console.log(`Follow-up email sent to ${subscriberEmail}`);
    }
  } catch (error) {
    console.error(`Error sending follow-up emails:`, error);
  } finally {
    if (followUpDb) {
      await followUpDb.close();
    }
  }
};

router.post('/', async (req, res) => {
  let db;
  try {
    db = await getDb();
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const existingSubscriber = await db.get('SELECT * FROM subscribers WHERE email = ?', email);

    if (existingSubscriber) {
      return res.status(200).json({ message: 'You are already subscribed!' });
    }

    await db.run('INSERT INTO subscribers (email, subscribedAt) VALUES (?, ?)', email, new Date().toISOString());
    console.log(`New subscriber added: ${email}`);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `Personal Assistant App Team <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to Personal Assistant App! 👋 Your Journey to Productivity Starts Now',
      html: `
        <html>
          <body style="font-family: 'Inter', sans-serif; background-color: #f7f7f7; padding: 20px; margin: 0;">
            <div style="max-width: 650px; margin: auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); overflow: hidden;">
              <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 40px; text-align: center; color: #ffffff;">
                <h1 style="font-size: 32px; margin: 0; padding: 0;">Welcome to the Personal Assistant App Family!</h1>
                <p style="font-size: 18px; opacity: 0.9; margin-top: 10px;">Your journey to a more organized and productive life starts here.</p>
              </div>
              <div style="padding: 30px;">
                <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 25px;">Hello there,</p>
                <p style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 25px;">
                  We are absolutely thrilled to welcome you! By joining us, you've taken the first step towards simplifying your daily tasks and maximizing your efficiency. Our app is designed to be your trusted partner, helping you manage your schedule, set reminders, and conquer your to-do lists with ease.
                </p>
                <div style="text-align: center; margin-bottom: 30px;">
                  <img src="https://images.unsplash.com/photo-1542435503-956c469947f6?ixlib=rb-4.0.3&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=650&fit=max" alt="Productivity on Laptop" style="width: 100%; max-width: 500px; border-radius: 10px; object-fit: cover; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                </div>
                <h3 style="font-size: 22px; color: #667eea; margin-top: 30px; margin-bottom: 15px; text-align: center;">What You Can Do Now:</h3>
                <ul style="list-style: none; padding: 0; margin: 0 0 25px 0;">
                  <li style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 10px;">✅ <strong>Create Smart To-Do Lists:</strong> Organize your tasks by priority, deadline, or category.</li>
                  <li style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 10px;">🔔 <strong>Set Timely Reminders:</strong> Never miss a meeting or an important date again with our customizable alerts.</li>
                  <li style="font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 10px;">📈 <strong>Track Your Progress:</strong> Gain valuable insights into your productivity habits and stay on top of your goals.</li>
                </ul>
                <div style="text-align: center; margin-top: 40px; margin-bottom: 25px;">
                  <a href="http://localhost:3000" style="display: inline-block; background-color: #764ba2; color: white; padding: 15px 35px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 18px; letter-spacing: 0.5px; transition: background-color 0.3s ease;">Start Exploring Your App Now!</a>
                </div>
              </div>
              <div style="background-color: #f0f0f0; padding: 25px; text-align: center; color: #777;">
                <p style="margin: 0; font-size: 14px;">This welcome email has been sent to <strong style="color: #667eea;">${email}</strong>.</p>
              </div>
              <footer style="background-color: #333; color: #bbb; padding: 20px; text-align: center; font-size: 14px;">
                <p style="margin: 0;">Warmly,<br>The Personal Assistant App Team</p>
                <p style="margin: 5px 0 0;">&copy; ${new Date().getFullYear()} Personal Assistant App. All Rights Reserved.</p>
              </footer>
            </div>
          </body>
        </html>
      `,
    };

    const info = await exponentialBackoff(() => transporter.sendMail(mailOptions));
    console.log('Welcome email sent: ', info.response);

    if (!isSendingFollowUpEmails) {
      isSendingFollowUpEmails = true;
      setInterval(sendFollowUpEmails, 7 * 24 * 60 * 60 * 1000); 
    }

    return res.status(200).json({ message: 'Subscription successful! Welcome email sent.', email });
  } catch (error) {
    console.error('Error processing subscription:', error);
    return res.status(500).json({ error: 'Error processing subscription. Please try again later.' });
  } finally {
    if (db) {
      await db.close();
    }
  }
});

module.exports = router;