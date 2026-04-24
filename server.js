import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Fayllarni brauzerda ochish uchun ruxsat

// Fayllarni saqlash
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'public/uploads/'); },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

// Fayl yuklash API
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.json({ filePath: `uploads/${req.file.filename}` });
});

// Faylni o'chirish API
app.delete('/api/delete-file', (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ message: 'Path required' });

  // Xavfsizlik: faqat uploads papkasidan o'chirishga ruxsat beramiz
  const fullPath = path.join(__dirname, 'public', filePath);
  
  if (fs.existsSync(fullPath)) {
    fs.unlink(fullPath, (err) => {
      if (err) return res.status(500).json({ message: 'Error deleting file' });
      res.json({ message: 'File deleted successfully' });
    });
  } else {
    res.status(404).json({ message: 'File not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
