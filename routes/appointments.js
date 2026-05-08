const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // Get all appointments (now with optional userId filtering)
  router.get('/', (req, res) => {
    const { userId } = req.query; // Get userId from query parameters
    let sql = 'SELECT * FROM appointments';
    let params = [];

    if (userId && userId !== 'anonymous') { // Filter by userId if provided and not 'anonymous'
      sql += ' WHERE userId = ?';
      params.push(userId);
    }

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Database query error (GET appointments):', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  });

  // Add an appointment
  router.post('/', (req, res) => {
    const { date, startTime, endTime, location, userId } = req.body; // Expect userId from frontend

    // Validate required fields
    if (!date || !startTime || !location || !userId) {
      return res.status(400).json({ error: 'Date, start time, location, and userId are required' });
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || (endTime && !timeRegex.test(endTime))) {
      return res.status(400).json({ error: 'Invalid time format. Use HH:MM in 24-hour format' });
    }

    // Check if appointment is in the past
    const now = new Date();
    const appointmentDateTime = new Date(`${date}T${startTime}`);

    if (appointmentDateTime < now) {
      return res.status(400).json({ error: 'Cannot create appointments in the past' });
    }

    // Validate end time if provided
    if (endTime) {
      const endDateTime = new Date(`${date}T${endTime}`);
      if (endDateTime <= appointmentDateTime) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }
    }

    db.run(
      'INSERT INTO appointments (userId, date, startTime, endTime, location) VALUES (?, ?, ?, ?, ?)',
      [userId, date, startTime, endTime || null, location], // Ensure userId is inserted
      function (err) {
        if (err) {
          console.error('Database insert error (POST appointment):', err.message);
          return res.status(500).json({ error: err.message });
        }
        db.get('SELECT * FROM appointments WHERE id = ?', [this.lastID], (err, row) => {
          if (err) {
            console.error('Database select error after insert (POST appointment):', err.message);
            return res.status(500).json({ error: err.message });
          }
          res.status(201).json(row);
        });
      }
    );
  });

  // Update an appointment
  router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { date, startTime, endTime, location, userId } = req.body; // Expect userId

    // Validate required fields
    if (!date || !startTime || !location || !userId) { // userId validation added
      return res.status(400).json({ error: 'Date, start time, location, and userId are required' });
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || (endTime && !timeRegex.test(endTime))) {
      return res.status(400).json({ error: 'Invalid time format. Use HH:MM in 24-hour format' });
    }

    // Check if appointment is in the past
    const now = new Date();
    const appointmentDateTime = new Date(`${date}T${startTime}`);

    if (appointmentDateTime < now) {
      return res.status(400).json({ error: 'Cannot update appointments to past times' });
    }

    // Validate end time if provided
    if (endTime) {
      const endDateTime = new Date(`${date}T${endTime}`);
      if (endDateTime <= appointmentDateTime) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }
    }

    // Include userId in the WHERE clause for security and ownership
    db.run(
      'UPDATE appointments SET date = ?, startTime = ?, endTime = ?, location = ? WHERE id = ? AND userId = ?',
      [date, startTime, endTime || null, location, id, userId],
      function (err) {
        if (err) {
          console.error('Database update error (PUT appointment):', err.message);
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Appointment not found or you do not have permission to update it.' });
        }
        db.get('SELECT * FROM appointments WHERE id = ?', [id], (err, row) => {
          if (err) {
            console.error('Database select error after update (PUT appointment):', err.message);
            return res.status(500).json({ error: err.message });
          }
          res.json(row);
        });
      }
    );
  });

  // Delete an appointment
  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const { userId } = req.query; // Expect userId from query for delete operation

    if (!userId) {
      return res.status(400).json({ error: 'userId is required for deleting an appointment.' });
    }

    // Include userId in the WHERE clause for security and ownership
    db.run('DELETE FROM appointments WHERE id = ? AND userId = ?', [id, userId], (err) => {
      if (err) {
        console.error('Database delete error (DELETE appointment):', err.message);
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Appointment not found or you do not have permission to delete it.' });
      }
      res.status(204).send(); // No content for successful delete
    });
  });

  return router;
};
