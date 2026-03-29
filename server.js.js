const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// ⚠️ ใส่ Test Key ของคุณตรงนี้
const SECRET_KEY = process.env.SECRET_KEY;
const BCEL_URL = 'https://payment-gateway.phajay.co/v1/api/payment/generate-bcel-qr';

// เก็บ transactions ที่รอชำระ
let pendingTransactions = {};

// ===== API Routes =====

// สร้าง QR Code
app.post('/api/create-qr', async (req, res) => {
  try {
    const { amount, name, message } = req.body;

    const response = await axios.post(BCEL_URL, {
      amount: parseInt(amount),
      description: 'Donation from ' + name
    }, {
      headers: {
        'secretKey': SECRET_KEY,
        'Content-Type': 'application/json'
      }
    });

    const data = response.data;

    if (data.qrCode) {
      // บันทึก transaction
      pendingTransactions[data.transactionId] = {
        name, amount, message,
        createdAt: Date.now()
      };

      res.json({
        success: true,
        qrCode: data.qrCode,
        transactionId: data.transactionId
      });
    } else {
      res.json({ success: false, message: 'ไม่สามารถสร้าง QR ได้' });
    }

  } catch(err) {
    res.json({ success: false, message: err.message });
  }
});

// Callback จาก PhaJay เมื่อจ่ายสำเร็จ
app.post('/api/payment-callback', (req, res) => {
  const { transactionId, status } = req.body;

  if (status === 'SUCCESS' && pendingTransactions[transactionId]) {
    const donation = pendingTransactions[transactionId];

    // ส่ง Alert ไปยัง Dashboard ทันที!
    io.emit('new-donation', {
      name: donation.name,
      amount: donation.amount,
      message: donation.message
    });

    delete pendingTransactions[transactionId];
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// ทดสอบ Alert (ใช้ตอน dev)
app.post('/api/test-donation', (req, res) => {
  const { name, amount, message } = req.body;
  io.emit('new-donation', { name, amount, message });
  res.json({ success: true });
});

// ===== WebSocket =====
io.on('connection', (socket) => {
  console.log('Dashboard connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Dashboard disconnected:', socket.id);
  });
});

// ===== Start Server =====
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════╗
  ║   laeezaa Server Running!     ║
  ║   http://localhost:${PORT}        ║
  ╚═══════════════════════════════╝
  `);
});
```

---

บันทึกไฟล์แล้วรัน Server ด้วยคำสั่งนี้ครับ:
```
node server.js