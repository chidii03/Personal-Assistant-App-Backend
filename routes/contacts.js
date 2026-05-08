const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // Get all contacts (now with optional userId filtering)
  router.get('/', (req, res) => {
    const { userId } = req.query; // Get userId from query parameters
    let sql = 'SELECT * FROM contacts';
    let params = [];

    if (userId && userId !== 'anonymous') {
      sql += ' WHERE userId = ?';
      params.push(userId);
    }

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Database query error (GET contacts):', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  });

  // Add a contact
  router.post('/', (req, res) => {
    const { name, address, phone_number, email, userId } = req.body; // Expect userId from frontend

    // Validate required fields
    if (!name || !userId) { // Name and userId are now required
      return res.status(400).json({ error: 'Name and userId are required to add a contact' });
    }

    db.run(
      'INSERT INTO contacts (name, address, phone_number, email, userId) VALUES (?, ?, ?, ?, ?)',
      [name, address || null, phone_number || null, email || null, userId], // Ensure userId is inserted
      function (err) {
        if (err) {
          console.error('Database insert error (POST contact):', err.message);
          return res.status(500).json({ error: err.message });
        }
        db.get('SELECT * FROM contacts WHERE id = ?', [this.lastID], (err, row) => {
          if (err) {
            console.error('Database select error after insert (POST contact):', err.message);
            return res.status(500).json({ error: err.message });
          }
          res.status(201).json(row);
        });
      }
    );
  });

  // Update a contact
  router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { name, address, phone_number, email, userId } = req.body; // Expect userId

    // Validate required fields
    if (!name || !userId) { // Name and userId are required
      return res.status(400).json({ error: 'Name and userId are required to update a contact' });
    }

    // Include userId in the WHERE clause for security and ownership
    db.run(
      'UPDATE contacts SET name = ?, address = ?, phone_number = ?, email = ? WHERE id = ? AND userId = ?',
      [name, address || null, phone_number || null, email || null, id, userId],
      function (err) {
        if (err) {
          console.error('Database update error (PUT contact):', err.message);
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Contact not found or you do not have permission to update it.' });
        }
        db.get('SELECT * FROM contacts WHERE id = ?', [id], (err, row) => {
          if (err) {
            console.error('Database select error after update (PUT contact):', err.message);
            return res.status(500).json({ error: err.message });
          }
          res.json(row);
        });
      }
    );
  });

  // Delete a contact
  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const { userId } = req.query; // Expect userId from query for delete operation

    if (!userId) {
      return res.status(400).json({ error: 'userId is required for deleting a contact.' });
    }

    // Include userId in the WHERE clause for security and ownership
    db.run('DELETE FROM contacts WHERE id = ? AND userId = ?', [id, userId], (err) => {
      if (err) {
        console.error('Database delete error (DELETE contact):', err.message);
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Contact not found or you do not have permission to delete it.' });
      }
      res.status(204).send(); // No content for successful delete
    });
  });

  return router;
};
