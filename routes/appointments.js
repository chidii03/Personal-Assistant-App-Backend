const express = require('express');
const router = express.Router();

module.exports = (db) => {

  // GET APPOINTMENTS
  router.get('/', async (req, res) => {
    try {
      const { userId } = req.query;

      let result;

      if (userId && userId !== 'anonymous') {
        result = await db.execute({
          sql: 'SELECT * FROM appointments WHERE userId = ?',
          args: [userId]
        });
      } else {
        result = await db.execute('SELECT * FROM appointments');
      }

      res.json(result.rows);

    } catch (error) {
      console.error('GET appointments error:', error);

      res.status(500).json({
        error: error.message
      });
    }
  });

  // CREATE APPOINTMENT
  router.post('/', async (req, res) => {
    try {
      const {
        date,
        startTime,
        endTime,
        location,
        userId
      } = req.body;

      if (!date || !startTime || !location || !userId) {
        return res.status(400).json({
          error: 'Missing required fields'
        });
      }

      await db.execute({
        sql: `
          INSERT INTO appointments (
            userId,
            date,
            startTime,
            endTime,
            location
          )
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [
          userId,
          date,
          startTime,
          endTime || null,
          location
        ]
      });

      const result = await db.execute({
        sql: `
          SELECT * FROM appointments
          WHERE userId = ?
          ORDER BY id DESC
          LIMIT 1
        `,
        args: [userId]
      });

      res.status(201).json(result.rows[0]);

    } catch (error) {
      console.error('POST appointment error:', error);

      res.status(500).json({
        error: error.message
      });
    }
  });

  // UPDATE APPOINTMENT
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const {
        date,
        startTime,
        endTime,
        location,
        userId
      } = req.body;

      await db.execute({
        sql: `
          UPDATE appointments
          SET
            date = ?,
            startTime = ?,
            endTime = ?,
            location = ?
          WHERE id = ?
          AND userId = ?
        `,
        args: [
          date,
          startTime,
          endTime || null,
          location,
          id,
          userId
        ]
      });

      const result = await db.execute({
        sql: `
          SELECT * FROM appointments
          WHERE id = ?
        `,
        args: [id]
      });

      res.json(result.rows[0]);

    } catch (error) {
      console.error('PUT appointment error:', error);

      res.status(500).json({
        error: error.message
      });
    }
  });

  // DELETE APPOINTMENT
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.query;

      await db.execute({
        sql: `
          DELETE FROM appointments
          WHERE id = ?
          AND userId = ?
        `,
        args: [id, userId]
      });

      res.status(204).send();

    } catch (error) {
      console.error('DELETE appointment error:', error);

      res.status(500).json({
        error: error.message
      });
    }
  });

  return router;
};