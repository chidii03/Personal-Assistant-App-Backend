const express = require('express');
const router = express.Router();

module.exports = (db) => {

  // GET CONTACTS
  router.get('/', async (req, res) => {
    try {
      const { userId } = req.query;

      let result;

      if (userId && userId !== 'anonymous') {
        result = await db.execute({
          sql: 'SELECT * FROM contacts WHERE userId = ?',
          args: [userId]
        });
      } else {
        result = await db.execute('SELECT * FROM contacts');
      }

      res.json(result.rows);

    } catch (error) {
      console.error('GET contacts error:', error);
      res.status(500).json({
        error: error.message
      });
    }
  });

  // ADD CONTACT
  router.post('/', async (req, res) => {
    try {
      const {
        name,
        address,
        phone_number,
        email,
        userId
      } = req.body;

      if (!name || !userId) {
        return res.status(400).json({
          error: 'Name and userId are required'
        });
      }

      await db.execute({
        sql: `
          INSERT INTO contacts (
            name,
            address,
            phone_number,
            email,
            userId
          )
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [
          name,
          address || null,
          phone_number || null,
          email || null,
          userId
        ]
      });

      const result = await db.execute({
        sql: `
          SELECT * FROM contacts
          WHERE userId = ?
          ORDER BY id DESC
          LIMIT 1
        `,
        args: [userId]
      });

      res.status(201).json(result.rows[0]);

    } catch (error) {
      console.error('POST contact error:', error);

      res.status(500).json({
        error: error.message
      });
    }
  });

  // UPDATE CONTACT
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const {
        name,
        address,
        phone_number,
        email,
        userId
      } = req.body;

      if (!name || !userId) {
        return res.status(400).json({
          error: 'Name and userId are required'
        });
      }

      await db.execute({
        sql: `
          UPDATE contacts
          SET
            name = ?,
            address = ?,
            phone_number = ?,
            email = ?
          WHERE id = ?
          AND userId = ?
        `,
        args: [
          name,
          address || null,
          phone_number || null,
          email || null,
          id,
          userId
        ]
      });

      const result = await db.execute({
        sql: `
          SELECT * FROM contacts
          WHERE id = ?
        `,
        args: [id]
      });

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Contact not found'
        });
      }

      res.json(result.rows[0]);

    } catch (error) {
      console.error('PUT contact error:', error);

      res.status(500).json({
        error: error.message
      });
    }
  });

  // DELETE CONTACT
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({
          error: 'userId is required'
        });
      }

      await db.execute({
        sql: `
          DELETE FROM contacts
          WHERE id = ?
          AND userId = ?
        `,
        args: [id, userId]
      });

      res.status(204).send();

    } catch (error) {
      console.error('DELETE contact error:', error);

      res.status(500).json({
        error: error.message
      });
    }
  });

  return router;
};